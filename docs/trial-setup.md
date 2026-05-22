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
supabase functions deploy trial-cron          # protegida por bearer service-role
supabase functions deploy trial-kick          # valida JWT do usuário
supabase functions deploy trial-diagnose      # valida JWT do usuário
supabase functions deploy trial-link-manual   # valida JWT do usuário
supabase functions deploy trial-webhook-reset # valida JWT do usuário
supabase functions deploy trial-force-activate # valida JWT do usuário (override anti-repetidor)
```

> Antes de fazer o deploy do `trial-webhook` (com a checagem anti-repetidor) e
> do `trial-force-activate`, aplique a migração
> `supabase/migrations/20260419_trial_block_repeat.sql` no SQL Editor — ela
> adiciona o status `blocked_repeat`, a coluna `previous_lead_id` e o índice
> em `telegram_user_id`. Sem isso, o webhook devolve erro ao tentar
> escrever o novo status.

`trial-signup`, `trial-webhook` e `trial-upgrade-track` ficam abertas
(`--no-verify-jwt`) porque são chamadas pelo formulário público, pelo Telegram
e pelo navegador anônimo, respectivamente. As demais ficam atrás de JWT.

> ⚠️ **Atenção: nunca redeploye `trial-signup`, `trial-webhook` ou
> `trial-upgrade-track` sem o `--no-verify-jwt`.** Se isso acontecer, o gateway
> do Supabase passa a devolver 401 para o Telegram e os updates de
> `chat_member` (entradas no grupo) **são descartados de forma permanente**
> depois das tentativas de reentrega — leads ficam presos em "Aguardando
> entrada" mesmo já tendo entrado. Para recuperá-los manualmente, use o
> botão **"Vincular ao Telegram"** em `/trial-admin` (chama `trial-link-manual`).

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

## Webhook sendo sobrescrito por outro projeto ("sequestro" do token)

O Telegram só aceita **1 webhook por bot**. Se você usa o mesmo
`TELEGRAM_TRIAL_BOT_TOKEN` em mais de um projeto (ex.: um Replit antigo,
um script de teste, etc.), sempre que esse outro projeto chamar
`setWebhook` o nosso webhook é silenciosamente derrubado e os leads param
de ser processados — ficam todos presos em "Aguardando entrada".

**1ª linha de defesa — rotacionar o token (manual):**

1. Abra `@BotFather` → `/mybots` → selecione o bot → `API Token` → `Revoke current token`.
2. Copie o novo token e atualize o secret `TELEGRAM_TRIAL_BOT_TOKEN` no Supabase.
3. Re-rode o `setWebhook` (passo 5 deste guia) com o novo token.
4. Apague/desative o outro projeto que estava sequestrando o webhook.

**2ª linha de defesa — auto-heal automático (já configurado):**

A migração `supabase/migrations/20260522_trial_webhook_autoheal.sql`
adiciona um pg_cron `trial-webhook-autoheal-5min` que roda a cada 5
minutos chamando a edge function `trial-webhook-guard`. O guard:

- Faz `getWebhookInfo` no Telegram.
- Se a URL **não termina em `/trial-webhook`** ou se `chat_member` sumiu
  das `allowed_updates`, re-instala o webhook automaticamente.
- Grava cada correção em `trial_webhook_audit` (data, URL anterior, URL nova).

No painel `/trial-admin` aparece um banner amarelo "Guarda do Webhook"
mostrando quantas correções ocorreram nas últimas 24h e qual foi a
última URL estranha — se esse contador for > 0, alguém ainda está
sequestrando o token e você deve rotacioná-lo.

**Deploy do guard:**

```bash
supabase functions deploy trial-webhook-guard --no-verify-jwt
```

A função é protegida via header `x-cron-secret` (sem JWT). Por padrão
aceita o mesmo valor do `TRIAL_CRON_SECRET` que o cron já usa via vault
`trial_cron_secret`, então **não precisa configurar nada novo**. Se
quiser rotacionar o segredo do guard separado, defina
`TRIAL_WEBHOOK_GUARD_SECRET` como secret da edge function (tem
precedência sobre `TRIAL_CRON_SECRET`) e atualize o vault.

**Toggle de kill-switch:** no painel `/trial-admin`, dentro do card
"Guarda do Webhook", existe um switch "Auto-heal: ligado/desligado" que
escreve em `trial_settings.webhook_autoheal_enabled`. Use quando quiser
investigar manualmente sem o cron ficar corrigindo no meio do caminho.

## Alternativa sem Edge Functions

Caso prefira manter tudo em Python/PM2 (como `docs/scraper/standalone/run_telegram.py`),
os 3 jobs (`signup`, `webhook`, `cron`) podem ser portados para FastAPI ou para o
mesmo runner. A tabela e as permissões SQL continuam válidas.
