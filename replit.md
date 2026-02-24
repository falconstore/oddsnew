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

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred
