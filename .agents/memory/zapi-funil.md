---
name: Z-API funil WhatsApp
description: Arquitetura do funil de onboarding via WhatsApp Z-API para leads do trial
---

## Instância Z-API

- Instance ID: salvo como secret `ZAPI_INSTANCE_ID` no Supabase wspsuempnswljkphatur
- Token: secret `ZAPI_TOKEN`
- Client-Token: secret `ZAPI_CLIENT_TOKEN`
- Número (wa.me): 5545988407803

## Edge Functions

- `zapi-reply` — webhook handler, deployada no-verify-jwt
  URL: `https://wspsuempnswljkphatur.supabase.co/functions/v1/zapi-reply`
- `trial-signup` — cria lead + envia mensagem curta de "primeiro contato" via Z-API

## Fluxo completo

1. Lead preenche form → `trial-signup` cria lead + manda WA curto sem links ("Me responda com Oi")
2. Lead responde "Oi" → Z-API dispara webhook → `zapi-reply` envia menu de 3 botões
3. Lead toca botão → `zapi-reply` entrega credenciais/link
4. Estado guardado em `zapi_conversation_state` (phone UNIQUE, step: initial/awaiting_choice/done)

## Pendência manual obrigatória

Configurar no painel Z-API (painel.z-api.io):
- Webhook "Ao receber mensagem" → URL acima
- Webhook "Resposta de Botão" → URL acima

## Campo correto do webhook Z-API

`buttonsResponseMessage.buttonId` — NÃO `selectedButtonId` (confirmado via debug log)

## Normalização de telefone (crítico)

Z-API envia phone COM prefixo "55". trial_leads.whatsapp guarda SEM "55".
Números BR antigos de 8 dígitos: Z-API envia sem o "9" extra do celular.

`buildPhoneVariants(phone)` gera variantes para lookup:
- `"559981717256"` → `["559981717256", "9981717256", "99981717256"]`
- `"5513981822756"` → `["5513981822756", "13981822756"]`
Regra: se local (sem 55) tiver 10 dígitos → insere "9" após DDD (pos 2).

**Why:** trial_leads.whatsapp salvo com 11 dígitos (DDD+9+número). Z-API às vezes omite o 9 em números antigos.

## invite_link NULL — auto-geração

Se lead encontrado mas `invite_link=NULL`, `zapi-reply` regenera via Telegram API:
`POST .../createChatInviteLink` com `chat_id: Number(TELEGRAM_TRIAL_CHAT_ID), member_limit: 1`
e persiste o link no trial_leads.

**Why:** leads sem link ficavam presos no fallback "sendo gerado" sem resolução.

## Estado "done" + re-clique de botão

Após escolher uma opção, estado vai pra "done". Se lead clica outro botão do mesmo menu,
`zapi-reply` ainda processa (condição: `step === "done" && VALID_CHOICES.includes(text)`).

## Conflito de fluxos (resolvido)

`trial-signup` ANTES enviava mensagem com Telegram bot start URL (completo).
Causava: (1) risco de spam no WA, (2) bypassa o funil interativo.
DEPOIS: `buildWelcomeMessage` envia APENAS mensagem curta sem links.
