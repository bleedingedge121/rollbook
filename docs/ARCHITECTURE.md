# Roll Book Architecture & Data Engine

This document outlines the technical architecture, multi-user data model, security layer, and API design of **Roll Book**.

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
  chatRequestCount Int       @default(0)
  chatRequestDate  String?
  createdAt        DateTime  @default(now())
  courses          Course[]
  holidays         Holiday[]
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
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String   // ISO YYYY-MM-DD
  label     String   // e.g. "Diwali Break", "Mid-Term Exams"
  type      String   @default("holiday") // "holiday" | "exam"
  createdAt DateTime @default(now())

  @@unique([userId, date])
  @@index([userId])
}
```

### Multi-Tenant Compound Indexes
- **`Course: @@unique([userId, code])`**: Ensures each user can have their own course catalog without conflicts when multiple friends take the same course (e.g. `CSE101`).
- **`Holiday: @@unique([userId, date])`**: Allows different users to record university holidays and exam periods on the same dates independently.

---

## 🔐 Multi-User Security & Session Management

- **Password Hashing**: Passwords are encrypted using `bcryptjs` with 10 salt rounds. Passwords require a minimum length of 8 characters.
- **Username Normalization**: All usernames are normalized to lowercase on write and lookup, preventing duplicate account collisions and casing lockouts.
- **Web Crypto HMAC-SHA256**: Uses `crypto.subtle` for token signing and validation, ensuring 100% compatibility across both Node.js API routes and the Next.js Edge Middleware runtime.
- **Edge Middleware (`src/middleware.ts`)**: All routes are protected by default except public paths (`/login`, `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`). Unauthenticated API requests receive `401 Unauthorized`.
- **Session Helpers (`src/lib/session.ts`)**:
  - `requireUser(req)` extracts and verifies the caller's session token, returning their `{ userId, username }` or a 401 response.
  - `verifyCourseOwnership(courseId, userId)` checks that a target course belongs to the authenticated user before executing writes or reads, returning `403 Forbidden` if mismatched.

---

## 🔌 Scoped API Endpoints

### 1. Authentication (`/api/auth`)
- `POST /api/auth/signup` — Registers a new account (validates unique lowercase username, min 8 char password, hashes password, sets session cookie).
- `POST /api/auth/login` — Verifies credentials against the database and sets signed HTTP-only session cookie.
- `POST /api/auth/logout` — Clears the session cookie.
- `GET /api/auth/me` — Returns the current authenticated user's ID and username.

### 2. Courses (`/api/courses`)
- `GET /api/courses` — Returns all courses for the authenticated user.
- `POST /api/courses` — Creates a course tied to `userId`.
- `GET /api/courses/[id]` — Returns course details if owned by caller (403 if belonging to another user).
- `PUT /api/courses/[id]` — Updates an existing course if owned by caller.
- `DELETE /api/courses/[id]` — Deletes a course and cascades deletion to associated slots and records.

### 3. Timetable (`/api/timetable`)
- `GET /api/timetable` — Returns all timetable slots for the user's courses.
- `POST /api/timetable` — Creates a slot after verifying course ownership.
- `PUT /api/timetable/[id]` — Updates slot details (checks ownership of course).
- `DELETE /api/timetable/[id]` — Deletes a timetable slot.

### 4. Attendance Records (`/api/attendance`)
- `GET /api/attendance` — Returns records filtered by caller's courses.
- `POST /api/attendance` — Logs attendance (verifies `courseId` belongs to caller).
- `PUT /api/attendance/[id]` — Edits an existing record (verifies ownership).
- `DELETE /api/attendance/[id]` — Deletes a record (verifies ownership).

### 5. Holidays & Exam Days (`/api/holidays`)
- `GET /api/holidays` — Returns caller's declared holidays.
- `POST /api/holidays` — Upserts single or range holidays under `userId_date`.
- `DELETE /api/holidays/[id]` — Deletes a holiday declaration owned by caller.

### 6. AI Attendance Advisor (`/api/chat`)
- `POST /api/chat` — Google Gemini (`@google/genai`) AI endpoint using `gemini-flash-latest` with native database tools (`get_attendance_summary`, `get_course_detail`, `get_upcoming_classes`, `get_unlogged_sessions`, `add_holiday`, `delete_holiday`, `list_holidays`). All tools are scoped to the caller's `userId`. Enforces a 50 request/day quota per user.

### 7. Sync & Sections
- `GET /api/sections` — Returns official section list.
- `POST /api/sections/apply` — Applies section timetable slots strictly to caller's account.
- `POST /api/sync/reconcile` — Computes SLCM diff and applies baseline updates strictly to caller's subjects.

### 8. Database Reset (`/api/reset`)
- `POST /api/reset` — Atomically clears **only** the authenticated caller's data (courses, slots, attendance, holidays), leaving all other users unaffected.

### 9. Data Portability (`/api/export`)
- `GET /api/export` — Exports CSV or JSON backup of caller's data.
- `POST /api/export` — Restores data snapshot under caller's `userId`.
