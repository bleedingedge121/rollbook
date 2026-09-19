# Roll Book — Vercel & Neon Deployment Guide

This guide details how to host Roll Book on Vercel with a free-tier PostgreSQL database from Neon, configure environment variables, and manage multi-user accounts and local scraper syncing.

---

## 1. Database Setup (Neon PostgreSQL)

1. Sign up for a free account at [neon.tech](https://neon.tech).
2. Create a new project (e.g., `rollbook`).
3. In your Neon Dashboard, go to **Connection Details** and select **Pooled connection**.
   - **Important**: Ensure the host includes `-pooler` (e.g., `ep-quiet-star-123456-pooler.us-east-2.aws.neon.tech`) or has `?pgbouncer=true` appended.
   - *Why*: Vercel executes Next.js API routes across stateless serverless functions. Without connection pooling (PgBouncer), concurrent user requests can rapidly exhaust PostgreSQL connection limits.
4. Initialize the database schema from your local terminal:
   ```bash
   # In your .env file or command line:
   DATABASE_URL="postgresql://user:password@ep-sample-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
   npx prisma db push
   ```

---

## 2. Vercel Deployment

1. Push your repository to GitHub or GitLab.
2. Log into [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import the `rollbook` repository.
4. **Build & Development Settings**:
   - Framework Preset: `Next.js`
   - Build Command: `prisma generate && prisma db push --accept-data-loss && next build` (defined in `package.json`, automatically keeps Neon schema in sync)
   - Output Directory: `.next`
5. **Environment Variables**:
   Add the following environment variables in Vercel:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon **Pooled** PostgreSQL connection string | `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `APP_SESSION_SECRET` | 32+ character random string for signing session tokens | `a8f3b2c1...` |
| `GEMINI_API_KEY` | Google Gemini API key from AI Studio | `AIzaSy...` |
| `AGENT_ALLOWED_ORIGIN`| Domain of your hosted app for CORS validation | `https://rollbook.vercel.app` |

6. Click **Deploy**. Vercel will generate the Prisma Client, synchronize Neon's database schema, compile Next.js, and provide your live URL.

---

## 3. Account Management & Security

- **Sign Up**: Friends can visit `/login`, switch to the **Sign Up** tab, and create their own separate account with a username and password (minimum 8 characters).
- **Data Isolation**: All courses, timetable slots, attendance records, and sync tokens are strictly isolated by `userId`. Cross-account mutations and queries are rejected with `403 Forbidden`.
- **Shared Academic Calendar**: Holidays, recesses, and exam dates are stored centrally as a shared institutional calendar. Visible in real time to all students in read-only mode, and managed exclusively by administrators.
- **Administrator Role & Console**:
  - The first registered user, or any account created with the username `admin`, is automatically assigned the `admin` role.
  - You can also promote any user manually via CLI:
    ```bash
    npx tsx scripts/make-admin.ts <username>
    ```
  - Administrators have access to the `/admin` console for managing the global calendar, inspecting student records for troubleshooting, wiping test data, and deleting accounts.
- **Password Resets**: Roll Book does not require email servers or OAuth for its friend-group scale. If a friend forgets their password, run:
  ```bash
  npx tsx scripts/set-password.ts <username> <new_password>
  ```
- **Mobile Smartphone Experience**: Roll Book is optimized for iPhone (iOS Safari) and Android mobile browsers with a docked bottom navigation bar, safe-area inset handling (`env(safe-area-inset-bottom)`), responsive SVG dials, and standardized 12-hour AM/PM and DD/MM/YYYY formatting. Desktop-only features (running the local Playwright scraper and manual JSON file restores) are automatically hidden on mobile viewports.
- **Gemini AI Rate Limiting**: The Gemini free tier provides ~1,500 requests/day for the whole deployment. To ensure fair access across all users, each account has a built-in daily limit of 50 AI requests before returning a friendly wait message.

---

## 4. University Portal Sync (Reverse-Push Architecture)

MAHE's SLCM portal requires Microsoft SSO with Multi-Factor Authentication (MFA) on the student's phone. Cloud servers cannot authenticate on a student's behalf, and modern browsers block HTTPS web pages from reaching local HTTP ports on the user's machine (Mixed Content / Local Network Access security). 

Roll Book solves this by using a **secure reverse-push architecture**: the local scraper pushes data *out* to the hosted app's authenticated API:

```
[Student's Laptop]                                 [Hosted Roll Book (Vercel)]
node scraper/agent.js  --------------------->  POST /api/sync/push
(logs in with MFA,     (HTTPS outbound POST)    (Header: Authorization: Bearer <syncToken>)
 scrapes SLCM)                                  (reconciles & saves directly to user account)
```

### How a User Syncs Their Attendance:
1. **Generate Personal Sync Token**:
   - In the hosted web app, navigate to **Settings** $\rightarrow$ **SLCM Sync Bridge**.
   - Click **Generate My Sync Token** and copy the token (`rb_sync_...`). The token is stored as a one-way SHA-256 hash in the database and never shown again.
2. **Run Scraper on Local Computer**:
   - Clone the repo and run:
     ```bash
     cd scraper
     npm install
     npx playwright install chromium
     node agent.js
     ```
   - On first run, it will prompt for the hosted app URL (e.g. `https://rollbook.vercel.app`) and personal sync token. These are saved to `scraper/.env` (gitignored).
   - If no portal session exists, a browser window opens automatically for Microsoft SSO + MFA login.
   - The script scrapes the live attendance figures and immediately pushes them to `{APP_URL}/api/sync/push`.
3. **Refresh Dashboard**:
   - Refresh the Roll Book web app—the dashboard immediately displays the fresh attendance counts, safe skip margins, and "Last synced" timestamp!

