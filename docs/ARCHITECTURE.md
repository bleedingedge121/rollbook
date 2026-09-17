# Roll Book Architecture & Data Engine

This document outlines the technical architecture, data model, and API design of **Roll Book**.

---

## 🏛️ System Philosophy

Roll Book operates on one non-negotiable principle:

> **Never assume a lecture happened just because the timetable scheduled it.**

Traditional attendance trackers infer attendance by automatically ticking off slots as dates pass on the calendar. Roll Book strictly bifurcates attendance management into two unpolluted layers:

1. **Actual Layer (Past + Today)**: Attendance statistics ($\text{Percentage}$, $\text{Held}$, $\text{Present}$, $\text{Absent}$) are calculated *exclusively* from confirmed database entries. Unlogged calendar dates remain unlogged and never contribute to either the numerator or denominator.
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

## 🔌 API Endpoints

### 1. Courses (`/api/courses`)
- `GET /api/courses` — Returns all courses with timetable slots and historical attendance records.
- `POST /api/courses` — Creates a new course `{ name, code, requiredPercent, color }`.
- `PUT /api/courses/[id]` — Updates an existing course.
- `DELETE /api/courses/[id]` — Deletes a course and cascades deletion to associated slots and attendance records.

### 2. Timetable (`/api/timetable`)
- `GET /api/timetable` — Returns all recurring schedule slots.
- `POST /api/timetable` — Creates a slot `{ courseId, weekday, label, room }`.
- `PUT /api/timetable/[id]` — Updates slot details.
- `DELETE /api/timetable/[id]` — Deletes a timetable slot.

### 3. Attendance Records (`/api/attendance`)
- `GET /api/attendance` — Query records filtered by `courseId`, `date`, `startDate`, `endDate`, or `month`.
- `POST /api/attendance` — Creates or batch-creates confirmed attendance logs `{ courseId, date, status, note }`.
- `PUT /api/attendance/[id]` — Edits an existing record.
- `DELETE /api/attendance/[id]` — Deletes a record.

### 4. Sync & Reconciliation (`/api/sync/reconcile`)
- `POST /api/sync/reconcile` — Accepts `{ courses, syncedAt, apply, selectedCourseCodes }`.
  - When `apply: false`, returns a side-by-side comparison diff between incoming SLCM numbers and current database records.
  - When `apply: true`, synchronizes confirmed attendance records for selected courses to match official figures.

### 5. Data Portability (`/api/export`)
- `GET /api/export?format=csv` — Downloads complete attendance audit trail as a spreadsheet CSV.
- `GET /api/export?format=json` — Generates a full database backup snapshot.
- `POST /api/export` — Restores database state from a backup JSON file.
