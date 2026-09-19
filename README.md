<div align="center">
  <img src="public/icons/icon-512x512.png" width="120" height="120" alt="Roll Book Logo" style="border-radius: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.25);" />
  
  # Roll Book 📖
  
  **Intelligent University Attendance Platform, Academic Flight Cockpit & Predictive Trajectory Lab**
  
  [![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![React](https://img.shields.io/badge/React-19.3-087ea4?style=for-the-badge&logo=react)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Neon Database](https://img.shields.io/badge/Neon-PostgreSQL_16-00e599?style=for-the-badge&logo=postgresql)](https://neon.tech/)
  [![Google Gemini](https://img.shields.io/badge/Google_Gemini-Vision_&_Tools-4285f4?style=for-the-badge&logo=google)](https://aistudio.google.com/)
  [![PWA](https://img.shields.io/badge/PWA-iOS_&_Android_Ready-ff6b6b?style=for-the-badge)](https://web.dev/progressive-web-apps/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

</div>

---

**Roll Book** is built around an uncompromising foundational axiom:

> **Never assume a lecture took place just because the timetable says it should have.**

Traditional attendance apps blindly increment class numbers on a weekly loop, quietly corrupting records whenever classes are canceled, rescheduled, substituted, or affected by campus holidays. Roll Book bridges **verified institutional portal figures** with a forward-looking **simulated planning engine**, providing mathematically verified safe-to-skip margins and precise recovery streaks.

---

## 📑 Table of Contents

- [🌟 Core Highlights](#-core-highlights)
- [📱 Installing as a Mobile Web App (PWA)](#-installing-as-a-mobile-web-app-pwa)
- [📖 Step-by-Step User Tutorial](#-step-by-step-user-tutorial)
  - [1. Account Creation & Timetable Import](#1-account-creation--timetable-import)
  - [2. Synchronizing Live Attendance from SLCM](#2-synchronizing-live-attendance-from-slcm)
    - [Option A: Multi-Screenshot or Table Paste via AI Advisor (Fastest)](#option-a-multi-screenshot-or-table-paste-via-ai-advisor-fastest)
    - [Option B: 5-Second Laptop Browser Console](#option-b-5-second-laptop-browser-console)
    - [Option C: Settings Manual Paste Ingest](#option-c-settings-manual-paste-ingest)
    - [Option D: Automated Desktop Scraper (Node.js)](#option-d-automated-desktop-scraper-nodejs)
  - [3. Daily Attendance Logging & Flight Radar](#3-daily-attendance-logging--flight-radar)
  - [4. The Trajectory Lab: Simulation & Buffer Math](#4-the-trajectory-lab-simulation--buffer-math)
  - [5. AI Attendance Advisor & Resilient Multi-Model Engine](#5-ai-attendance-advisor--resilient-multi-model-engine)
- [📐 Mathematical Formulations & Derivations](#-mathematical-formulations--derivations)
- [🏛️ System Architecture](#️-system-architecture)
- [🚀 Local Development Setup](#-local-development-setup)
- [☁️ 100% Free Production Deployment](#️-100-free-production-deployment)
- [🛡️ Admin Console & Operations](#️-admin-console--operations)
- [📁 Project Structure](#-project-structure)
- [📄 License](#-license)

---

## 🌟 Core Highlights

1. **Multi-Tenant Database Isolation**: Every student account is private and sandboxed. Courses, schedules, historical logs, and sync tokens are isolated at the database schema level. Cross-tenant access is strictly blocked (`403 Forbidden`).
2. **Multi-Modal SLCM Sync Pipeline**:
   - **AI Multi-Screenshot Upload**: Take 1, 2, or more screenshots of your SLCM attendance table on your phone or laptop. Gemini Vision extracts, deduplicates, and saves your records directly.
   - **Direct Table Paste**: Select and copy the attendance text directly from your browser; the smart regex parser extracts subjects, codes, attended, and total lectures automatically.
   - **5-Second Laptop Console**: Paste an ephemeral script into the browser console (<kbd>F12</kbd>) to capture live network payloads with zero extensions, zero cloning, and zero terminal commands.
   - **Real-Time Live Auto-Refresh**: Synced data updates your dashboard immediately via CustomEvents without page reloads.
3. **1-Click Official Timetable Import**: Built-in official schedules for all 22 MIT Bengaluru sections (`C01`–`C22`). Automatically generates subject names, course codes, and weekly recurrence slots.
4. **Institutional Academic Calendar**: Centralized calendar for university holidays, cultural fests, and exam blocks. Maintained by administrators and automatically applied to all student schedules.
5. **Verified Baseline vs. Predictive Trajectory Lab**: Historical numbers stay anchored to verified facts. The Trajectory Lab lets you simulate future *Plan to Attend* and *Plan to Skip* choices across weeks without corrupting past records.
6. **Exact Margin Mathematics**: Closed-form mathematical formulas compute the exact number of classes you can safely skip ($S$) before dropping below 75%, or the mandatory consecutive streak ($M$) needed to recover from attendance shortages.
7. **Resilient AI Flight Advisor**: Real-time natural language assistant powered by Google Gemini with an automatic multi-model fallback cascade (`gemini-3.6-flash`, `gemini-flash-latest`, `gemini-3.5-flash-lite`). Connected to deterministic database tools for zero hallucinations.
8. **Neo-Brutalist Visual Design**: High-contrast geometric UI with Electric Teal primary accents, 2px borders, hard offset shadows (`shadow-[4px_4px_0px_var(--shadow-color)]`), Framer Motion micro-interactions, and instant Dark/Light mode toggle.
9. **Full PWA Native Experience**: Full support for iOS and Android home screen installation, standalone window mode, custom touch icons, and dynamic safe-area insets (`env(safe-area-inset-bottom)`).

---

## 📱 Installing as a Mobile Web App (PWA)

Roll Book is configured as a Progressive Web App (PWA) with custom app icons, standalone windowing, and safe-area support.

### iPhone & iPad (Safari)
1. Open Roll Book in **Safari**.
2. Tap the **Share** button in the bottom navigation toolbar (square with upward arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name (**Roll Book**) and tap **Add**.
5. The custom **Roll Book 'R' Ledger** icon will appear on your iOS home screen and launch full-screen like a native app.

### Android (Chrome)
1. Open Roll Book in **Chrome**.
2. Tap the **three dots menu** ($\dots$) in the top-right corner.
3. Tap **Add to Home screen** (or **Install app**).
4. Tap **Install** to confirm.
5. Launch Roll Book directly from your app drawer or home screen.

---

## 📖 Step-by-Step User Tutorial

### 1. Account Creation & Timetable Import

1. Open Roll Book and click **Sign Up**.
2. Choose your username and password to create an isolated account.
3. After logging in, tap the **Command & Sync** tab (gear icon in the navigation bar).
4. Under *Import Official Department Timetable*, click **Select My Section**.
5. Choose your section (e.g. `C05`, `C12`, `C18`) from the list of 22 official MIT-BLR sections.
6. Click **Apply Section Timetable**. All your subjects, course codes, and weekly schedule slots will populate immediately!

---

### 2. Synchronizing Live Attendance from SLCM

Roll Book offers 4 ways to ingest your live portal attendance figures:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 SLCM Portal (Salesforce)               │
                  └───────────┬────────────────────────────────┬───────────┘
                              │                                │
            [Option A: AI Chatbot / Mobile Copy]     [Option B: Laptop F12]
                              │                                │
            Capture 1 or more table screenshots      Run 5-sec script in Console
                              │                                │
                 Paste/Upload into AI Chat           Banner captures 10 courses
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

#### Option A: Multi-Screenshot or Table Paste via AI Advisor (Fastest)

*Zero installations, zero developer tools. Works directly on your phone or laptop.*

1. Open your university SLCM portal in Safari or Chrome and navigate to the **Attendance** page.
2. **If uploading screenshots**:
   - Take 1 screenshot (or 2+ screenshots if your table needs scrolling to capture all courses).
   - Open Roll Book and tap the **AI Attendance Advisor** floating bubble in the bottom right corner.
   - Tap the **camera/image icon** to attach your screenshots (or press <kbd>Ctrl+V</kbd> to paste from clipboard).
   - Hit **Send** (or tap *📸 Sync from Screenshots*).
   - Gemini Vision reads the table rows, automatically **deduplicates** any overlapping courses between screenshots, updates your database, and live-refreshes your dashboard.
3. **If copying text**:
   - Highlight and copy the attendance table rows from SLCM.
   - Open the AI chat, paste the text into the box, and press **Send**.
   - The smart parser extracts all subjects, presents, and absents immediately!

#### Option B: 5-Second Laptop Browser Console

*Zero installations, zero repo cloning, and zero terminal commands.*

1. In Roll Book, open **Command & Sync** $\rightarrow$ **Browser Sync (Laptop & Desktop)**.
2. Click **`[ 💻 Copy Console Script (Laptop) ]`** to copy the ready-to-run snippet.
3. In another tab, log in to your university SLCM portal and open the **Attendance** page.
4. Press <kbd>F12</kbd> (or right-click $\rightarrow$ **Inspect**), then click the **Console** tab.
   > *Note: If Chrome displays a warning about pasting, type `allow pasting` into the console and press Enter once.*
5. Paste the snippet (<kbd>Ctrl+V</kbd>) and press <kbd>Enter</kbd>.
6. In SLCM, click another tab (like **Home**) and click back to **Attendance** so the network request fires.
7. An emerald Roll Book banner will appear at the top of SLCM confirming your subjects were captured. Click **Copy JSON**.
8. Return to Roll Book, paste the copied JSON into the AI chat or the **Paste Attendance Data** box, and click **Apply Attendance Data**.

#### Option C: Settings Manual Paste Ingest

1. Copy your SLCM attendance table or exported JSON.
2. In Roll Book, open **Command & Sync** $\rightarrow$ **Paste Attendance Data**.
3. Paste the text into the box and click **Apply Attendance Data**.
4. The smart regex parser matches each subject and updates your database baseline.

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

### 3. Daily Attendance Logging & Flight Radar

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

### 5. AI Attendance Advisor & Resilient Multi-Model Engine

Click the floating chat bubble on any page to open your personal AI advisor:

- **What you can ask**:
  - *"Am I in the danger zone for any course?"*
  - *"How many classes can I safely skip in Applied Physics?"*
  - *"What is my schedule for tomorrow morning?"*
  - *"Do I have any unlogged classes from this week?"*
  - *"If I miss both math lectures on Thursday, will I drop below 75%?"*
  - *"Add a holiday on 25 Dec for Christmas"* (Administrators)
- **Deterministic Grounding**:
  - The AI does not guess or hallucinate. It executes database tools (`get_attendance_summary`, `get_course_detail`, `get_upcoming_classes`, `get_unlogged_sessions`, `sync_attendance_data`, `add_holiday`, `list_holidays`) to calculate exact answers based on verified database records.
- **Resilient Multi-Model Cascades**:
  - If Google AI Studio experiences a demand spike, the engine automatically retries with backoff and cascades through `gemini-3.6-flash` $\rightarrow$ `gemini-flash-latest` $\rightarrow$ `gemini-3.5-flash-lite`.

---

## 📐 Mathematical Formulations & Derivations

All percentage and threshold calculations adhere strictly to these formulations:

$$\text{Current Attendance \%} = \frac{P_{\text{synced}} + P_{\text{manual}}}{(P_{\text{synced}} + P_{\text{manual}}) + (A_{\text{synced}} + A_{\text{manual}})} \times 100$$

Where:
- $P_{\text{synced}}, A_{\text{synced}}$: Baseline present and absent counts verified from portal sync.
- $P_{\text{manual}}, A_{\text{manual}}$: Incremental daily logs recorded after the portal sync date.

### 1. Safe Zone ($\text{Percentage} \ge R$)

When your current standing is at or above the required threshold $R = 0.75$ ($75\%$), the maximum number of consecutive future lectures you can safely skip ($S$) without falling below $R$ is:

$$S = \left\lfloor \frac{P}{R} - (P + A) \right\rfloor$$

*Proof*: We require $\frac{P}{(P + A) + S} \ge R \iff P \ge R(P + A + S) \iff S \le \frac{P}{R} - (P + A)$. Taking the floor yields $S$.

### 2. Recovery Zone ($\text{Percentage} < R$)

When your current standing is below the required threshold $R$, the minimum number of consecutive future lectures you must attend ($M$) to restore compliance is:

$$M = \left\lceil \frac{R \times (P + A) - P}{1 - R} \right\rceil$$

*Proof*: We require $\frac{P + M}{(P + A) + M} \ge R \iff P + M \ge R(P + A) + RM \iff M(1 - R) \ge R(P + A) - P$. Taking the ceiling yields $M$.

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
│  │   - AdminView         │  │   - /api/chat (Gemini Tools & Vision) │  │
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
| **AI Advisor** | [Google AI Studio](https://aistudio.google.com) | Free Gemini quota with no credit card required |

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
├── public/
│   ├── apple-touch-icon.png  # iOS Home Screen PWA icon (180x180)
│   ├── favicon.ico           # Multi-resolution browser tab icon
│   ├── manifest.json         # PWA Web App manifest configuration
│   └── icons/                # Android 192px, 512px & maskable launcher icons
├── scripts/                  # CLI administration and automated test scripts
├── scraper/                  # Headless Playwright SLCM reverse-push runner
├── src/
│   ├── app/
│   │   ├── admin/            # Administrative management suite (/admin)
│   │   ├── api/              # Scoped REST API route handlers
│   │   ├── login/            # Authentication view (Sign In / Sign Up)
│   │   ├── globals.css       # Neo-brutalist theme tokens & styles
│   │   ├── layout.tsx        # HTML root shell, metadata & typography
│   │   └── page.tsx          # Main view orchestrator & sync listeners
│   ├── components/           # Modular React views, ChatWidget, bottom nav dock
│   ├── lib/                  # Math formulas, session security, timetable templates
│   └── types/                # Shared TypeScript definitions
├── DEPLOYMENT.md             # Free Vercel & Neon deployment guide
└── package.json
```

---

## 📄 License

Distributed under the MIT License. Crafted with care and mathematical precision.
