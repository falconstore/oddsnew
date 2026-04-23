# BetShark Pro

## Overview
BetShark Pro is a real-time odds monitoring application for sports betting. It provides features like dashboard views, match details, procedure control, subscriptions management, betting affiliate tools (BetBra), and admin panels.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite, styled with Tailwind CSS and shadcn/ui components
- **Backend**: External Supabase instance (auth, database, realtime)
- **Routing**: react-router-dom v6 with animated transitions (framer-motion)
- **State**: @tanstack/react-query for server state, React Context for auth
- **Theme**: Dark mode by default using next-themes

## Project Structure
```
src/
├── components/       # Reusable UI components
│   ├── ui/          # shadcn/ui base components
│   ├── betbra/      # BetBra affiliate components
│   ├── entities/    # Entity management tabs
│   ├── login/       # 3D login background effects
│   ├── procedures/  # Procedure control components
│   └── subscriptions/ # Subscription management
├── contexts/        # React contexts (AuthContext)
├── hooks/           # Custom hooks (data fetching, realtime)
├── integrations/    # Supabase client & types
├── lib/             # Utility functions
├── pages/           # Route pages
│   └── admin/       # Admin pages (Users, Logs, ScraperStatus)
└── types/           # TypeScript type definitions
```

## Key Configuration
- **Vite**: Runs on port 5000, allows all hosts for Replit proxy
- **Supabase**: Two external Supabase instances, credentials stored in Replit environment variables
  - `VITE_MAIN_SUPABASE_URL` / `VITE_MAIN_SUPABASE_ANON_KEY` - Auth & main data (wspsuempnswljkphatur)
  - `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` - Secondary Supabase project (hyccrhpvedvfnzhetxkz)
  - `VITE_PROCEDURES_SUPABASE_URL` / `VITE_PROCEDURES_SUPABASE_ANON_KEY` - Procedures data (wspsuempnswljkphatur)

## Running
- Workflow "Start application" runs `npm run dev` on port 5000

## Trial Telegram System

### Fluxo "Abrir bot primeiro" (desde 2026-04-23)
**Problema resolvido**: Telegram só permite o bot mandar DM se o usuário tiver dado `/start` no DM dele primeiro. No fluxo antigo, o lead pegava o invite_link direto e entrava no grupo sem nunca falar com o bot — por isso as DMs de 24h/1h falhavam com 403 pra praticamente todo mundo. Solução: força o lead a passar pelo bot antes de receber o invite link.

**Fluxo novo**:
1. Lead preenche o form em `/trial`.
2. `trial-signup` cria invite_link no grupo + insere o lead com `id` UUID + retorna `{ lead_id, bot_start_url, bot_username, invite_link }`. `bot_start_url = https://t.me/<bot>?start=lead_<UUID>`. Username default hardcoded `sharkinhogreen_bot` (override via env `TELEGRAM_TRIAL_BOT_USERNAME`).
3. Modal de sucesso na `TrialLanding.tsx` mostra botão grande **"Abrir bot no Telegram"** (`bot_start_url`) como CTA principal. Invite_link fica escondido em `<details>` como fallback "se não conseguir abrir o bot".
4. Lead toca Iniciar/Start no DM do bot → Telegram envia `update.message` com `text="/start lead_<UUID>"` pro `trial-webhook`.
5. `trial-webhook` (Caso 0, novo): valida `chat.type=='private'` + regex `/^\/start lead_<uuid>$/`, busca o lead, **grava `telegram_user_id` e `telegram_username` na hora** (peça-chave: a partir daqui o cron consegue mandar DMs sem 403), responde com mensagem HTML + botão inline `🚀 Entrar no grupo VIP` apontando pro `invite_link`.
6. Lead clica no botão, entra no grupo, dispara `chat_member` que ativa o trial (Caso 1, fluxo já existente).

**Mudanças necessárias**:
- `trial-webhook-reset` agora registra `allowed_updates: [chat_member, my_chat_member, message]`. Após deploy, o admin precisa clicar em **"Resetar webhook"** em `/trial-admin` pra essa mudança valer.
- `trial-signup` precisa redeploy com `--no-verify-jwt`.
- `trial-webhook` precisa redeploy com `--no-verify-jwt`.

**Tratamentos de borda no `/start`**:
- `/start` sem payload → mensagem genérica pedindo cadastro pelo site.
- payload com lead_id que não existe → "Cadastro não encontrado, refaça pelo site".
- lead já tem `telegram_user_id` diferente do `from.id` → bloqueia, pede contato com suporte (anti-repeat preventivo).
- lead já em status bloqueado/expirado → "Trial encerrado, fale com suporte".
- Mensagens privadas que não sejam `/start` são ignoradas silenciosamente.

