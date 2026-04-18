# Sistema Trial 7 dias Telegram — guia de instalação

> ⚠️ **AÇÃO IMEDIATA — TOKEN EXPOSTO**
> O token do bot foi compartilhado no chat. Antes de subir o sistema, **revogue e gere um novo token**:
> 1. Abra o `@BotFather` no Telegram
> 2. `/mybots` → selecione o bot → `API Token` → `Revoke current token`
> 3. Copie o novo token e use APENAS nos segredos abaixo (nunca no código).

---

## 1. Pré-requisitos

- Bot do Telegram criado no `@BotFather`.
- Grupo do Telegram **convertido em supergrupo** (envie qualquer mensagem fixada → torna-se supergrupo).
- Bot adicionado ao grupo como **administrador** com as permissões:
  - Banir usuários
  - Convidar usuários por link
  - (Opcional) Excluir mensagens
- Supabase CLI instalado localmente: <https://supabase.com/docs/guides/cli>

## 2. Aplicar a migração SQL

Rode no SQL Editor do Supabase do projeto principal (`VITE_MAIN_SUPABASE_URL`):

```sql
-- copie o conteúdo de:
-- supabase/migrations/20260418_trial_telegram_system.sql
```

Confirme que a tabela `trial_leads` e a coluna `user_permissions.can_view_trial` foram criadas.

## 3. Configurar segredos das Edge Functions

```bash
supabase login
supabase link --project-ref SEU_REF_DO_PROJETO

supabase secrets set \
  TELEGRAM_TRIAL_BOT_TOKEN="NOVO_TOKEN_AQUI" \
  TELEGRAM_TRIAL_CHAT_ID="-1001234567890" \
  TELEGRAM_TRIAL_WEBHOOK_SECRET="$(openssl rand -hex 32)" \
  TRIAL_PUBLIC_SITE_URL="https://app.betsharkpro.com"
```

> `TRIAL_PUBLIC_SITE_URL` é o domínio público do app — usado pelo `trial-cron`
> para montar o link `/trial-upgrade?lead=…` enviado por DM 24h antes da expiração.

- `TELEGRAM_TRIAL_CHAT_ID`: id do supergrupo (negativo, ex.: `-1001234567890`).
- `TELEGRAM_TRIAL_WEBHOOK_SECRET`: token longo aleatório (32+ chars) — usado para
  validar que o request veio mesmo do Telegram. Use o mesmo valor no `setWebhook` abaixo.

> Para descobrir o `chat_id` do grupo: adicione o bot, envie uma mensagem no grupo
> e abra `https://api.telegram.org/botSEU_TOKEN/getUpdates` — copie `chat.id`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente.

## 4. Deploy das funções

```bash
supabase functions deploy trial-signup        --no-verify-jwt
supabase functions deploy trial-webhook       --no-verify-jwt
supabase functions deploy trial-upgrade-track --no-verify-jwt
supabase functions deploy trial-cron     # protegida por bearer service-role
supabase functions deploy trial-kick     # valida JWT do usuário
```

`trial-signup` e `trial-webhook` ficam abertas (`--no-verify-jwt`) porque são chamadas
pelo formulário público e pelo Telegram, respectivamente.

## 5. Registrar o webhook do Telegram

```bash
TOKEN="NOVO_TOKEN_AQUI"
URL="https://SEU_PROJETO.functions.supabase.co/trial-webhook"

SECRET="MESMO_VALOR_DE_TELEGRAM_TRIAL_WEBHOOK_SECRET"

curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${URL}\",
    \"secret_token\": \"${SECRET}\",
    \"allowed_updates\": [\"chat_member\",\"my_chat_member\"]
  }"
```

Confira: `curl https://api.telegram.org/bot${TOKEN}/getWebhookInfo`

> **Importante:** o bot precisa ser **administrador** do grupo para receber updates de
> `chat_member`. Sem isso, os joins não serão detectados.

## 6. Agendar a expiração diária (pg_cron)

No SQL Editor do Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'trial-cron-daily',
  '0 3 * * *', -- 03:00 UTC = 00:00 Brasília
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJETO.functions.supabase.co/trial-cron',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer SUA_SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Para rodar 2x ao dia (mais seguro), use `0 3,15 * * *`.

## 7. Liberar o admin no dashboard

1. Em `/admin/users`, marque **Trial Telegram** para os e-mails que devem ver a aba.
2. A aba **Trial Telegram** aparece automaticamente no sidebar para esses usuários.
3. A landing pública fica em `/trial` (sem login).

## 8. Smoke test

1. Acesse `/trial` (anônimo) → preencha o formulário.
2. Confira que o link do convite foi gerado e o lead aparece em `/trial-admin` como **Aguardando entrada**.
3. Entre no grupo via link → o lead deve virar **Ativo** com `expires_at = +7d`.
4. Clique em **Remover** → usuário sai do grupo e o status vira **Removido**.
5. Para testar o cron sem esperar 7 dias, edite manualmente `expires_at` para o passado e rode `trial-cron` via:
   ```bash
   curl -X POST https://SEU_PROJETO.functions.supabase.co/trial-cron \
     -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"
   ```

## 9. Página de upsell `/trial-upgrade`

Pública, sem login. Recebe os usuários após o aviso prévio de 24h enviado pelo
`trial-cron`. Apresenta os planos pagos e CTAs (WhatsApp / Telegram / checkout).

Aplique a migração `supabase/migrations/20260418_trial_upgrade.sql` para criar a
coluna `reminder_sent_at` em `trial_leads` e a tabela `trial_upgrade_events`.

Variáveis públicas (frontend) opcionais — defina no `.env` para personalizar:

```
VITE_TRIAL_UPGRADE_WHATSAPP="5511999999999"          # E.164, só dígitos
VITE_TRIAL_UPGRADE_CHECKOUT_URL="https://pay.exemplo.com/betshark"
VITE_TRIAL_UPGRADE_TELEGRAM_URL="https://t.me/betshark_suporte"
```

### Landing pública Shark 100% Green (`/`)

A LP em `trial.sharkgreen.com.br` (`src/pages/TrialLanding.tsx`) tem 3 CTAs principais:

```
VITE_FREE_GROUPS_URL="https://t.me/sharkgreen_free"          # link do grupo free
VITE_BUY_NOW_URL="https://pay.exemplo.com/shark-green"       # checkout / WhatsApp comercial
                                                              # (se vazio, faz fallback p/ VITE_TRIAL_UPGRADE_CHECKOUT_URL)
```

> Aplique também a migração `supabase/migrations/20260418_trial_upgrade_extra_events.sql`
> que estende o CHECK do `trial_upgrade_events.event_type` com os novos tipos
> `cta_free_group` e `cta_open_form` usados pelo tracking da LP.

A página dispara eventos (`view`, `cta_whatsapp`, `cta_checkout`, `cta_telegram`)
para a função `trial-upgrade-track`, persistidos em `trial_upgrade_events` com
o `lead_id` (quando o link veio do DM) e UTMs. Para acompanhar a conversão:

```sql
SELECT event_type, count(*) FROM trial_upgrade_events
WHERE created_at > now() - interval '30 days'
GROUP BY event_type ORDER BY 2 DESC;
```

## Alternativa sem Edge Functions

Caso prefira manter tudo em Python/PM2 (como `docs/scraper/standalone/run_telegram.py`),
os 3 jobs (`signup`, `webhook`, `cron`) podem ser portados para FastAPI ou para o
mesmo runner. A tabela e as permissões SQL continuam válidas.
