# Roll Book — full build prompt

Paste this whole thing as the task/mission for the agent (Hermes or
Google Antigravity). It assumes the agent has file system + terminal
access in a project folder; if not, treat this as the spec to hand-code
against instead.

## Context

I already have two working scraper files, in `/scraper`:
- `login.js` — one-time interactive Playwright login to MAHE's SLCM 2.0
  portal (Salesforce-based, Microsoft SSO + MFA), saves the session to
  `auth.json`
- `sync.js` — headless run that reuses `auth.json`, listens for the
  `getCOPList` Salesforce Apex response on the `/s/attendance` page, and
  writes `sync-output.json` in the shape `{ courses: [{ name, code,
  present, absent }], syncedAt }`

Don't rewrite these — copy them into the project as-is under `/scraper`
and build the web app around them. If you need to touch them, only fix
bugs; keep the response-interception approach (never hand-craft the
Salesforce Aura request/token yourself, it rotates per session/deploy).

## What to build

"Roll Book" — a personal attendance tracker that never assumes a class
happened just because the timetable says it should have. Two clearly
separate modes:

1. **Actual mode** (past + today): attendance % per course comes only
   from confirmed present/absent counts. An unlogged past date is just
   unlogged — never silently counted either way.
2. **Planning mode** (future, calendar view): generated from a weekly
   recurring timetable, lets me toggle "plan to attend / plan to skip"
   on upcoming classes and see a projected % trajectory — visually
   distinct (e.g. dashed line) from the real, actual-data percentage.
   When a planned date arrives, prompt me to confirm it as real data;
   never auto-promote it silently.

## Stack

- Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui
- Recharts for trend charts and the actual-vs-projected comparison
- date-fns for calendar/date math
- Prisma + SQLite (single-user, local-first, no auth needed beyond the
  scraper's own SLCM login)

## Data model

```
Course          { id, name, code, requiredPercent }
TimetableSlot   { id, courseId, weekday(0-6), label }   // drives future
                                                          // calendar cells only
AttendanceRecord{ id, courseId, date, status: present|absent }
                                                          // ONLY for dates
                                                          // that actually
                                                          // happened and
                                                          // were confirmed
```

## Calculations (apply identically everywhere they're used)

```
pct = present / (present + absent) * 100

if pct >= required:
    maxSkippable = floor(present / (required/100) - total)
else:
    mustAttendNext = ceil((required/100 * total - present) / (1 - required/100))
    // undefined/infinite if required = 100 — surface that plainly, don't crash
```

## Views

- **Home** — overall % across all courses (actual data only), quick
  Present/Absent buttons for today per course
- **Subjects** — one card per course: %, held/present/absent, the
  skip-balance or must-attend line, a small trend sparkline
- **Calendar** — month grid. Past/today cells show actual status.
  Future cells come from the weekly timetable, each with a
  present/skip toggle, live-updating the projected % if that plan is
  followed. This is the feature to take from the Bunk app, done
  honestly — clearly labelled as a projection, never blended into the
  real percentage.
- **Settings** — manage courses and weekly timetable slots, per-course
  or global required %, CSV export/import, and a **"Load synced
  data"** button: a plain file `<input type="file">` that reads
  `sync-output.json` (produced by running `node scraper/sync.js`
  locally) and merges it into the course list — confirm before
  overwriting any manually-entered numbers for a course. This is the
  bridge since the web app itself can't reach local files or run the
  scraper on its own.

## Build order

1. Data model + manual entry + actual-mode calculations
2. Home + Subjects views
3. Calendar / planning mode
4. Charts
5. Copy in `/scraper` (login.js, sync.js as given) + wire up the
   Settings "Load synced data" import
6. README covering: `npm install`, `npx prisma migrate dev`, `npm run
   dev`, and separately how to run the scraper (`cd scraper && npm
   install && npx playwright install chromium && node login.js` once,
   then `node sync.js` whenever I want fresh numbers)

## Non-goals

- No auto-calculating "classes that should have happened" from the
  timetable and treating it as real
- No running the scraper from inside the hosted/dev web app process —
  it's a separate local script I run myself
- Don't touch the SLCM session cookie/token handling beyond what's in
  the given scraper files — it's session-based and expires; the
  correct response to a stale session is "tell me to rerun login.js",
  not trying to work around it
