# BetShark Pro

## Overview
BetShark Pro is a real-time odds monitoring application for sports betting. Its purpose is to provide users with comprehensive tools for managing and analyzing sports betting odds. Key capabilities include a dashboard for real-time data, detailed match information, procedure control, subscription management, and tools for betting affiliates. The project aims to offer a robust and user-friendly platform for sports bettors, enhancing their decision-making process and overall betting experience.

## User Preferences
- Language: Portuguese (Brazilian) - all UI text is in Portuguese
- Dark theme preferred (default)
- UI style: "Instagrammable" — neon accents, glassmorphism, gradient text, animated elements

## System Architecture
The application is built with a modern web stack. The frontend utilizes React 18, TypeScript, and Vite, styled with Tailwind CSS and shadcn/ui components for a consistent and responsive user interface. Navigation is handled by `react-router-dom v6` with animated transitions powered by `framer-motion`. State management employs `@tanstack/react-query` for server-side data and React Context for authentication. A dark mode theme is enabled by default using `next-themes`.

The UI/UX design emphasizes a "luxury dark-green aesthetic" with neon accents, glassmorphism, gradient text, and animated elements. Specific design components include:
- **Fonts**: Inter + Space Grotesk (sans) and JetBrains Mono (mono).
- **Color Palette**: Primary neon green (`hsl(145 80% 48%)`) against a deep navy background (`hsl(222 20% 5%)`) with radial green glows.
- **Utility Classes**: Custom classes like `gradient-text`, `glow-primary`, `glass`, and various animation utilities.
- **Consistent Layout**: Page headers feature an icon badge, title, and subtitle. A sidebar includes a gradient logo mark with a live pulse dot and color-coded navigation icons.
- **Cards**: Feature colored gradient stat cards with matching border accents.

The system incorporates a Telegram integration for trial management. This includes a workflow for user onboarding, automated direct messages for reminders, and optional integration with a bonus Telegram group. A cohort system (`v1`/`v2`) is implemented for managing different user groups. Operational resilience features include a diagnostic tool for Telegram integration, manual lead linking, and structured logging for webhook events.

## External Dependencies
- **Supabase**: Used for authentication, database services, and real-time functionalities. The application connects to multiple Supabase instances for main data and procedures data.
- **Telegram Bot API**: Utilized for managing trial users, sending notifications, creating invite links, and handling `chat_member` webhooks.
- **Lastlink**: Integrated for handling checkout processes and applying coupon codes for trial upgrades.
- **Vite**: The frontend build tool.
- **npm**: Package manager for project dependencies.