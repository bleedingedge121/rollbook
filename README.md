# Roll Book 📖

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**Roll Book** is an intelligent university attendance intelligence platform, forecasting lab, and academic trajectory suite designed around a strict foundational principle:

> **Never assume a lecture happened just because the timetable says it should have.**

Traditional attendance trackers blindly increment class counters every week, corrupting records whenever professors cancel, substitute, or reschedule. Roll Book separates **verified portal baselines** from **future simulated planning**, delivering mathematically exact safe-to-skip buffers and recovery trajectories.

---

## 📑 Table of Contents

- [🌟 Core Highlights](#-core-highlights)
- [📖 Step-by-Step User Tutorial](#-step-by-step-user-tutorial)
  - [1. Account Creation & Initial Setup](#1-account-creation--initial-setup)
  - [2. Synchronizing Live Attendance from SLCM](#2-synchronizing-live-attendance-from-slcm)
    - [Option A: Laptop Browser Console (5 Seconds — Recommended)](#option-a-laptop-browser-console-5-seconds--recommended)
    - [Option B: Mobile Phone Direct Table Copy](#option-b-mobile-phone-direct-table-copy)
    - [Option C: Automated Desktop Scraper (Node.js)](#option-c-automated-desktop-scraper-nodejs)
  - [3. Daily Attendance Management & Quick Logging](#3-daily-attendance-management--quick-logging)
  - [4. The Trajectory Lab: Simulation & Buffer Math](#4-the-trajectory-lab-simulation--buffer-math)
  - [5. AI Attendance Advisor](#5-ai-attendance-advisor)
- [📐 Mathematical Models & Formulas](#-mathematical-models--formulas)
- [🏛️ System Architecture](#️-system-architecture)
- [🚀 Local Development Setup](#-local-development-setup)
- [☁️ 100% Free Production Deployment](#️-100-free-production-deployment)
- [🛡️ Admin Console & Operations](#️-admin-console--operations)
- [📁 Project Structure](#-project-structure)
- [📄 License](#-license)

---

## 🌟 Core Highlights

1. **Strict Multi-Tenant Isolation**: Every user has an independent, private workspace. Courses, timetables, attendance history, and sync sessions are isolated at the database layer. Cross-account mutations are rejected with `403 Forbidden`.
2. **Frictionless SLCM Sync Pipeline**:
   - **Laptop**: 5-second Browser Console Script captures Salesforce Aura payloads with zero terminal, cloning, or extension installation.
   - **Mobile (iPhone / Android)**: Direct copy-paste parser extracts subjects, course codes, attended, and total lectures straight from raw portal text.
   - **Cloud Sync**: Data synced from any device is persisted to Neon PostgreSQL and immediately available across mobile, tablet, and desktop.
3. **1-Click Department Timetable Import**: Built-in official schedules for 22 MIT Bengaluru CSE stream sections (`C01`–`C22`). Populates subject names, course codes, and weekly time slots instantly.
4. **Shared University Academic Calendar**: Centralized management for institution-wide declared holidays, cultural fests, and examination blocks. Maintained by administrators and automatically synced across all student timetables.
5. **Authentic Actual Mode vs. Trajectory Lab**: Historical statistics are anchored strictly in verified figures. The Trajectory Lab lets you simulate *Plan to Attend* and *Plan to Skip* choices weeks into the future without corrupting your verified records.
6. **Deterministic Margin Math**: Precise formulas calculate the exact number of consecutive lectures you can safely skip before dropping below 75%, or the mandatory recovery streak needed to escape attendance shortages.
7. **AI Attendance Advisor**: Real-time natural language assistant powered by Google Gemini. Connected directly to deterministic database tools to answer complex scheduling, buffer, and percentage queries with zero hallucination.
8. **Neo-Brutalist Design System**: High-contrast geometric interface with Electric Teal primary accents, 2px borders, hard offset shadows, bouncy Framer Motion micro-interactions, Outfit typography, and instant dark/light theme switching.
9. **Mobile-First UX**: Responsive bottom navigation dock, dynamic safe-area insets (`env(safe-area-inset-bottom)`), responsive SVG radar rings, and full mobile touch compatibility.

---

## 📖 Step-by-Step User Tutorial

### 1. Account Creation & Initial Setup

1. Open Roll Book and click **Sign Up**.
2. Enter your username and password to create your private, isolated account.
3. Upon first login, open the **Command & Sync** tab (gear icon in the navigation bar).
4. Click **Select My Section** under *Import Official Department Timetable*.
5. Choose your section (e.g. `C05`, `C12`, `C18`) from the list of 22 official MIT Bengaluru sections.
6. Click **Apply Section Timetable**. All your subjects, course codes, and recurring weekly timetable slots will be generated immediately!

---

### 2. Synchronizing Live Attendance from SLCM

Roll Book offers multiple ways to ingest your live portal attendance figures:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 SLCM Portal (Salesforce)               │
                  └───────────┬────────────────────────────────┬───────────┘
                              │                                │
            [Option A: AI Chatbot / Mobile Copy]     [Option B: Laptop F12]
                              │                                │
                 Copy table directly from SLCM       Run 5-sec script in Console
                              │                                │
                 Paste into AI Chat Advisor          Banner captures 10 courses
                              │                                │
                              └───────────────┬────────────────┘
                                              │
                                   Instant Sync & Parse
                                              │
                                 ┌────────────▼───────────┐
                                 │   Neon PostgreSQL DB   │
                                 └────────────┬───────────┘
                                              │
                                Instant Cloud Sync to All Devices
```

#### Option A: AI Chatbot Screenshot Upload or Table Paste (Fastest on Mobile & Laptop)

*Zero code, zero scripts, zero extensions. Works right inside mobile Safari, mobile Chrome, or desktop.*

1. Open SLCM in your phone or laptop browser and navigate to the **Attendance** page.
2. Either **take a screenshot** of the attendance table, or select and copy the table text.
3. Open Roll Book and tap the **AI Attendance Advisor** floating bubble in the bottom right corner.
4. Tap the **camera/image icon** to attach the screenshot (or press <kbd>Ctrl+V</kbd> to paste it from your clipboard), or paste the copied text.
5. Hit **Send** (or click the *📸 Sync from Screenshot* prompt).
6. Gemini vision automatically reads the table rows, parses attended/total counts, and synchronizes the figures straight into your Neon PostgreSQL database.
7. Your entire Roll Book dashboard instantly refreshes live with updated percentages, safe skip counts, and recovery targets!

#### Option B: Settings Paste Box (Manual Ingest)

1. Copy your SLCM attendance table or exported JSON.
2. In Roll Book, open **Command & Sync** $\rightarrow$ **Paste Attendance Data**.
3. Paste the text into the box and click **Apply Attendance Data**.
4. The smart regex parser matches each subject and updates your database baseline.

#### Option C: Laptop Browser Console (5 Seconds — 100% Accurate)

*Zero installations, zero repo cloning, and zero terminal commands.*

1. In Roll Book, go to **Command & Sync** $\rightarrow$ **Browser Sync (Laptop & Desktop)**.
2. Click **`[ 💻 Copy Console Script (Laptop) ]`**. The ready-to-run script is copied to your clipboard.
3. In another tab, log in to your university SLCM portal and open the **Attendance** page.
4. Press <kbd>F12</kbd> (or right-click anywhere $\rightarrow$ **Inspect**), then click the **Console** tab.
   > *Note: If Chrome shows a warning about pasting, type `allow pasting` into the console and press Enter once.*
5. Paste the script (<kbd>Ctrl+V</kbd> or <kbd>Cmd+V</kbd>) and press <kbd>Enter</kbd>.
6. In SLCM, click another tab (like **Home**) and click back to **Attendance** to trigger the network request.
7. An emerald Roll Book banner will appear at the top of SLCM confirming your subjects were captured. Click **Copy JSON**.
8. Return to Roll Book, paste the copied JSON into the AI chat or the **Paste Attendance Data** box, and click **Apply Attendance Data**.
9. All your course totals, attended counts, and percentages are now synchronized!

#### Option D: Automated Desktop Scraper (Node.js)

*For developers who prefer an automated headless browser runner.*

```bash
cd scraper
npm install
npx playwright install chromium
node agent.js
```

On first run, `agent.js` asks for your hosted Roll Book URL. Log in via the browser window with your Microsoft MFA, and the scraper automatically pushes updated figures to your account.

---

### 3. Daily Attendance Management & Quick Logging

1. **Dashboard Flight View**:
   - Shows today's scheduled lectures according to your section timetable.
   - Tap **Present** (<kbd>P</kbd>) or **Absent** (<kbd>A</kbd>) on any scheduled slot to log attendance in 1 click.
   - Use **Mark All Present** or **Mark All Absent** for batch logging.
2. **Unlogged Class Radar**:
   - Roll Book checks past dates from the last 7 days. If a scheduled lecture occurred on a non-holiday date and was not logged, it appears in your **Unconfirmed Past Classes** banner.
   - Confirm them in bulk or mark the entire date as a holiday/class canceled with 1 tap.
3. **Weekly Timetable Visualizer**:
   - Switch between weekdays (Monday through Friday) to inspect your schedule, room numbers, and instructor allocations.

---

### 4. The Trajectory Lab: Simulation & Buffer Math

The **Trajectory Lab** (`CalendarView`) allows you to test hypothetical attendance decisions without corrupting your verified academic records:

1. **Safety Radar Rings**:
   - Each subject card displays an interactive circular progress gauge.
   - Emerald rings indicate safe standing ($\ge 75\%$).
   - Rose rings alert you to attendance shortages ($< 75\%$).
2. **Safe-to-Skip Margins**:
   - Displays the exact number of future lectures you can afford to miss while remaining above $75\%$.
3. **Mandatory Recovery Streaks**:
   - Displays the exact number of consecutive upcoming classes you must attend to climb back into the Safe Zone.
4. **Planning Mode**:
   - Click future dates on the calendar and toggle slots between *Planned Present* and *Planned Absent*.
   - Watch your projected percentage evolve across the semester in real time.

---

### 5. AI Attendance Advisor

Click the floating chat bubble on any page to open your personal AI advisor:

- **What you can ask**:
  - *"Am I in the danger zone for any course?"*
  - *"How many classes can I safely skip in Applied Physics?"*
  - *"What is my schedule for tomorrow morning?"*
  - *"Do I have any unlogged classes from this week?"*
  - *"If I miss both math lectures on Thursday, will I drop below 75%?"*
- **Deterministic Grounding**:
  - The AI does not guess or hallucinate. It executes database tools (`getUserAttendanceSummary`, `getCourseDetails`, `getUpcomingSchedule`, `getUnloggedClasses`) to calculate exact answers based on your verified database records.

---

## 📐 Mathematical Models & Formulas

All percentage and threshold calculations adhere strictly to these formulations:

$$\text{Current Attendance \%} = \frac{P_{\text{synced}} + P_{\text{manual}}}{(P_{\text{synced}} + P_{\text{manual}}) + (A_{\text{synced}} + A_{\text{manual}})} \times 100$$

Where:
- $P_{\text{synced}}, A_{\text{synced}}$: Baseline present and absent counts verified from portal sync.
- $P_{\text{manual}}, A_{\text{manual}}$: Incremental daily logs recorded after the portal sync date.

### 1. Safe Zone ($\text{Percentage} \ge R$)

When your current standing is at or above the threshold $R = 0.75$ ($75\%$), the maximum number of consecutive future lectures you can safely skip ($S$) is:

$$S = \left\lfloor \frac{P}{R} - (P + A) \right\rfloor$$

### 2. Recovery Zone ($\text{Percentage} < R$)

When your current standing is below the required threshold $R$, the minimum number of consecutive future lectures you must attend ($M$) to restore compliance is:

$$M = \left\lceil \frac{R \times (P + A) - P}{1 - R} \right\rceil$$

---

## 🏛️ System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js 16 App Router                           │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │   UI Components       │  │   API Route Handlers                  │  │
│  │   - DashboardView     │  │   - /api/attendance (Scoped CRUD)     │  │
│  │   - CalendarView      │  │   - /api/courses (Scoped Management)  │  │
│  │   - SettingsView      │  │   - /api/sync/paste (Session Reconcile)│ │
│  │   - ChatWidget (AI)   │  │   - /api/sync/push (Reverse-Push)     │  │
│  │   - AdminView         │  │   - /api/chat (Gemini Tools)          │  │
│  └───────────┬───────────┘  └───────────────────┬───────────────────┘  │
└──────────────┼──────────────────────────────────┼──────────────────────┘
               │                                  │
       Web Crypto HMAC                    Prisma ORM v5.22
       Session Cookies                    Connection Pooler
               │                                  │
               ▼                                  ▼
      Client Local Storage             Neon Serverless PostgreSQL
      (Cached Snippet State)           (Multi-Tenant Isolated Data)
```

- **Session Security**: Stateless HMAC-SHA256 authenticated cookies with Web Crypto API (`Edge`-compatible).
- **Tenant Protection**: Every database query scopes `where: { userId }`. Cross-tenant mutations are blocked at both middleware and route handler levels.
- **Course Uniqueness**: Compound Prisma index `@@unique([userId, code])` enables students to register identical subject codes (e.g. `CES_1102`) without collision.

---

## 🚀 Local Development Setup

### 1. Prerequisites
- **Node.js**: v18.x or later (tested on v22)
- **Database**: PostgreSQL (Local, Docker, or Neon free tier)
- **Package Manager**: npm, pnpm, or yarn

### 2. Clone & Install
```bash
git clone https://github.com/bleedingedge121/rollbook.git
cd rollbook
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Set your configuration values:
```env
# PostgreSQL connection string (Local or Neon)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rollbook?schema=public"

# 32+ character random string for signing session cookies
APP_SESSION_SECRET="your-secure-random-secret-key-at-least-32-chars"

# Google Gemini API Key (Free tier from https://aistudio.google.com)
GEMINI_API_KEY="your-gemini-api-key"

# Scraper allowed origin
AGENT_ALLOWED_ORIGIN="http://localhost:3000"
```

### 4. Initialize Database
```bash
npx prisma db push
```

### 5. Launch Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ 100% Free Production Deployment

Roll Book is architected to run permanently with zero hosting costs:

| Component | Provider | Free Tier Allowance |
| :--- | :--- | :--- |
| **App Hosting** | [Vercel](https://vercel.com) | Unlimited Hobby deployments, Edge middleware |
| **PostgreSQL Database** | [Neon](https://neon.tech) | 512 MB storage, autoscaling serverless compute |
| **AI Advisor** | [Google AI Studio](https://aistudio.google.com) | Free Gemini 2.0 / Flash quota |

👉 Follow the complete step-by-step walkthrough in **[DEPLOYMENT.md](DEPLOYMENT.md)**.

---

## 🛡️ Admin Console & Operations

Accounts registered with the username `admin` (or the very first user created in the database) are automatically granted the `admin` role.

Administrators have access to `/admin` for:
- Declaring and modifying college-wide holidays and exam periods.
- Inspecting student registration baselines and sync timestamps.
- Resetting student accounts or AI request counters upon request.
- Permanently deleting accounts with typed-username safety verifications.

CLI maintenance tools:
```bash
# Promote an existing user to Administrator
npx tsx scripts/make-admin.ts <username>

# Reset a user's password from the terminal
npx tsx scripts/set-password.ts <username> <new_password>
```

---

## 📁 Project Structure

```
RollBook/
├── docs/                     # Architectural, mathematical, and scraper specifications
├── prisma/
│   ├── schema.prisma         # Multi-tenant PostgreSQL database models
│   └── seed.js               # Database seeding utilities
├── scripts/                  # CLI administration and automated test scripts
├── scraper/                  # Headless Playwright SLCM reverse-push runner
├── src/
│   ├── app/
│   │   ├── admin/            # Administrative management suite (/admin)
│   │   ├── api/              # Scoped REST API route handlers
│   │   ├── login/            # Authentication view (Sign In / Sign Up)
│   │   ├── globals.css       # Neo-brutalist theme tokens & styles
│   │   ├── layout.tsx        # HTML root shell & typography
│   │   └── page.tsx          # Main view orchestrator
│   ├── components/           # Modular React views, modals, bottom nav dock
│   ├── lib/                  # Math formulas, session security, timetable templates
│   └── types/                # Shared TypeScript definitions
├── DEPLOYMENT.md             # Free Vercel & Neon deployment guide
└── package.json
```

---

## 📄 License

Distributed under the MIT License. Crafted with care and mathematical precision.
