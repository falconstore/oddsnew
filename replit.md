# BetShark Pro

## Overview
BetShark Pro is a real-time odds monitoring application for sports betting. It provides a comprehensive, real-time sports betting odds platform with a focus on user engagement and conversion through a sophisticated trial system. Key features include dashboard views, detailed match information, procedure control, subscriptions, betting affiliate tools, and administrative panels. The project aims to deliver a high-value product to the sports betting market.

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred (default)
- UI style: "Instagrammable" — neon accents, glassmorphism, gradient text, animated elements

## System Architecture
- **Frontend**: Built with React 18, TypeScript, and Vite, styled using Tailwind CSS and shadcn/ui. State management is handled by `@tanstack/react-query` for server state and React Context for authentication. Routing uses `react-router-dom v6` with `framer-motion` for animated transitions.
- **Backend**: Leverages Supabase for authentication, database, and real-time functionalities. Supabase Edge Functions manage business logic and integrations.
- **UI/UX Design**: Features a dark mode with a deep navy background, neon green primary color (`hsl(145 80% 48%)`), and radial green glow effects. Typography uses Inter, Space Grotesk, and JetBrains Mono. Custom utility classes enhance dynamic and engaging aesthetics. Layouts include consistent page headers and a sidebar with a gradient logo and color-coded navigation.
- **Trial Telegram System**: Manages lead acquisition and trial activation via Telegram. It includes forced bot interaction, automated expiration reminders, an optional "bonus" Telegram group, and an anti-repeater mechanism. It supports "Paid Re-entry" for users re-added via external links and provides an admin panel for lead management. The system uses `pg_cron` and `pg_net` for scheduling background tasks like `runLinkGc` to revoke expired invite links. This system specifically cohorts leads into 'v1' and 'v2' groups, with the cron processing only 'v2' leads.
- **Landing Page (LP Shark 100% Green)**: A rebranded landing page (`/trial`) with a luxury dark-green aesthetic, multiple CTAs for trial signup, free groups, and direct purchase, all tracking events for conversion analytics.
- **Procedimentos (FreeBet Pro Parity)**: The `/procedure-control` panel is fully integrated with FreeBet Pro, including public endpoint synchronization. It handles procedure creation, updates, archiving, and result definition, with specific logic for syncing data to the FreeBet Pro platform. The system uses a "best-effort" approach for synchronization, ensuring the main application flow is not blocked by external API calls.
- **Production Hosting**: Deployed using `autoscale` to support SPA fallback, serving `dist/` with `node server.cjs`. The server handles static files, provides `index.html` fallback for deep links, and uses appropriate caching headers.
- **Realtime & UI Stability**: Implements debouncing on `useRealtimeSubscription` to coalesce events and prevent UI flickering. `placeholderData` is applied selectively to large data lists (`useTrialLeads`, `useLastlinkPayments`, etc.) to maintain UI context during refetches.

## External Dependencies
- **Supabase**: Primary database, authentication, and real-time services across multiple instances.
- **Telegram Bot API**: Used for lead management, direct messaging, group invites, and webhook processing.
- **Vite**: Frontend build tool.
- **Tailwind CSS**: Utility-first CSS framework.
- **shadcn/ui**: UI component library.
- **react-router-dom**: Routing library.
- **framer-motion**: Animation library.
- **@tanstack/react-query**: Data fetching and caching.
- **date-fns**: JavaScript date utility library.
- **Lastlink**: External checkout platform for subscription payments and coupons. Integrated via `lastlink-webhook` Edge Function to process postback events, update payment and subscription statuses, and populate detailed buyer and tracking data. An admin page (`/lastlink-admin`) provides comprehensive analytics and management for Lastlink payments and events.
- **track4you**: Third-party performance and conversion tracking pixel.