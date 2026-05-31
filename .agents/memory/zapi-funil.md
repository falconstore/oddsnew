---
name: Z-API funil WhatsApp
description: Arquitetura do funil de onboarding via WhatsApp Z-API para leads do trial
---

## Instância Z-API

- Instance ID: salvo como secret `ZAPI_INSTANCE_ID` no Supabase wspsuempnswljkphatur
- Token: secret `ZAPI_TOKEN`
- Client-Token: secret `ZAPI_CLIENT_TOKEN`
- Número (wa.me): 5545988407803

## Edge Function

`zapi-reply` — deployada em wspsuempnswljkphatur, `no-verify-jwt`.

URL: `https://wspsuempnswljkphatur.supabase.co/functions/v1/zapi-reply`

## Fluxo

1. Lead clica no botão na página /obrigado → abre wa.me com mensagem pré-programada
2. Z-API recebe a mensagem → dispara webhook para `zapi-reply`
3. `zapi-reply` envia menu com 3 botões via `send-button-list`
4. Lead toca em um botão → Z-API dispara webhook com `buttonResponseMessage.selectedButtonId`
5. `zapi-reply` processa: opt_telegram / opt_app / opt_both
6. Estado guardado em `zapi_conversation_state` (phone UNIQUE)

## Pendência manual obrigatória

Configurar no painel Z-API (painel.z-api.io):
- Webhook "Ao receber mensagem" → URL acima
- Webhook "Resposta de Botão" → URL acima

Sem isso, a automação não dispara.

## Tabela de estado

`public.zapi_conversation_state` — phone UNIQUE, step (initial/awaiting_choice/done), lead_id FK trial_leads, RLS desabilitado.

**Why:** A Z-API não mantém estado de conversa — precisamos saber se o lead já recebeu o menu ou não.
