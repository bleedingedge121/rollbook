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

1. **Actual Mode (Past + Today)**: Attendance percentages are derived *strictly* from confirmed present and absent records. Unlogged past dates are just unlogged—never silently assumed or blended into statistics.
2. **Planning Mode (Future Calendar)**: Driven by your recurring weekly timetable, allowing you to simulate *Plan to Attend* and *Plan to Skip* choices into the future and visualize your projected percentage trajectory (rendered with dashed indicators and trend curves) without corrupting your verified history.
3. **Deterministic Math Engine**: Computes exact skippable buffers (how many classes you can afford to miss) or mandatory recovery streaks (how many consecutive attendances you need to restore compliance).
4. **MAHE SLCM 2.0 Bridge**: A Playwright-based Salesforce response interceptor that synchronizes verified attendance counts directly from MAHE's portal without hardcoding volatile tokens.
5. **Local-First & Portable**: Powered by SQLite via Prisma with zero external cloud dependencies. Full CSV exports and JSON backup/restore built in.

---

## 📚 In-Depth Documentation

- 🏛️ **[System Architecture & Data Engine](docs/ARCHITECTURE.md)**: Deep dive into the database schema, actual vs. planning mode separation, and API design.
- 📐 **[Mathematical Formulations & Proofs](docs/FORMULAS.md)**: Proofs for Safe Zone skippable margins, recovery streaks, and projected trajectory simulations.
- 🤖 **[SLCM 2.0 Scraper & Bridge Guide](docs/SLCM_SCRAPER_GUIDE.md)**: Complete guide on Salesforce Experience Cloud authentication, Apex response interception, and troubleshooting.

---

## 📐 Mathematical Formulation

All attendance logic across the entire platform uses these verified formulas:

$$\text{Attendance \%} = \frac{\text{Present}}{\text{Present} + \text{Absent}} \times 100$$

### 1. Safe Zone ($\text{Percentage} \ge \text{Required \%}$)
Calculates the exact number of future consecutive classes you can safely skip without dropping below your target threshold $R = \frac{\text{Required}}{100}$:

$$\text{Max Skippable Classes} = \left\lfloor \frac{\text{Present}}{R} - \text{Total Held} \right\rfloor$$

### 2. Recovery Zone ($\text{Percentage} < \text{Required \%}$)
Calculates the exact number of future consecutive classes you must attend to restore your standing to $R = \frac{\text{Required}}{100}$:

$$\text{Must Attend Next} = \left\lceil \frac{R \times \text{Total Held} - \text{Present}}{1 - R} \right\rceil$$

*(If $R = 100\%$ and any class has been missed, the system cleanly identifies that $100\%$ is mathematically unachievable rather than crashing.)*

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js `18.x` or later (tested on Node v22)
- npm / pnpm / yarn

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/bleedingedge121/rollbook.git
cd rollbook

# Install dependencies
npm install
```

### 3. Database Setup
```bash
# Sync SQLite schema
npx prisma db push

# (Optional) Seed realistic sample courses, timetable slots, and logs
npm run db:seed
```

### 4. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🤖 SLCM Scraper Workflow

The scraper lives independently in `/scraper` so the web app never directly executes external host processes:

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
Headlessly listens for the `getCOPList` Apex action, unwraps the nested Salesforce envelope, and writes `sync-output.json`.

### 3. Import into Roll Book
- Open Roll Book web app $\rightarrow$ **Settings & Sync** $\rightarrow$ **SLCM Sync Bridge**.
- Click **Load Synced Data (JSON)** and select `scraper/sync-output.json`.
- Review the side-by-side reconciliation diff and confirm changes.

---

## 📁 Project Structure

```
RollBook/
├── docs/
│   ├── ARCHITECTURE.md       # Architecture, Prisma models, and API specifications
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
│   │   ├── api/              # Courses, Timetable, Attendance, Reconcile, Export APIs
│   │   ├── globals.css       # Modern dark UI theme tokens
│   │   ├── layout.tsx        # Root application shell
│   │   └── page.tsx          # Primary App controller
│   ├── components/
│   │   ├── Navigation.tsx    # Top navigation and status bar
│   │   ├── HomeView.tsx      # Dashboard with Today's Quick Logger
│   │   ├── SubjectsView.tsx  # Subject cards, sparklines & audit trail
│   │   ├── CalendarView.tsx  # Month matrix & live planning simulator
│   │   ├── SettingsView.tsx  # Timetable editor, sync loader, CSV export
│   │   ├── CourseModal.tsx   # Subject creation/editing modal
│   │   ├── SlotModal.tsx     # Timetable slot editor
│   │   └── SyncModal.tsx     # Reconciliation diff & confirmation dialog
│   ├── lib/
│   │   ├── attendance.ts     # Deterministic attendance & projection math
│   │   └── prisma.ts         # Prisma Client singleton
│   └── types/
│       └── index.ts          # Shared TypeScript types
└── package.json
```

---

## 📄 License

MIT License. Designed and crafted with precision.
