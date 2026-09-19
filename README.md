# Roll Book 📖

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Roll Book** is an intelligent, multi-user university attendance tracker, forecasting lab, and academic trajectory management suite designed with a strict principle: **never assume a lecture happened just because the timetable says it should have.**

Built with Next.js 16 App Router, React 19, Prisma, PostgreSQL (Neon-ready for serverless deployment on Vercel), and Google Gemini AI.

---

## 🌟 Core Highlights

1. **Strict Per-User Data Isolation**: Each friend has their own private account. Courses, timetable schedules, attendance logs, and personal sync tokens are strictly isolated per user. Cross-account mutations and queries are rejected with `403 Forbidden`.
2. **Shared College-Wide Academic Calendar**: Holidays, recesses, and term exam periods are institution-wide and apply across every department and section (e.g. C01–C22) as a single academic calendar. Maintained centrally by administrators and visible in real-time read-only mode to all students.
3. **Dedicated Admin Console (`/admin`)**: Administrators can manage the shared holiday calendar, inspect user accounts and attendance baselines, perform per-user data resets, and permanently delete accounts with typed-username safety confirmations.
4. **Authentic Actual Mode**: Attendance statistics are derived *strictly* from verified portal snapshots and confirmed manual logs. Unlogged dates remain unlogged—never silently assumed or blended into statistics.
5. **Predictive Planning Mode**: Driven by your recurring weekly timetable, allowing you to simulate *Plan to Attend* and *Plan to Skip* choices into the future and visualize your projected percentage trajectory without corrupting your verified history.
6. **Zero-Install Browser Bookmarklet & Reverse-Push Sync**: Sync attendance directly from your browser with a 1-click drag-and-drop bookmarklet (`javascript:...`) running inside your logged-in SLCM tab, or use the desktop CLI runner (`scraper/agent.js`). Securely pushes live attendance figures to `/api/sync/push` with seamless fallback for CSP-restricted environments (`/api/sync/paste`).
7. **AI Attendance Advisor (Google Gemini Free Tier)**: Built-in intelligent advisor powered by `@google/genai` (`gemini-flash-latest`) with deterministic database tools—querying summaries, course details, unlogged classes, upcoming schedules, and managing calendar events directly without hallucinations. Features per-user daily rate limiting to protect shared free tier limits.
8. **Compound Multi-Tenant Uniqueness**: Users can register identical subject codes (e.g. `MAT101`) without unique constraint collisions.
9. **Playful Geometric Design System (Dual Light/Dark Mode)**: High-contrast neo-brutalist sticker styling with Electric Teal primary accents (`#0D9488` light / `#2DD4BF` dark), chunky 2px borders, hard offset shadows, bouncy Framer Motion micro-interactions, Outfit display font, and instant theme switching via `next-themes`.
10. **1-Click Section Onboarding**: Automatically imports all subjects and weekly timetable schedules for 22 MIT Bengaluru CSE Stream sections (`C01`–`C22`).
11. **Mobile-First Smartphone Experience**: Tailored for iPhone and Android mobile browsers featuring a thumb-friendly docked bottom navigation bar, dynamic safe-area insets (`env(safe-area-inset-bottom)`), responsive SVG progress rings, and a fully accessible mobile Sync & Import section for section onboarding and SLCM sync token management.
12. **Standardized 12-Hour AM/PM & DD/MM/YYYY Format**: Unified time (`h:mm am/pm`) and date (`DD/MM/YYYY`) formatting across all dashboard flight schedules, timetable slots, calendar day inspectors, modals, and Gemini AI assistant responses.
13. **Deterministic Math Engine**: Computes exact skippable buffers (how many classes you can afford to miss) or mandatory recovery streaks (how many consecutive attendances you need to restore compliance).
14. **Zero-Cost Hosting Ready**: Architected for free-tier hosting on **Vercel** with a free serverless PostgreSQL database from **Neon**.

---

## 📚 Documentation Index

- 🚀 **[Vercel & Neon Free Deployment Guide](DEPLOYMENT.md)**: Complete step-by-step walkthrough to host Roll Book on Vercel with Neon PostgreSQL for free.
- 🏛️ **[System Architecture & Data Engine](docs/ARCHITECTURE.md)**: Deep dive into the database schema, multi-user auth, API specifications, and data scoping.
- 📐 **[Mathematical Formulations & Proofs](docs/FORMULAS.md)**: Mathematical derivations and proofs for Safe Zone skippable margins, recovery streaks, and projected trajectory simulations.
- 🤖 **[SLCM 2.0 Scraper & Bridge Guide](docs/SLCM_SCRAPER_GUIDE.md)**: Complete guide on Salesforce Experience Cloud authentication, multi-semester Apex response interception, and troubleshooting.