### DMs de aviso 24h + 1h (desde 2026-04-23)
O `trial-cron` envia DUAS DMs antes da expiração: uma 24h antes (`reminder_sent_at`) e outra ~1h antes (`reminder_1h_sent_at`, coluna nova em `trial_leads` via migração `20260423_trial_reminder_extras.sql`). Ambas levam direto pro checkout do Lastlink com cupom destacado. URL hardcoded `TRIAL_REMINDER_CHECKOUT_URL=https://lastlink.com/p/CEAEE6585/checkout-payment/` (override por env). Query params adicionados: `cp=<cupom>` (Lastlink aplica o cupom automaticamente no checkout — sem isso o cliente precisava digitar manualmente), `utm_source=telegram`, `utm_medium=dm`, `utm_campaign=trial_reminder_24h|trial_reminder_1h`, `coupon=<cupom>`, `lead_id=<id>`. Reply markup tem 2 linhas de botões: `🛒 Assinar com cupom <cupom>` + `💬 Falar com Suporte` (link `https://t.me/SuporteSharkGreen_financeiro`, hardcoded). Copy das DMs (24h e 1h) menciona o desconto explícito `R$ 148,90 → R$ 99,90 com cupom` pra dar âncora de preço.

**Cupom editável pelo painel** (sem redeploy): tabela singleton `trial_settings` (id=true PK, `reminder_coupon` text default 'PODPROMO', RLS p/ admins). `trial-cron` e `trial-reminder-test` leem dela; fallback p/ env `TRIAL_REMINDER_COUPON` e depois 'PODPROMO'. Painel `/trial-admin` tem card "Cupom dos avisos" com input + botão Salvar (mostra última alteração).

**Janela do aviso de 1h**: query `[now, now+90min]`. Pra captura completa o pg_cron precisa rodar pelo menos a cada 90min (idealmente horário). Em cron diário ele captura só ~6% dos leads do dia — comentário explicativo no `trial-cron/index.ts`.

**Botão "Enviar DM teste"** no `/trial-admin` (header, ao lado de "Diagnosticar Telegram"): abre dialog c/ Variante (24h ou 1h) + Telegram user_id OU @username + nome opcional. Dispara `trial-reminder-test` (edge function admin-gated por `can_view_trial`/`is_super_admin`) que monta a mensagem real (mesmas helpers do cron), resolve username via `getChat` se preciso, e envia. Adiciona `(mensagem de teste)` em itálico no fim p/ diferenciar de DMs reais. Destinatário precisa ter dado `/start` no bot pelo menos 1 vez. Permite validar copy/cupom/links sem esperar lead real.

### Cohorts v1/v2 (desde 2026-04-23)
O grupo Telegram original foi excluído sem querer e os 40 leads existentes ficaram órfãos. Para preservar os dados sem disparar avisos/kicks errados, `trial_leads` ganhou a coluna `cohort` ('v1' | 'v2', default 'v2'). Migração `supabase/migrations/20260423_trial_cohort.sql` faz backfill de tudo que existia para 'v1' e seta `reminder_sent_at=now()` como defesa em profundidade. `trial-cron` filtra TANTO o aviso de 24h QUANTO a expiração/kick por `cohort='v2'`, então leads v1 nunca são tocados pelo Telegram. Novos cadastros via `trial-signup` herdam 'v2' do default da coluna (não precisou mexer no signup). Painel `/trial-admin` tem filtro "Todas as turmas / v2 / v1" e badge cinza "v1 (grupo antigo)" no card. Stats totais continuam contando v1+v2.


Public landing at `/trial` (no auth) captures leads (name, email, WhatsApp, @ Telegram) with case-insensitive dedup. **Anti-repeater** (since 2026-04-19): the webhook and `trial-link-manual` check `telegram_user_id` (immutable) before activating — if that ID already belongs to another lead, the new one is marked `status='blocked_repeat'` with `previous_lead_id` pointing to the prior lead, and the user is re-kicked + invite link revoked. Admin can override via "Liberar e ativar" button in `/trial-admin` (calls `trial-force-activate`). Schema in `supabase/migrations/20260419_trial_block_repeat.sql`. Admin CRM at `/trial-admin` (gated by `can_view_trial` permission). Backend in Supabase Edge Functions (`trial-signup`, `trial-webhook`, `trial-cron`, `trial-kick`, `trial-purge`, `trial-upgrade-track`, `trial-diagnose`, `trial-link-manual`, `trial-webhook-reset`, `trial-force-activate`) using Telegram Bot API to issue 24h/1-use invite links, detect joins via `chat_member` webhook, kick after 7 days via daily `pg_cron`. The cron also sends a DM 24h before expiration with a deep-link to the upsell page `/trial-upgrade` (pricing + WhatsApp/checkout CTAs); page views and CTA clicks are tracked in `trial_upgrade_events`. Schemas in `supabase/migrations/20260418_trial_telegram_system.sql`, `supabase/migrations/20260418_trial_upgrade.sql` and `supabase/migrations/20260418_trial_upgrade_extra_events.sql` (extends event_type CHECK with `cta_free_group` and `cta_open_form`). Setup guide: `docs/trial-setup.md`. Required Edge Function secrets: `TELEGRAM_TRIAL_BOT_TOKEN`, `TELEGRAM_TRIAL_CHAT_ID`, `TELEGRAM_TRIAL_WEBHOOK_SECRET`, `TRIAL_PUBLIC_SITE_URL`. Optional frontend vars: `VITE_TRIAL_UPGRADE_WHATSAPP`, `VITE_TRIAL_UPGRADE_CHECKOUT_URL`, `VITE_TRIAL_UPGRADE_TELEGRAM_URL`, `VITE_FREE_GROUPS_URL`, `VITE_BUY_NOW_URL`.

