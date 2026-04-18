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
Public landing at `/trial` (no auth) captures leads (name, email, WhatsApp, @ Telegram) with case-insensitive dedup. Admin CRM at `/trial-admin` (gated by `can_view_trial` permission). Backend in Supabase Edge Functions (`trial-signup`, `trial-webhook`, `trial-cron`, `trial-kick`, `trial-upgrade-track`) using Telegram Bot API to issue 24h/1-use invite links, detect joins via `chat_member` webhook, kick after 7 days via daily `pg_cron`. The cron also sends a DM 24h before expiration with a deep-link to the upsell page `/trial-upgrade` (pricing + WhatsApp/checkout CTAs); page views and CTA clicks are tracked in `trial_upgrade_events`. Schemas in `supabase/migrations/20260418_trial_telegram_system.sql`, `supabase/migrations/20260418_trial_upgrade.sql` and `supabase/migrations/20260418_trial_upgrade_extra_events.sql` (extends event_type CHECK with `cta_free_group` and `cta_open_form`). Setup guide: `docs/trial-setup.md`. Required Edge Function secrets: `TELEGRAM_TRIAL_BOT_TOKEN`, `TELEGRAM_TRIAL_CHAT_ID`, `TRIAL_PUBLIC_SITE_URL`. Optional frontend vars: `VITE_TRIAL_UPGRADE_WHATSAPP`, `VITE_TRIAL_UPGRADE_CHECKOUT_URL`, `VITE_TRIAL_UPGRADE_TELEGRAM_URL`, `VITE_FREE_GROUPS_URL`, `VITE_BUY_NOW_URL`.

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
