# Roll Book Architecture & Data Engine

This document outlines the technical architecture, multi-user isolation model, institutional calendar engine, role-based access control, and API design of **Roll Book**.

---

## 🏛️ System Philosophy

Roll Book operates on one non-negotiable principle:

> **Never assume a lecture happened just because the timetable scheduled it.**

Traditional attendance trackers infer attendance by automatically ticking off slots as dates pass on the calendar. Roll Book strictly bifurcates attendance management into two unpolluted layers:

1. **Actual Layer (Past + Today)**: Attendance statistics ($\text{Percentage}$, $\text{Held}$, $\text{Present}$, $\text{Absent}$) are calculated *exclusively* from confirmed database entries and authoritative portal snapshots. Unlogged calendar dates remain unlogged and never contribute to either the numerator or denominator.
2. **Planning Layer (Future Simulator)**: Driven by recurring weekly timetable slots. Users simulate future choices (*Plan to Attend* / *Plan to Skip*) to project trajectory curves. These projections live in reactive client state and never write speculative records to the database.

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

Roll Book uses PostgreSQL via Prisma for scalable multi-user persistence:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id               String    @id @default(cuid())
  username         String    @unique
  passwordHash     String
  syncToken        String?   @unique
  chatRequestCount Int       @default(0)
  chatRequestDate  String?
  role             String    @default("user") // "user" | "admin"
  createdAt        DateTime  @default(now())
  courses          Course[]
}