---

## 📐 Mathematical Formulation

All attendance calculations use these verified formulas:

$$\text{Attendance \%} = \frac{P_{\text{synced}} + P_{\text{manual}}}{(P_{\text{synced}} + P_{\text{manual}}) + (A_{\text{synced}} + A_{\text{manual}})} \times 100$$

### 1. Safe Zone ($\text{Percentage} \ge \text{Required \%}$)
Calculates the exact number of future consecutive classes you can safely skip without dropping below your target threshold $R = \frac{\text{Required}}{100}$:

$$\text{Max Skippable Classes} = \left\lfloor \frac{P}{R} - \text{Total Held} \right\rfloor$$

### 2. Recovery Zone ($\text{Percentage} < \text{Required \%}$)
Calculates the exact number of future consecutive classes you must attend to restore your standing to $R = \frac{\text{Required}}{100}$:

$$\text{Must Attend Next} = \left\lceil \frac{R \times \text{Total Held} - \text{Present}}{1 - R} \right\rceil$$

---

## 🚀 Quickstart (Local Development)

### 1. Prerequisites
- Node.js `18.x` or later (tested on Node v22)
- PostgreSQL database (local, Docker, or Neon free tier)
- npm / pnpm / yarn

### 2. Clone & Install
```bash
git clone https://github.com/bleedingedge121/rollbook.git
cd rollbook
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set your environment variables in `.env`:
```env
# PostgreSQL connection string (Local or Neon)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rollbook?schema=public"

# Secret used to sign HMAC SHA-256 session tokens (any long random string)
APP_SESSION_SECRET="your-random-32-char-secret-string"

# Google Gemini API Key (Free from https://aistudio.google.com)
GEMINI_API_KEY="your-gemini-api-key"

# Scraper allowed origin (defaults to http://localhost:3000)
AGENT_ALLOWED_ORIGIN="http://localhost:3000"
```

### 4. Sync Database Schema
```bash
npx prisma db push
```

### 5. Start Application & Sync Bridge
In Terminal 1 (Next.js App):
```bash
npm run dev
```

In Terminal 2 (Local SLCM Scraper Bridge):
```bash
npm run scraper:agent
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser. Click **Sign Up** to create your personal account!

### 6. Administrator Access & Management
- **Automatic Admin**: The very first registered user, or any account created with the username `admin`, is automatically granted the `admin` role upon registration.
- **Manual CLI Promotion**: You can promote any existing user to administrator with:
  ```bash
  npx tsx scripts/make-admin.ts <username>
  ```
- **Password Resets**: To set or reset a user's password directly from the terminal:
  ```bash
  npx tsx scripts/set-password.ts <username> <new-password>
  ```
Once promoted or signed in as admin, a **Shield** icon appears in the top navigation bar, granting access to the **Admin Console** (`/admin`) for:
- Declaring and modifying global university calendar holidays & exam ranges.
- Viewing the user directory, registered courses, and last portal sync timestamps.
- Inspecting student courses and attendance baselines without needing their passwords.
- Wiping corrupted/test course records and resetting AI rate limit quotas.
- Permanently deleting user accounts with typed-confirmation safeguards.

---

## ☁️ Deploying to Vercel (100% Free)

Roll Book can be hosted permanently for free using:
1. **Neon** (`neon.tech`): Free tier provides 512MB PostgreSQL storage with automatic connection pooling.
2. **Vercel** (`vercel.com`): Free Hobby tier hosts Next.js applications with zero server maintenance.
3. **Google AI Studio** (`aistudio.google.com`): Free Gemini API key with generous daily quota.

👉 Follow the full **[DEPLOYMENT.md](DEPLOYMENT.md)** guide for step-by-step instructions.

---

## 🤖 Live SLCM Scraper Workflow (Reverse-Push)

Because MAHE SLCM requires Microsoft MFA and modern browsers block HTTPS web pages from calling local machine ports, Roll Book uses a **reverse-push architecture**:

```bash
cd scraper
npm install
npx playwright install chromium
node agent.js
```

