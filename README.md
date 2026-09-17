# Roll Book 📖

**Roll Book** is a personal attendance management and planning system designed with a strict principle: **never assume a class happened just because the timetable says it should have.**

It provides two distinct, unpolluted operational modes:
1. **Actual Mode (Past + Today)**: Attendance percentages are derived *strictly* from confirmed present and absent records. Unlogged dates are simply unlogged—never silently counted or assumed.
2. **Planning Mode (Future Calendar)**: Driven by your recurring weekly timetable, allowing you to simulate "Plan to Attend" and "Plan to Skip" choices into the future and visualize your projected percentage trajectory (rendered with dashed indicators and trend curves) without corrupting your verified history.

---

## 🏗️ Architecture & Stack

- **Framework**: Next.js 14 (App Router) + React 18 + TypeScript
- **Styling**: Tailwind CSS + Custom Design System
- **Database**: SQLite via Prisma ORM (local-first, zero cloud latency)
- **Charts & Trajectories**: Recharts
- **Date & Calendar Engine**: date-fns
- **Scraper Subsystem**: Playwright-based Salesforce Apex response interception

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

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database & Seed Sample Data
```bash
# Push schema to SQLite
npx prisma db push

# (Optional) Seed realistic courses, timetable, and sample records
npm run db:seed
```

### 3. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🤖 SLCM Scraper Workflow

The scraper lives independently in `/scraper` so the web app never directly executes external host processes:

### Setup Scraper
```bash
cd scraper
npm install
npx playwright install chromium
```

### Running the Scraper
1. **One-Time Login (or when session expires)**:
   ```bash
   node login.js
   ```
   A browser window will open. Complete your MAHE Microsoft SSO and MFA login. Once redirected to `/s/attendance`, your authenticated session state is saved to `auth.json`.

2. **Pull Live Numbers**:
   ```bash
   node sync.js
   ```
   Headlessly listens for the `getCOPList` Apex action and writes `sync-output.json` with your real attendance numbers.

3. **Import into Roll Book**:
   - Open Roll Book web app $\rightarrow$ **Settings & Sync** $\rightarrow$ **SLCM Sync Bridge**.
   - Click **Load Synced Data (JSON)** and select `scraper/sync-output.json`.
   - Review the side-by-side reconciliation diff and confirm changes.

---

## 📁 Project Structure

```
RollBook/
├── prisma/
│   ├── schema.prisma      # Course, TimetableSlot, AttendanceRecord models
│   └── seed.js            # Sample semester seed data
├── scraper/
│   ├── login.js           # Interactive SSO/MFA Playwright login
│   ├── sync.js            # Headless getCOPList response listener
│   ├── package.json       # Scraper dependencies
│   └── README.md          # Scraper usage notes
├── src/
│   ├── app/
│   │   ├── api/           # Courses, Timetable, Attendance, Reconcile, Export APIs
│   │   ├── globals.css    # Modern dark UI theme tokens
│   │   ├── layout.tsx     # Root application shell
│   │   └── page.tsx       # Primary App controller
│   ├── components/
│   │   ├── Navigation.tsx # Top navigation and status bar
│   │   ├── HomeView.tsx   # Dashboard with Today's Quick Logger
│   │   ├── SubjectsView.tsx # Subject cards, sparklines & audit trail
│   │   ├── CalendarView.tsx # Month matrix & live planning simulator
│   │   ├── SettingsView.tsx # Timetable editor, sync loader, CSV export
│   │   ├── CourseModal.tsx
│   │   ├── SlotModal.tsx
│   │   └── SyncModal.tsx   # Sync diff preview & confirmation dialog
│   ├── lib/
│   │   ├── attendance.ts  # Deterministic attendance & projection math
│   │   └── prisma.ts      # Prisma Client singleton
│   └── types/
│       └── index.ts       # Shared TypeScript types
└── package.json
```

---

## 🛡️ Data Portability

- **CSV Export**: Export all verified attendance records directly to CSV from Settings.
- **Full JSON Backup & Restore**: Snapshot your entire database state to JSON and restore it seamlessly at any time.
