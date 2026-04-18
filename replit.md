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
Public landing at `/trial` (no auth) captures leads (name, email, WhatsApp, @ Telegram) with case-insensitive dedup. Admin CRM at `/trial-admin` (gated by `can_view_trial` permission). Backend in Supabase Edge Functions (`trial-signup`, `trial-webhook`, `trial-cron`, `trial-kick`, `trial-upgrade-track`) using Telegram Bot API to issue 24h/1-use invite links, detect joins via `chat_member` webhook, kick after 7 days via daily `pg_cron`. The cron also sends a DM 24h before expiration with a deep-link to the upsell page `/trial-upgrade` (pricing + WhatsApp/checkout CTAs); page views and CTA clicks are tracked in `trial_upgrade_events`. Schemas in `supabase/migrations/20260418_trial_telegram_system.sql` and `supabase/migrations/20260418_trial_upgrade.sql`. Setup guide: `docs/trial-setup.md`. Required Edge Function secrets: `TELEGRAM_TRIAL_BOT_TOKEN`, `TELEGRAM_TRIAL_CHAT_ID`, `TRIAL_PUBLIC_SITE_URL`. Optional frontend vars: `VITE_TRIAL_UPGRADE_WHATSAPP`, `VITE_TRIAL_UPGRADE_CHECKOUT_URL`, `VITE_TRIAL_UPGRADE_TELEGRAM_URL`.

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
