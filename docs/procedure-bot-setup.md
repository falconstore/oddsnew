# Bot de Registro Automático de Procedimentos via Telegram

O **telegram-procedure-bot** monitora um canal/grupo do Telegram e registra procedimentos automaticamente no banco, sem necessidade de intervenção manual no painel.

---

## 1. Criar o Bot no @BotFather

1. Abra o Telegram e inicie uma conversa com `@BotFather`.
2. Envie `/newbot` e siga as instruções:
   - Escolha um nome (ex: "BetShark Procedimentos")
   - Escolha um username (ex: `betshark_proc_bot`)
3. Guarde o **token** gerado (ex: `7123456789:AAF...`).

---

## 2. Adicionar o Bot ao Canal/Grupo

1. Vá nas configurações do canal/grupo onde o gerente posta os procedimentos.
2. Adicione o bot como **administrador** (permissões mínimas: "Ler mensagens").
3. Para **canais**: o bot precisa estar como administrador para receber as mensagens via webhook.
4. Para **grupos**: basta adicionar como membro comum — o webhook receberá `message` updates.

---

## 3. Obter o Chat ID

### Opção A — Via API do Telegram
Após adicionar o bot ao grupo, envie uma mensagem no grupo e acesse:
```
https://api.telegram.org/bot<SEU_TOKEN>/getUpdates
```
Procure o campo `"chat": { "id": ... }` na resposta. O ID de grupos geralmente é negativo (ex: `-1001234567890`).

### Opção B — Bot auxiliar
Adicione `@userinfobot` ao grupo, ele responde com o Chat ID.

---

## 4. Configurar os Secrets no Supabase

No painel do Supabase → **Edge Functions** → **Secrets**, adicione:

| Secret | Valor | Descrição |
|--------|-------|-----------|
| `TELEGRAM_PROC_BOT_TOKEN` | `7123...:AAF...` | Token do bot obtido no @BotFather |
| `TELEGRAM_PROC_CHAT_ID` | `-1001234567890` | ID do canal/grupo monitorado |
| `TELEGRAM_PROC_WEBHOOK_SECRET` | string aleatória segura | **Obrigatório.** Valida autenticidade do webhook. Sem ele, a função rejeita todas as requisições. |

> **Gerar um secret seguro:**
> ```bash
> openssl rand -hex 32
> ```

---

## 5. Deploy da Edge Function

```bash
supabase functions deploy telegram-procedure-bot --no-verify-jwt
```

> `--no-verify-jwt` é necessário porque o Telegram não envia JWT.

---

## 6. Registrar o Webhook no Telegram

Substitua os valores e execute:

```bash
curl -X POST \
  "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<SEU_PROJETO>.supabase.co/functions/v1/telegram-procedure-bot",
    "secret_token": "<TELEGRAM_PROC_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "channel_post"]
  }'
```

Para **verificar** se o webhook está ativo:
```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 7. Templates de Mensagem

O bot reconhece 3 tipos de procedimento. Use os templates abaixo.

> **Campos obrigatórios:**
> - `PROCEDIMENTO N` — número do procedimento
> - `CASA: X` — plataforma/casa de apostas
>
> **Campos opcionais mas recomendados:**
> - `DATA: DD/MM/AAAA` — data de referência (usa hoje se omitido)
> - Linha de evento com data e horário

---

### Tipo 1 — Lucro Direto / Super Odd (SEM_FB)

```
📋 PROCEDIMENTO 29
📅 DATA: 08/05/2026
🏠 CASA: Bet365
🎯 PROMOÇÃO: Super Odd do Dia

⚽ EVENTO: Manchester City x Arsenal
📅 08/05 às 20:00

💰 LUCRO: 💵 15,00
```

**Com range de lucro:**
```
📋 PROCEDIMENTO 30
📅 DATA: 08/05/2026
🏠 CASA: Sportingbet
🎯 SUPERODD

⚽ EVENTO: Flamengo x Palmeiras
📅 08/05 às 18:00

💰 LUCRO: 💵 10,00 À 20,00 💵
```
> Quando há range, o bot usa o **valor maior**.

**Duplo Green:**
```
📋 PROCEDIMENTO 31
📅 DATA: 08/05/2026
🏠 CASA: KTO