### Operação & resiliência
- **Nunca redeploye `trial-signup`, `trial-webhook` ou `trial-upgrade-track` sem `--no-verify-jwt`.** Sem essa flag, o gateway do Supabase devolve 401 para o Telegram e os updates de `chat_member` são descartados de forma permanente após as tentativas de reentrega — leads entram no grupo mas ficam presos em "Aguardando entrada" para sempre.
- **Diagnóstico em `/trial-admin`** (botão "Diagnosticar Telegram"): roda `trial-diagnose` (8 checks: bot vivo, webhook registrado, allowed_updates inclui `chat_member`, bot é admin, etc.), mostra a idade do último erro do webhook (formatada com `date-fns`) e marca como "histórico" quando `pending_update_count = 0` (deixa de ser vermelho). Inclui botão **"Resetar webhook"** (dispara `trial-webhook-reset`) que re-instala o webhook no Telegram com a URL pública, secret e `allowed_updates: [chat_member, my_chat_member]`.
- **Apagar do banco** (botão vermelho ao lado de "Remover" no card do lead): dispara `trial-purge` que (1) bana+desbana do grupo se ainda estiver lá, (2) revoga o invite_link rastreado, (3) **DELETE definitivo** da linha em `trial_leads`. Libera email/whatsapp/@username para um novo cadastro. Diferente de "Remover" (que só marca como `removed`, mantendo a dedup ativa), o purge é a saída de emergência para casos legítimos. `previous_lead_id` em outros leads e `trial_upgrade_events.lead_id` têm `ON DELETE SET NULL`, então histórico de eventos é preservado e leads que apontavam para o purgado só perdem a referência.
- **Recuperação de leads fantasma** (botão "Vincular" no card do lead, visível quando `telegram_user_id` está null): dispara `trial-link-manual` que tenta resolver `@username → user_id` via `getChat(@username)`. Se Telegram não devolver, abre input para o admin colar o ID numérico (obtido pedindo ao usuário pra usar `@userinfobot`). Confirma a presença no grupo via `getChatMember` e ativa o lead (`status=active`, `entered_at=now`, `expires_at=+7d`).
- **Logs estruturados** do `trial-webhook`: cada decisão emite `console.log` JSON com `tag: "trial-webhook"` + evento (`received` / `activated` / `re-kicked` / `marked-removed` / `ignored`) + contexto. Quando descarta por mismatch de invite_link, loga os dois links lado a lado.

## LP Shark 100% Green (`trial.sharkgreen.com.br/`)
Page `src/pages/TrialLanding.tsx` rebranded as **Shark 100% Green** with luxury dark-green aesthetic (Shark in Rolls-Royce hero image at `attached_assets/image_1776543554081.png` via `@assets` alias). Hero offers 3 CTAs: "Quero testar 7 Dias" (opens shadcn `Dialog` modal with the original signup form intact — same `trial-signup` payload), "Acessar Grupos Free" (`VITE_FREE_GROUPS_URL`), and "Compre Agora" (`VITE_BUY_NOW_URL` with fallback to `VITE_TRIAL_UPGRADE_CHECKOUT_URL`). Two storytelling sections: **Método Shark Antecipado** (3 pillars) and **Estratégia, não sorte** (2 bullets), each with redundant "Quero testar 7 Dias" CTA. All CTA clicks + modal opens + page view fire events to `trial-upgrade-track` (event types: `view`, `cta_open_form`, `cta_free_group`, `cta_checkout`) feeding `/trial-admin` conversion stats.

## Design System (Rebranded)
- **Font**: Inter + Space Grotesk (sans), JetBrains Mono (mono)
- **Primary color**: Neon green (`hsl(145 80% 48%)`)
- **Dark background**: Deep navy `hsl(222 20% 5%)` with radial green glow
- **Utility classes**: `gradient-text`, `glow-primary`, `glass`, `stat-green/cyan/amber/purple/pink`, `animate-fade-in-up`, `animate-pulse-glow`, `card-hover`
- **Page headers**: Icon badge (color-coded per page) + title + subtitle — consistent across all pages
- **Sidebar**: Gradient logo mark with live pulse dot, color-coded nav icons, user footer with avatar ring
- **Cards**: Colored gradient stat cards with matching border accents

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred (default)
- UI style: "Instagrammable" — neon accents, glassmorphism, gradient text, animated elements
