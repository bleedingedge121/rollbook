# SLCM Scraper for Roll Book

Pulls your real attendance numbers from MAHE's SLCM 2.0 portal (Salesforce-based) into a `sync-output.json` file that Roll Book can import.

## Setup

```bash
cd scraper
npm init -y
npm install playwright
npx playwright install chromium
```

## Usage

1. **One-Time Login / Refresh Session**
   ```bash
   node login.js
   ```
   A browser window will open. Log in using your MAHE Microsoft account and complete 2FA. Once you land on the attendance page, your session is saved to `auth.json`.

2. **Sync Attendance Numbers**
   ```bash
   node sync.js
   ```
   Runs headlessly, captures the `getCOPList` Apex response from SLCM, and writes `sync-output.json`.

3. **Import into Roll Book**
   In the Roll Book web app, navigate to **Settings > Sync & Data**, click **Load Synced Data**, and select `scraper/sync-output.json`.

## Notes
- `auth.json` contains active session tokens. Never commit it to git or share it.
- When `sync.js` reports the session is expired, simply rerun `node login.js`.