⚽ EVENTO: Real Madrid x Barcelona
📅 08/05 às 21:00

🎯 OBJETIVO DUPLO GREEN - 💵 25,00
```

**Com missão (categoria Extra):**
```
📋 PROCEDIMENTO 32
📅 DATA: 08/05/2026
🏠 CASA: Pixbet
🎯 MISSÃO DO DIA

⚽ EVENTO: São Paulo x Corinthians
📅 08/05 às 16:00

💰 LUCRO: 💵 8,00
```

---

### Tipo 2 — Ganhar Freebet (GANHAR_FB)

```
📋 PROCEDIMENTO 33
📅 DATA: 08/05/2026
🏠 CASA: Betano
🎯 FREEBET

⚽ EVENTO: PSG x Lyon
📅 08/05 às 19:00

🎁 RECOMPENSA: 🎁 50,00 EM FREEBET
```

---

### Tipo 3 — Queimar Freebet (QUEIMAR_FB)

```
📋 PROCEDIMENTO 34 — REFERENTE ÀS FREEBETS DO PROCEDIMENTO 33
📅 DATA: 08/05/2026
🏠 CASA: Betano

⚽ EVENTO: Olympique x Nice
📅 08/05 às 21:30

💰 LUCRO: 💵 30,00
```
> O bot busca automaticamente o UUID do Procedimento 33 no banco para preencher o campo de referência.

---

### Tipo 4 — Aposta Sem Risco (ASR)

Usada quando a promoção garante **lucro direto OU freebet** como recompensa alternativa.
O sinal distintivo é ter `LUCRO:` **e** `RECOMPENSA: X EM FREEBET` na mesma mensagem.

```
🟢 PROCEDIMENTO 189 - 13/05/2026
🟢 PROCEDIMENTO REFERENTE A PROMOÇÃO DA ESPORTIVABET - ESPORTIVA DAY 🔥
CASA: ESPORTIVABET

UTILIZAREMOS A PARTIDA ENTRE:
Mirassol x RB Bragantino - 13/05/2026 ÀS 20:30

🟡 LUCRO: 💰 18,50 / OU
🟡 RECOMPENSA: 🎁 100,00 EM FREEBET
📋 CATEGORIA: Cashback
😍 chance de duplo green 😍
```

> O bot registra com `tipo = ASR`, `status = Aposta Sem Risco`, e captura ambos os valores:
> `lucro_prejuizo_previsto = 18,50` e `freebet_valor_previsto = 100,00`.
> O "/ OU" após o valor do lucro é opcional e tolerado.

---

### Múltiplos Eventos (o bot escolhe o mais próximo do horário atual)

```
📋 PROCEDIMENTO 35
📅 DATA: 08/05/2026
🏠 CASA: Bet365

⚽ EVENTO 1: Arsenal x Chelsea - 08/05 às 16:00
⚽ EVENTO 2: Man City x Liverpool - 08/05 às 21:00

💰 LUCRO: 💵 18,00
```
> Se for 17h, o bot escolhe automaticamente o **Evento 2** (mais próximo da hora atual).

---

## 8. Mensagens de Retorno do Bot

| Situação | Mensagem |
|----------|----------|
| Sucesso | `✅ Procedimento 29 registrado — Lucro Direto · Bet365 · Manchester City x Arsenal` |
| Campos faltando | `❌ Não consegui registrar. Campos ausentes: casa/plataforma (CASA: X), valor de freebet (X,XX EM FREEBET).` |
| Erro de banco | `❌ Não consegui registrar. Erro no banco: [mensagem do erro].` |

O bot responde sempre na mesma thread/mensagem para manter o contexto.

---

## 9. Observações Importantes

- **Mensagens editadas são ignoradas** — somente novas mensagens são processadas.
- **`fixture_id`** não é preenchido automaticamente (fica `null`); pode ser preenchido depois via backfill ou editando o procedimento no painel.
- **Resultado pós-jogo** continua sendo registrado manualmente no painel `/procedure-control`.
- A sincronização com o FreeBet PRO é disparada automaticamente após cada inserção bem-sucedida (mesmo comportamento do painel).
- Se o procedimento de referência (QUEIMAR_FB) não for encontrado pelo número, o `freebet_reference_id` fica `null` — corrija manualmente no painel se necessário.