model Course {
  id              String             @id @default(cuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  name            String
  code            String
  requiredPercent Float              @default(75.0)
  color           String             @default("#0D9488")
  syncedPresent   Int?               @default(0)
  syncedAbsent    Int?               @default(0)
  syncedAt        DateTime?
  trackingMode    String             @default("detailed") // "detailed" | "simple"
  simpleHeld      Int?               @default(0)
  simpleAttended  Int?               @default(0)
  timetableSlots  TimetableSlot[]
  attendance      AttendanceRecord[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@unique([userId, code])
  @@index([userId])
}

model TimetableSlot {
  id        String   @id @default(cuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  weekday   Int      // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  label     String   // e.g. "09:00 - 10:00"
  room      String?  // e.g. "AB4 403"
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([weekday])
  @@index([courseId])
}

model AttendanceRecord {
  id        String   @id @default(cuid())
  courseId  String
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  date      String   // ISO YYYY-MM-DD
  status    String   // "present" | "absent"
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([date])
  @@index([courseId])
}

model Holiday {
  id        String   @id @default(cuid())
  date      String   @unique // ISO YYYY-MM-DD (Global uniqueness)
  label     String   // e.g. "Diwali Break", "Mid-Term Exams"
  type      String   @default("holiday") // "holiday" | "exam"
  createdAt DateTime @default(now())

  @@index([date])
}
```

### Multi-Tenant Scoping & Uniqueness Rules
- **`Course: @@unique([userId, code])`**: Ensures each student has their own course catalog without conflicts when multiple friends take the same course (e.g. `CSE101` in different sections).
- **`Holiday: @unique date`**: Institutional calendar events apply globally to all students across all sections. Only administrators can add or delete calendar dates, while all users have real-time read-only access.

---

## 🔐 Multi-User Security & Session Management

- **Password Hashing**: Passwords are encrypted using `bcryptjs` with 10 salt rounds (minimum 8 characters).
- **Username Normalization**: All usernames are normalized to lowercase on write and lookup, preventing duplicate account collisions and casing lockouts.
- **Web Crypto HMAC-SHA256**: Uses `crypto.subtle` for token signing and validation, ensuring 100% compatibility across both Node.js API routes and the Next.js Edge Middleware runtime.
- **Edge Middleware (`src/middleware.ts`)**: All routes are protected by default except public paths (`/login`, `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`). Unauthenticated API requests receive `401 Unauthorized`.
- **Session Helpers (`src/lib/session.ts`)**:
  - `requireUser(req)` extracts and verifies the caller's session token, returning their `{ userId, username, role }` or a 401 response.
  - `requireAdmin(req)` verifies session authentication and queries the database to confirm `user.role === 'admin'`, returning `403 Forbidden` for regular users.
  - `verifyCourseOwnership(courseId, userId)` checks that a target course belongs to the authenticated user before executing writes or reads, returning `403 Forbidden` if mismatched.

---

## 🛡️ Role-Based Access Control & Admin Console

Roll Book supports two user roles:
- **`user`** (Default): Regular student account. Isolated course data, personal timetable, private attendance history, and read-only access to the institutional academic calendar.
- **`admin`**: System administrator. Has full access to student oversight tools, user debugging, per-user data wipes, and global calendar management.

### Admin CLI Promotion
Promote any user to administrator using the idempotent CLI utility:
```bash
npx tsx scripts/make-admin.ts <username>
```

### Dedicated Admin Console (`/admin`)
Accessible via the navigation bar for admin users:
1. **Global Academic Calendar Management**:
   - Add single-day or multi-day date ranges.
   - Classification: **College Holiday / Recess** vs. **Term Exams / Assessments**.
   - One-click deletion of calendar ranges.
2. **User Directory & Remote Debugging**:
   - Directory table with course count, registration timestamp, role, and last SLCM sync date.
   - **Inspect Modal**: View any student's courses, attendance ratios, tracking mode, and timetable slots without knowing their password.
   - **Reset Data Modal**: Wipes all courses, slots, and attendance records for a target user (e.g. to fix corrupt data) while preserving their credentials.
   - **Delete Account Modal**: Irreversible deletion guarded by mandatory typed-username confirmation.

---

## 🤖 Reverse-Push SLCM Attendance Sync

To bypass modern browser restrictions (Mixed Content and Local Network Access blocking HTTPS web apps from calling `http://localhost:4747`), Roll Book uses a **reverse-push architecture**:

```
[Local Scraper Runner]  ──(Playwright + MFA)──>  [MAHE SLCM Portal]
         │
         │  (Scrapes verified HTML attendance tables)
         ▼
[Local Scraper Runner]  ──(POST /api/sync/push)──>  [Hosted Roll Book on Vercel]
                             Authorization: Bearer <syncToken>
                                     │
                                     ▼
                            [Reconcile Engine]
                     (Matches courses, updates baselines)
```

1. **Personal Sync Tokens**:
   - Stored in the database as a one-way **SHA-256 hash**.
   - Shown in plaintext **only once** to the user in Settings.
   - Can be regenerated at any time to immediately revoke previous tokens.
2. **Desktop Runner (`scraper/agent.js`)**:
   - Prompts once for app URL and token, saving them in `scraper/.env`.
   - Runs headless or headed Playwright to handle Microsoft MFA.
   - Pushes parsed JSON directly to `/api/sync/push`.
3. **Reconcile Engine (`src/lib/reconcile.ts`)**:
   - Matches courses by exact code (`SMS_1102`), normalized names, code digits, and fuzzy similarity.
   - Updates `syncedPresent`, `syncedAbsent`, `simpleAttended`, and `simpleHeld` baselines.
   - Sets `syncedAt` timestamp.

---

## 🔌 API Endpoints Reference

### 1. Authentication & Tokens (`/api/auth`)
- `POST /api/auth/signup` — Registers a new student account.
- `POST /api/auth/login` — Verifies credentials and sets HTTP-only session cookie.
- `POST /api/auth/logout` — Clears the session cookie.
- `GET /api/auth/me` — Returns caller's `{ userId, username, role, authenticated }`.
- `POST /api/auth/sync-token` — Generates a new Personal Sync Token (returns plaintext once).
- `GET /api/auth/sync-token` — Checks whether user has an active token.

### 2. Admin Management (`/api/admin`) *(Restricted to role: admin)*
- `GET /api/admin/users` — Returns user directory with course counts and sync timestamps (excludes sensitive tokens).
- `GET /api/admin/users/[id]` — Returns target user's course breakdown and attendance history for debugging.
- `POST /api/admin/users/[id]/reset` — Wipes target user's courses, slots, attendance records, and resets chat quota.
- `DELETE /api/admin/users/[id]` — Permanently deletes target user account (admin cannot delete self).

### 3. College-Wide Academic Calendar (`/api/holidays`)
- `GET /api/holidays` — Returns all institutional calendar events (open to all authenticated users).
- `POST /api/holidays` — Declares single or date range events *(Admin only)*.
- `DELETE /api/holidays` — Deletes calendar events by ID list *(Admin only)*.
- `DELETE /api/holidays/[id]` — Deletes a single calendar event *(Admin only)*.

### 4. Courses (`/api/courses`) *(Scoped to caller)*
- `GET /api/courses` — Returns user's courses with stats.
- `POST /api/courses` — Creates a course for the user.
- `GET /api/courses/[id]` — Returns course details (ownership checked).
- `PUT /api/courses/[id]` — Updates course name, code, target percent, or baseline numbers.
- `DELETE /api/courses/[id]` — Deletes course and cascades slots/attendance.

### 5. Timetable Slots (`/api/timetable`) *(Scoped to caller)*
- `GET /api/timetable` — Returns user's weekly timetable slots.
- `POST /api/timetable` — Creates a slot under a user-owned course.
- `PUT /api/timetable/[id]` — Updates slot weekday, time label, or room.
- `DELETE /api/timetable/[id]` — Deletes a slot.

### 6. Attendance Records (`/api/attendance`) *(Scoped to caller)*
- `GET /api/attendance` — Returns records filtered by caller's courses.
- `POST /api/attendance` — Logs a single or batch attendance record.
- `PUT /api/attendance/[id]` — Updates record status (`present` / `absent`) or note.
- `DELETE /api/attendance/[id]` — Deletes an attendance record.

### 7. SLCM Reverse Push & Bookmarklet Sync (`/api/sync/push`, `/api/sync/paste`)
- `POST /api/sync/push` — Ingests attendance payload from desktop agent or client-side bookmarklet using `Authorization: Bearer <syncToken>`.
- `POST /api/sync/paste` — Fallback ingestion endpoint authenticated via session cookie (`requireUser`) when the bookmarklet's direct push is blocked by external CSP. Reconciles incoming courses via `autoApplySync`.

### 8. AI Attendance Advisor (`/api/chat`)
- `POST /api/chat` — Google Gemini (`@google/genai`) AI endpoint using `gemini-flash-latest` with native database tools (`get_attendance_summary`, `get_course_detail`, `get_upcoming_classes`, `get_unlogged_sessions`, `list_holidays`, `add_holiday`, `delete_holiday`).
- Calendar write tools enforce `user.role === 'admin'` check.
- Enforces daily quota of 50 requests per user.

### 9. Sections & Baseline Reset
- `GET /api/sections` — Lists 22 official department section timetables (`C01`–`C22`).
- `POST /api/sections/apply` — Ingests section subjects and schedule into caller's account.
- `POST /api/reset` — Atomically clears caller's courses and attendance without touching the global academic calendar.

---

## 📱 Mobile Architecture & Responsive Adaptation

Roll Book is engineered for a seamless mobile experience across modern smartphones (iOS Safari, Android Chrome):

### 1. Dynamic Device Detection Hook (`src/lib/useIsMobile.ts`)
- Evaluates client environment via both User-Agent sniffing (`/Android|iPhone|iPad|iPod|Mobile/i`) and a reactive media query listener (`(max-width: 767px)`).
- SSR-safe hydration with event listeners that react instantaneously to device rotation and viewport resizing.

### 2. WebKit Stacking Context Isolation
- **The Problem**: In WebKit (iOS Safari), any element containing `backdrop-filter` creates a new containing block for `position: fixed` descendants. Placing a mobile bottom navigation bar inside a sticky backdrop-blurred header causes WebKit to trap the bottom bar at the bottom of the header at the top of the screen, physically overlapping page titles and buttons.
- **The Architecture**: The mobile bottom `<nav>` is extracted completely outside of the `<header>` container into a root-level sibling fragment (`<> <header/> <nav/> </>`). This ensures the navigation bar anchors reliably to the true viewport bottom across all mobile browsers.

### 3. Hardware Safe-Area Insets & Clearance
- **Home Indicator Insets**: The bottom navigation bar incorporates `pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]` to elevate touch targets above iOS home indicators and Android gesture bars.
- **Floating Chat Positioning**: The Gemini AI advisor launcher floats at `bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))]`, avoiding collision with the navigation dock.
- **Scroll Clearance**: Main page containers apply `pb-36 md:pb-8` clearance, ensuring the lowest content cards and action buttons can be scrolled fully into view without obstruction.

### 4. Responsive Sync & Import Architecture
- The **Sync & Import** section is accessible on both mobile smartphones and desktop viewports.
- On mobile devices, users can import department timetables (sections C01–C22), generate and copy their Personal Sync Token for desktop scraper configuration, review SLCM reconciliation diffs, and perform JSON database backups and restores.
- All modal dialogs (`SectionImportModal`, `SyncModal`) and configuration cards are designed with adaptive paddings (`p-4 sm:p-7`), truncated headers, and touch-friendly buttons (`w-full sm:w-auto`).

---

## ⏱️ Standardized Date & Time Engine (`src/lib/formatters.ts`)

All temporal data throughout Roll Book is standardized into a consistent format:

1. **12-Hour Format with Lowercase AM/PM**:
   - `formatTime(date)`: Formats times without leading zero on hours (e.g. `9:00 am`, `2:30 pm`).
   - `formatSlotTime(slotStr)`: Smart regex parser that normalizes 24-hour timetable slots (`"09:00 - 10:00"`, `"14:00 - 16:00"`, `"09:00 - 12:00 (Lab/Workshop)"`) into 12-hour format: `"9:00 am - 10:00 am"`, `"2:00 pm - 4:00 pm"`.
2. **Date Representation (`DD/MM/YYYY`)**:
   - `formatDate(date)`: Formats dates to `DD/MM/YYYY` (e.g. `19/09/2026`).
   - `formatDateTime(date)`: Formats timestamps to `DD/MM/YYYY, h:mm am/pm`.
   - `toValidDate(date)`: Seamlessly parses both ISO `YYYY-MM-DD` and `DD/MM/YYYY` strings.
3. **AI Advisor Enforcement**:
   - Gemini system instructions explicitly enforce `DD/MM/YYYY` dates and 12-hour `am`/`pm` times in all generated responses.

