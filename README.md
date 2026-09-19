# Roll Book 📖

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?style=flat-square&logo=playwright)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Roll Book** is an intelligent attendance tracker, forecasting lab, and academic trajectory management suite designed with a strict principle: **never assume a lecture happened just because the timetable says it should have.**

---

## 🌟 Core Highlights

1. **Authentic Actual Mode**: Attendance statistics are derived *strictly* from verified portal snapshots and confirmed manual logs. Unlogged dates remain unlogged—never silently assumed or blended into statistics.
2. **Predictive Planning Mode**: Driven by your recurring weekly timetable, allowing you to simulate *Plan to Attend* and *Plan to Skip* choices into the future and visualize your projected percentage trajectory (rendered with dashed indicators and trend curves) without corrupting your verified history.
3. **1-Click Live SLCM Attendance Sync**: Native local scraper bridge (`scraper/agent.js` on `http://localhost:4747`). Click "Sync Now" in the UI and Roll Book talks to the local agent, executes the Playwright session, and reconciles courses directly without manual file picking.
4. **Playful Geometric Design System (Dual Light/Dark Mode)**: High-contrast neo-brutalist sticker styling with Electric Teal primary accents (`#0D9488` light / `#2DD4BF` dark), chunky 2px borders, hard offset shadows, bouncy Framer Motion micro-interactions, Outfit display font, and instant theme switching via `next-themes`.
5. **AI Attendance Advisor (Google Gemini Free Tier)**: Built-in intelligent chatbot powered by `@google/genai` (Gemini 2.5 Flash) with deterministic function/tool calling directly into SQLite data—never hallucinating numbers.
6. **1-Click Batch Actions**: Fast bulk marking for today's lectures, past backlog audit items, and future planning days with a single tap.
7. **Holiday & Exam Declaration Engine**: Built-in calendar registry for official university recesses and examination days with automatic exclusion from past unlogged audits and future class simulations.
8. **Deterministic Math Engine**: Computes exact skippable buffers (how many classes you can afford to miss) or mandatory recovery streaks (how many consecutive attendances you need to restore compliance).
9. **1-Click Section Onboarding**: Automatically imports all subjects and weekly timetable schedules for 22 MIT Bengaluru CSE Stream sections (`C01`–`C22`).
10. **Local Single-Account Auth**: Protected by Web Crypto HMAC-SHA256 session middleware with out-of-the-box local credentials.
11. **Local-First & Portable**: Powered by SQLite via Prisma with zero external cloud dependencies. Full CSV exports and JSON backup/restore built in.

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
GEMINI_API_KEY=your-gemini-api-key-here
```

### 4. Start Development Server & Local Sync Agent
In terminal 1 (Next.js App):
```bash
npm run dev
```

In terminal 2 (Local SLCM Sync Bridge):
```bash
npm run scraper:agent
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser and sign in with **`admin`** / **`rollbook`**.

---

## 🧭 First-Time Setup & Onboarding

If your database is empty, the **Onboarding Wizard** will appear automatically:
1. Tap **"Choose My Section"**.
2. Select your section (e.g. **`C06`**).
3. Confirm—your subjects and weekly schedule will be populated instantly.
4. Tap **"Sync Now (1-Click)"** to immediately pull your verified attendance baseline from SLCM.

---

## 🤖 1-Click SLCM Scraper Workflow

The scraper runs as a lightweight local HTTP daemon (`scraper/agent.js`) on port `4747`:

```bash
cd scraper
npm install
npx playwright install chromium
node agent.js
```

### 1. 1-Click Sync (Recommended)
Inside Roll Book, navigate to **Settings** $\rightarrow$ **SLCM Sync Bridge** and click **Sync Now (1-Click)**.
- If it's your first time or your session expired, a visible browser will open automatically for Microsoft SSO / MFA.
- Once authenticated, it headlessly intercepts the `getCOPList` Apex payload, reconciles courses with your database, and presents the diff modal.

### 2. Manual CLI Fallback
If you prefer running manual commands:
- Login: `cd scraper && node login.js`
- Sync: `node sync.js`
- Upload: In Settings, click *"Advanced: upload sync-output.json manually"*.

---

## 📁 Project Structure

```
RollBook/
├── docs/
│   ├── ARCHITECTURE.md       # Architecture, Prisma models, auth, and API specs
│   ├── FORMULAS.md           # Mathematical models and boundary proofs
│   └── SLCM_SCRAPER_GUIDE.md # Salesforce Aura interception guide
├── prisma/
│   ├── schema.prisma         # Course, TimetableSlot, AttendanceRecord, Holiday models
│   └── seed.js               # Sample semester seed data
├── scraper/
│   ├── agent.js              # Local HTTP bridge server (http://localhost:4747)
│   ├── login.js              # Modular SSO/MFA Playwright login
│   ├── sync.js               # Modular headless getCOPList response listener
│   ├── package.json          # Scraper dependencies
│   └── README.md             # Scraper quickstart
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── attendance/   # Attendance record CRUD & bulk logger
│   │   │   ├── auth/         # Login, logout, session check
│   │   │   ├── chat/         # Google Gemini AI Attendance Advisor
│   │   │   ├── courses/      # Subject management
│   │   │   ├── export/       # CSV and JSON backup/restore
│   │   │   ├── holidays/     # Holiday and exam-day registry
│   │   │   ├── reset/        # Full database atomic reset
│   │   │   ├── sections/     # Official department section schedules
│   │   │   ├── sync/         # SLCM reconciliation diff engine
│   │   │   └── timetable/    # Weekly slot management
│   │   ├── login/            # High-contrast login page
│   │   ├── globals.css       # Playful Geometric design tokens & CSS variables
│   │   ├── layout.tsx        # Shell with Outfit and Plus Jakarta Sans fonts
│   │   └── page.tsx          # App orchestrator
│   ├── components/
│   │   ├── Navigation.tsx    # Header, stats badge, theme switcher, and sign-out
│   │   ├── HomeView.tsx      # Dashboard with Today's schedule and past audit
│   │   ├── SubjectsView.tsx  # Cards, sparklines & audit trail
│   │   ├── CalendarView.tsx  # Month matrix & live planning simulator
│   │   ├── SettingsView.tsx  # Timetable editor, 1-click sync bridge, reset
│   │   ├── ChatWidget.tsx    # Google Gemini AI Attendance Advisor widget
│   │   ├── OnboardingWizard.tsx # 1-click section setup flow with SLCM sync prompt
│   │   ├── CourseModal.tsx
│   │   ├── SlotModal.tsx
│   │   ├── SectionImportModal.tsx # Department timetable selector
│   │   ├── SyncModal.tsx     # SLCM diff & merge selector
│   │   └── ThemeProvider.tsx # next-themes client provider
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
