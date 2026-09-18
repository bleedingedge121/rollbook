# Roll Book Architecture & Data Engine

This document outlines the technical architecture, data model, security layer, and API design of **Roll Book**.

---

## 🏛️ System Philosophy

Roll Book operates on one non-negotiable principle:

> **Never assume a lecture happened just because the timetable scheduled it.**

Traditional attendance trackers infer attendance by automatically ticking off slots as dates pass on the calendar. Roll Book strictly bifurcates attendance management into two unpolluted layers:

1. **Actual Layer (Past + Today)**: Attendance statistics ($\text{Percentage}$, $\text{Held}$, $\text{Present}$, $\text{Absent}$) are calculated *exclusively* from confirmed database entries and authoritative portal snapshots. Unlogged calendar dates remain unlogged and never contribute to either the numerator or denominator.
2. **Planning Layer (Future Simulator)**: Driven by recurring weekly timetable slots. Users simulate future choices (*Plan to Attend* / *Plan to Skip*) to project trajectory curves. These projections live in reactive client state and never write speculative records to the database.

---

## 🗄️ Database Schema (`prisma/schema.prisma`)

Roll Book uses SQLite via Prisma for zero-latency, local-first persistence:

```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Course {
  id              String             @id @default(cuid())
  name            String
  code            String             @unique
  requiredPercent Float              @default(75.0)
  color           String             @default("#3b82f6")
  syncedPresent   Int?               @default(0)
  syncedAbsent    Int?               @default(0)
  syncedAt        DateTime?
  timetableSlots  TimetableSlot[]
  attendance      AttendanceRecord[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
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
```

---

## 🔐 Authentication & Session Security (`src/middleware.ts` & `src/lib/auth.ts`)

- **Single-Account Local Prototype**: Built for local or self-hosted deployment.
- **Web Crypto HMAC-SHA256**: Uses `crypto.subtle` for token signing and validation, running natively across both Node.js API routes and the Next.js Edge Middleware runtime.
- **Protected Surface**: All pages and API endpoints require a valid `rollbook_session` cookie; unauthorized requests receive a clean `401 Unauthorized` (for APIs) or are redirected to `/login`.
- **Default Credentials**: `admin` / `rollbook` (customizable via `APP_USERNAME`, `APP_PASSWORD`, `APP_SESSION_SECRET` in `.env`).

---

## 🧭 One-Click Onboarding Wizard (`src/components/OnboardingWizard.tsx`)

When launching with an empty database, Roll Book automatically presents an onboarding wizard:
1. **Welcome**: Introduces the system's core capabilities.
2. **Section Selection**: One-tap selection from 22 preloaded MIT Bengaluru CSE sections (`C01`–`C22`).
3. **Confirmation**: Instantly populates the 10 corresponding subjects and weekly timetable schedule.
4. **Completion**: Direct transition to the dashboard with an optional prompt for SLCM sync.

---

## 🔌 API Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/login` — Verifies credentials and sets signed HTTP-only session cookie.
- `POST /api/auth/logout` — Invalidates session cookie and redirects.
- `GET /api/auth/me` — Checks current authentication state and default credential status.

### 2. Courses (`/api/courses`)
- `GET /api/courses` — Returns all courses with timetable slots and historical attendance records.
- `POST /api/courses` — Creates a new course `{ name, code, requiredPercent, color }`.
- `PUT /api/courses/[id]` — Updates an existing course.
- `DELETE /api/courses/[id]` — Deletes a course and cascades deletion to associated slots and attendance records.

### 3. Timetable (`/api/timetable`)
- `GET /api/timetable` — Returns all recurring schedule slots.
- `POST /api/timetable` — Creates a slot `{ courseId, weekday, label, room }`.
- `PUT /api/timetable/[id]` — Updates slot details.
- `DELETE /api/timetable/[id]` — Deletes a timetable slot.

### 4. Official Sections (`/api/sections`)
- `GET /api/sections` — Returns metadata for all 22 official department sections.
- `POST /api/sections/apply` — Generates a preview diff or applies the section's timetable slots to the database.

### 5. Attendance Records (`/api/attendance`)
- `GET /api/attendance` — Query records filtered by `courseId`, `date`, `startDate`, `endDate`, or `month`.
- `POST /api/attendance` — Creates or batch-creates confirmed attendance logs `{ courseId, date, status, note }`.
- `PUT /api/attendance/[id]` — Edits an existing record.
- `DELETE /api/attendance/[id]` — Deletes a record.

### 6. Sync & Reconciliation (`/api/sync/reconcile`)
- `POST /api/sync/reconcile` — Accepts `{ courses, syncedAt, apply, merges }`.
  - When `apply: false`, runs fuzzy matching against existing subjects and returns merge candidates with diff metrics.
  - When `apply: true`, writes verified baseline snapshots to `syncedPresent`/`syncedAbsent` without fabricating fake calendar records.

### 7. Database Reset & Danger Zone (`/api/reset`)
- `POST /api/reset` — Atomic deletion of all courses, slots, and attendance records (`seedSample: boolean` option to reload baseline).

### 8. Data Portability (`/api/export`)
- `GET /api/export?format=csv` — Downloads complete attendance audit trail as spreadsheet CSV.
- `GET /api/export?format=json` — Generates a full database backup snapshot.
- `POST /api/export` — Restores database state from a backup JSON file.
