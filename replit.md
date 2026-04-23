# BetShark Pro

## Overview
BetShark Pro is a real-time odds monitoring application for sports betting. It offers features like dashboard views, detailed match information, procedure control, subscription management, betting affiliate tools (BetBra), and administrative panels. The project aims to provide a sophisticated and engaging platform for sports betting enthusiasts, leveraging real-time data and a visually appealing interface.

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred (default)
- UI style: "Instagrammable" — neon accents, glassmorphism, gradient text, animated elements

## System Architecture
The application is built with a modern web stack.
- **Frontend**: React 18 with TypeScript and Vite, styled using Tailwind CSS and shadcn/ui components. Routing is handled by react-router-dom v6 with animated transitions powered by framer-motion. State management utilizes @tanstack/react-query for server-side state and React Context for authentication. The application defaults to a dark mode theme managed by next-themes.
- **Backend**: Leverages external Supabase instances for authentication, database, and real-time functionalities.
- **UI/UX Decisions**: The design system incorporates Inter and Space Grotesk fonts, with JetBrains Mono for monospaced text. The primary color is a neon green (`hsl(145 80% 48%)`) against a deep navy background (`hsl(222 20% 5%)`) with radial green glow effects. Custom utility classes are used for `gradient-text`, `glow-primary`, `glass`, `stat-green/cyan/amber/purple/pink`, `animate-fade-in-up`, `animate-pulse-glow`, and `card-hover`. Page headers feature consistent icon badges, titles, and subtitles. The sidebar includes a gradient logo mark with a live pulse dot and color-coded navigation icons. Cards are designed as colored gradient stat cards with matching border accents.
- **Trial Telegram System**: A robust Telegram integration manages user trials. It forces users to interact with a bot before joining groups, captures `telegram_user_id` for direct messaging, and sends automated 24h and 1h expiration reminders with checkout links and editable coupon codes. The system supports two Telegram groups (VIP odds and a bonus "Student Area") with separate invite links and join/leave tracking. It includes anti-repeat mechanisms for `telegram_user_id`, comprehensive diagnostics, and manual linking/purging capabilities. Structured logs are emitted for debugging.
- **Landing Page (LP Shark 100% Green)**: A dedicated landing page (`/trial`) branded as "Shark 100% Green" uses a luxury dark-green aesthetic. It features three main CTAs: "Quero testar 7 Dias" (leading to a signup form), "Acessar Grupos Free", and "Compre Agora". It includes storytelling sections and tracks all CTA clicks and page views for conversion statistics.
- **Project Structure**: Components are organized into reusable UI elements, BetBra affiliates, entity management, login effects, procedures, and subscriptions. Contexts, custom hooks, Supabase integrations, utility functions, and type definitions are systematically organized.

## External Dependencies
- **Supabase**: Utilized for authentication, database services, and real-time features across multiple instances:
    - Main instance for auth and primary data.
    - Secondary instance for additional data.
    - Dedicated instance for procedures data.
- **Telegram Bot API**: Used for managing trial users, sending direct messages, handling group joins/leaves, and generating invite links.
- **Lastlink**: Integrated for checkout processes, applying coupons automatically through URL parameters.
- **pg_cron**: Used for scheduling daily tasks, specifically for trial expiration and reminder DMs.
- **date-fns**: A utility library for date manipulation, used in the trial diagnostics for formatting timestamps.