### How It Works:
1. **Generate Token**: In Roll Book, go to **Settings** $\rightarrow$ **SLCM Sync Bridge** and click **Generate My Sync Token**. Copy the token.
2. **Run Pusher**: Run `node agent.js`. On first run, it prompts for your app URL (e.g. `https://rollbook.vercel.app`) and your token, saving them to `scraper/.env`.
3. **MFA Login**: If needed, a browser window opens for you to log in with your student Microsoft credentials and approve MFA.
4. **Push & Refresh**: The script captures your verified attendance tables and immediately pushes them to your account. Refresh your dashboard to see your updated numbers!

### Manual Fallback:
If you prefer running manual commands:
- Login: `cd scraper && node login.js`
- Sync: `node sync.js`
- Upload: In Settings, click *"Upload sync-output.json manually"*.

---

## 📁 Project Structure

```
RollBook/
├── docs/
│   ├── ARCHITECTURE.md       # Architecture, Prisma models, auth, and API specs
│   ├── FORMULAS.md           # Mathematical models and boundary proofs
│   └── SLCM_SCRAPER_GUIDE.md # Salesforce Aura interception guide
├── prisma/
│   ├── schema.prisma         # Multi-tenant PostgreSQL Prisma schema
│   └── seed.js               # Sample semester seed script
├── scripts/
│   ├── make-admin.ts         # CLI tool to promote users to administrator
│   ├── set-password.ts       # CLI tool to set/reset user passwords
│   ├── test-admin-and-holidays.ts # Test suite for admin role & global calendar
│   ├── test-multiuser-isolation.ts # Automated cross-tenant security test suite
│   └── test-push-sync.ts     # Test suite for personal sync tokens & reverse push
├── scraper/
│   ├── agent.js              # Desktop reverse-push CLI runner (supports auto-token)
│   ├── login.js              # Modular SSO/MFA Playwright login
│   ├── sync.js               # Modular headless getCOPList response listener
│   └── package.json          # Scraper dependencies
├── src/
│   ├── app/
│   │   ├── admin/            # Dedicated Admin Management Console (/admin)
│   │   ├── api/
│   │   │   ├── admin/        # Admin directory, user inspect, reset & delete
│   │   │   ├── attendance/   # Scoped attendance records CRUD & batch logger
│   │   │   ├── auth/         # Login, signup, logout, session check, sync token
│   │   │   ├── chat/         # Google Gemini AI Attendance Advisor (7 tools, quota protected)
│   │   │   ├── courses/      # Scoped course management
│   │   │   ├── export/       # Scoped CSV and JSON backup/restore
│   │   │   ├── holidays/     # Shared global university academic calendar
│   │   │   ├── reset/        # Per-user database reset
│   │   │   ├── sections/     # Official department section schedules
│   │   │   ├── sync/         # Scoped SLCM sync, reverse push, paste fallback & reconciliation
│   │   │   └── timetable/    # Scoped weekly slot management
│   │   ├── login/            # Dual-mode Sign In / Sign Up page
│   │   ├── globals.css       # Neo-brutalist design tokens & CSS variables
│   │   ├── layout.tsx        # Shell with Outfit and Plus Jakarta Sans fonts
│   │   └── page.tsx          # App orchestrator
│   ├── components/           # UI views, modals, bottom nav dock & chat widget
│   ├── lib/
│   │   ├── attendance.ts     # Deterministic math engine
│   │   ├── auth.ts           # Web Crypto session tokens & bcrypt password hashing
│   │   ├── bookmarklet.ts    # Client-side SLCM Aura interceptor bookmarklet generator
│   │   ├── courseMatch.ts    # Normalized & fuzzy course matcher
│   │   ├── formatters.ts     # 12hr am/pm & dd/mm/yyyy date/time formatters
│   │   ├── officialTimetable.ts # 22 section schedules (C01-C22)
│   │   ├── prisma.ts         # Prisma Client singleton
│   │   ├── session.ts        # requireUser, requireAdmin & verifyCourseOwnership
│   │   └── useIsMobile.ts    # Dynamic device detection & viewport media query hook
│   ├── middleware.ts         # Edge session protection middleware
│   └── types/
│       └── index.ts          # Shared TypeScript types
├── DEPLOYMENT.md             # Vercel & Neon free deployment guide
└── package.json
```

---

## 📄 License

MIT License. Designed and crafted with precision.
