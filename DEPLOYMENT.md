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
   - Build Command: `prisma generate && next build` (defined in `package.json`)
   - Output Directory: `.next`
5. **Environment Variables**:
   Add the following environment variables in Vercel:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | Neon **Pooled** PostgreSQL connection string | `postgresql://user:pass@ep-xyz-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `APP_SESSION_SECRET` | 32+ character random string for signing session tokens | `a8f3b2c1...` |
| `GEMINI_API_KEY` | Google Gemini API key from AI Studio | `AIzaSy...` |
| `AGENT_ALLOWED_ORIGIN`| Domain of your hosted app for CORS validation | `https://rollbook.vercel.app` |

6. Click **Deploy**. Vercel will generate the Prisma Client, compile Next.js, and provide your live URL.

---

## 3. Account Management & Security

- **Sign Up**: Friends can visit `/login`, switch to the **Sign Up** tab, and create their own separate account with a username and password (minimum 8 characters).
- **Data Isolation**: All courses, timetable slots, attendance history, and holidays are strictly isolated by `userId`. Cross-account mutations and queries are rejected with `403 Forbidden`.
- **Password Resets**: Roll Book does not require email servers or OAuth for its friend-group scale. If a friend forgets their password, the owner can update the user's `passwordHash` directly in Neon or run:
  ```bash
  npx tsx scripts/migrate-to-multiuser.ts <username> <new_password>
  ```
- **Gemini AI Rate Limiting**: The Gemini free tier provides ~1,500 requests/day for the whole deployment. To ensure fair access across all users, each account has a built-in daily limit of 50 AI requests before returning a friendly wait message.

---

## 4. Local University Portal Sync (`scraper/agent.js`)

The scraper uses Playwright and Chromium to perform interactive university portal login and capture attendance tables. **It runs solely on the user's local machine and should never be deployed to Vercel.**

When using the hosted web app:
1. Each user runs the agent locally on their computer:
   ```bash
   AGENT_ALLOWED_ORIGIN="https://rollbook.vercel.app" node scraper/agent.js
   ```
2. The agent listens exclusively on `127.0.0.1:4747` (loopback only) and permits CORS requests from your configured `AGENT_ALLOWED_ORIGIN`.
3. In the hosted Roll Book app under **Command & Sync**, clicking **1-Click Sync** will trigger the user's local agent, perform the scrape, and import the attendance data straight into their own account.
