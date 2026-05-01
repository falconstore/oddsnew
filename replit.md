# BetShark Pro

## Overview
BetShark Pro is a real-time odds monitoring application for sports betting. It features dashboard views, detailed match information, procedure control, subscriptions, betting affiliate tools (BetBra), and administrative panels. The project aims to provide a comprehensive, real-time sports betting odds platform with a focus on user engagement and conversion through a sophisticated trial system.

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred (default)
- UI style: "Instagrammable" — neon accents, glassmorphism, gradient text, animated elements

## System Architecture
- **Frontend**: React 18, TypeScript, Vite, styled with Tailwind CSS and shadcn/ui.
- **Backend**: Supabase (auth, database, realtime) and Supabase Edge Functions for business logic and integrations.
- **State Management**: @tanstack/react-query for server state, React Context for authentication.
- **Routing**: react-router-dom v6 with framer-motion for animated transitions.
- **UI/UX**:
    - **Theme**: Dark mode by default, featuring a deep navy background, neon green primary color (`hsl(145 80% 48%)`), and radial green glow effects.
    - **Typography**: Inter and Space Grotesk for sans-serif, JetBrains Mono for monospace.
    - **Components**: Utilizes custom utility classes like `gradient-text`, `glow-primary`, `glass`, `animate-fade-in-up`, and `card-hover` for a dynamic and engaging aesthetic.
    - **Layout**: Consistent page headers with icon badges, titles, and subtitles. A sidebar includes a gradient logo mark with a pulse dot and color-coded navigation icons.
- **Trial Telegram System**:
    - Manages lead acquisition and trial activation through Telegram.
    - Implements a forced bot interaction flow to ensure direct messaging capability.
    - Sends automated 24h and 1h expiration reminder DMs with customizable coupons.
    - Supports an optional second "bonus" Telegram group for enhanced user engagement.
    - Features a robust anti-repeater mechanism based on `telegram_user_id` to prevent duplicate trials.
    - Provides an admin panel (`/trial-admin`) for lead management, diagnostics, and manual interventions.
    - Incorporates structured logging for all critical webhook decisions.
    - **Scheduling**: `pg_cron` + `pg_net` extensions on Supabase invoke the `trial-cron` Edge Function every 30 minutes (job `trial-cron-every-30min`). The function accepts two bearer tokens (defense-in-depth): the auto-injected `SUPABASE_SERVICE_ROLE_KEY` and a custom `TRIAL_CRON_SECRET` Edge Function secret. The custom secret is stored in Supabase Vault as `trial_cron_secret` and read by the cron at runtime via `vault.decrypted_secrets` — this decoupling keeps the cron working even if the platform silently rotates the auto-injected service role key. Migration: `supabase/migrations/20260501_trial_cron_schedule.sql`. The cron only processes leads with `cohort='v2'`; legacy `v1` leads are intentionally excluded.
- **Landing Page (LP Shark 100% Green)**: A rebranded landing page (`/trial`) with a luxury dark-green aesthetic, multiple CTAs for trial signup, free groups, and direct purchase, all tracking events for conversion analytics.
- **Data Cohorting**: Implements a 'v1'/'v2' cohort system to manage distinct user groups, particularly for handling legacy data without affecting active trial flows.

## External Dependencies
- **Supabase**: Primary database, authentication, and realtime services. Utilizes multiple Supabase instances for different data domains (main data, procedures).
- **Telegram Bot API**: For managing trial leads, sending direct messages, handling group invites, and processing `chat_member` webhooks.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: UI component library.
- **react-router-dom**: Declarative routing for React.
- **framer-motion**: Animation library for React.
- **@tanstack/react-query**: Data fetching and caching library.
- **date-fns**: JavaScript date utility library.
- **Lastlink**: External checkout platform integrated for subscription payments and coupon application.