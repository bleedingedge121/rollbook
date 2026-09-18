# Roll Book 📖

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Roll Book** is an attendance tracker and planning engine designed with a strict principle: **never assume a lecture happened just because the timetable says it should have.**

---

## 🌟 Core Highlights

1. **Authentic Actual Mode**: Attendance statistics are derived *strictly* from verified portal snapshots and confirmed manual logs. Unlogged dates remain unlogged—never silently assumed or blended into statistics.
2. **Predictive Planning Mode**: Driven by your recurring weekly timetable, allowing you to simulate *Plan to Attend* and *Plan to Skip* choices into the future and visualize your projected percentage trajectory (rendered with dashed indicators and trend curves) without corrupting your verified history.
3. **Tactical Dark UI & Framer Motion**: Aviation/cybernetic telemetry theme with spring transitions, active pill navigation markers, glowing radar gauges, and tactile micro-interactions.
4. **1-Click Batch Actions**: Fast bulk marking for today's lectures, past backlog audit items, and future planning days with a single tap.
5. **Holiday & Exam Declaration Engine**: Built-in calendar registry for official university recesses and examination days with automatic exclusion from past unlogged audits and future class simulations.
6. **Deterministic Math Engine**: Computes exact skippable buffers (how many classes you can afford to miss) or mandatory recovery streaks (how many consecutive attendances you need to restore compliance).
7. **1-Click Section Onboarding**: Automatically imports all subjects and weekly timetable schedules for 22 MIT Bengaluru CSE Stream sections (`C01`–`C22`).
8. **MAHE SLCM 2.0 Bridge**: A Playwright-based Salesforce response interceptor that synchronizes verified attendance counts directly from MAHE's portal without hardcoding volatile tokens.
9. **Local Single-Account Auth**: Protected by Web Crypto HMAC-SHA256 session middleware with out-of-the-box local credentials.
10. **Local-First & Portable**: Powered by SQLite via Prisma with zero external cloud dependencies. Full CSV exports and JSON backup/restore built in.

---

## 📚 In-Depth Documentation

- 🏛️ **[System Architecture & Data Engine](docs/ARCHITECTURE.md)**: Deep dive into the database schema, auth middleware, actual vs. planning mode separation, and API specifications.
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

*(If $R = 100\%$ and any class has been missed, the system cleanly identifies that $100\%$ is mathematically unachievable rather than crashing.)*

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `18.x` or later (tested on Node v22)
- npm / pnpm / yarn

### 2. Installation & Setup
```bash
# Clone the repository
git clone https://github.com/bleedingedge121/rollbook.git
cd rollbook

# Install dependencies
npm install

# Push SQLite schema
npx prisma db push
```

### 3. Environment Configuration
Create or verify your `.env` file (optional; default credentials work automatically):
```env
DATABASE_URL="file:./dev.db"
APP_USERNAME=admin
APP_PASSWORD=rollbook
APP_SESSION_SECRET=change-this-to-a-long-random-string
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser and sign in with **`admin`** / **`rollbook`**.

---

## 🧭 First-Time Setup & Onboarding

If your database is empty, the **Onboarding Wizard** will appear automatically:
1. Tap **"Get Started"**.
2. Select your section (e.g. **`C06`**).
3. Confirm—your 10 subjects and weekly schedule will be populated instantly.

---

## 🤖 SLCM Scraper Workflow

The scraper lives independently in `/scraper`:

```bash
cd scraper
npm install
npx playwright install chromium
```

### 1. One-Time Login (or when session expires)
```bash
node login.js
```
A browser window will open. Complete your MAHE Microsoft SSO and MFA login. Once redirected to `/s/attendance`, your authenticated session state is saved to `auth.json`.

### 2. Pull Live Attendance Numbers
```bash
node sync.js
```
Headlessly captures the `getCOPList` Apex action, unwraps the nested Salesforce envelope, discards telemetry noise, and writes `sync-output.json`.

### 3. Import into Roll Book
- Open Roll Book $\rightarrow$ **Settings & Sync** $\rightarrow$ **SLCM Sync Bridge**.
- Click **Load Synced Data (JSON)** and select `scraper/sync-output.json`.
- Review the reconciliation diff and choose your course merge mappings before confirming.

---

## 📁 Project Structure

```
RollBook/
├── docs/
│   ├── ARCHITECTURE.md       # Architecture, Prisma models, auth, and API specs
│   ├── FORMULAS.md           # Mathematical models and boundary proofs
│   └── SLCM_SCRAPER_GUIDE.md # Salesforce Aura interception guide
├── prisma/
│   ├── schema.prisma         # Course, TimetableSlot, AttendanceRecord models
│   └── seed.js               # Sample semester seed data
├── scraper/
│   ├── login.js              # Interactive SSO/MFA Playwright login
│   ├── sync.js               # Headless getCOPList response listener
│   ├── package.json          # Scraper dependencies
│   └── README.md             # Scraper quickstart
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── attendance/   # Attendance record CRUD
│   │   │   ├── auth/         # Login, logout, session check
│   │   │   ├── courses/      # Subject management
│   │   │   ├── export/       # CSV and JSON backup/restore
│   │   │   ├── reset/        # Full database atomic reset
│   │   │   ├── sections/     # Official department section schedules
│   │   │   ├── sync/         # SLCM reconciliation diff engine
│   │   │   └── timetable/    # Weekly slot management
│   │   ├── login/            # Dark-theme login page
│   │   ├── globals.css       # Design tokens & theme
│   │   ├── layout.tsx        # Shell
│   │   └── page.tsx          # App orchestrator
│   ├── components/
│   │   ├── Navigation.tsx    # Header, stats badge, and sign-out
│   │   ├── HomeView.tsx      # Dashboard with Today's Quick Logger
│   │   ├── SubjectsView.tsx  # Cards, sparklines & audit trail
│   │   ├── CalendarView.tsx  # Month matrix & live planning simulator
│   │   ├── SettingsView.tsx  # Timetable editor, sync bridge, reset
│   │   ├── OnboardingWizard.tsx # 1-click section setup flow
│   │   ├── CourseModal.tsx
│   │   ├── SlotModal.tsx
│   │   ├── SectionImportModal.tsx # Department timetable selector
│   │   └── SyncModal.tsx     # SLCM diff & merge selector
│   ├── lib/
│   │   ├── attendance.ts     # Deterministic math engine
│   │   ├── auth.ts           # HMAC-SHA256 Web Crypto session token helpers
│   │   ├── courseMatch.ts    # Normalized & fuzzy course matcher
│   │   ├── officialTimetable.ts # 22 section schedules (C01-C22)
│   │   └── prisma.ts         # Prisma Client singleton
│   ├── middleware.ts         # Edge session protection middleware
│   └── types/
│       └── index.ts          # Shared TypeScript types
└── package.json
```

---

## 📄 License

MIT License. Designed and crafted with precision.
