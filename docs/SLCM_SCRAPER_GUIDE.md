# SLCM 2.0 Scraper & Bridge Guide

This guide documents the architecture, lifecycle, and debugging procedures for the **MAHE SLCM 2.0 (Salesforce Experience Cloud)** scraper.

---

## 🔍 How It Works

MAHE's SLCM 2.0 portal runs on **Salesforce Lightning Experience Cloud (Aura Framework)** behind Microsoft Azure SSO and Multi-Factor Authentication (MFA).

Rather than attempting to forge volatile Salesforce session tokens, CSRF tokens, and `fwuid` hashes manually, the scraper employs **real-browser response interception**:

```
[Student] ---> [Node login.js] ---> [Visible Chromium Window] ---> [Microsoft SSO + MFA]
                                                                          |
                                                                    (Success)
                                                                          v
                                                                 [auth.json Saved]
                                                                          |
[Roll Book] <--- [sync-output.json] <--- [Headless sync.js] <--------------+
```

### 1. `login.js` (Interactive Auth Session)
- Launches a visible Chromium browser via Playwright.
- Navigates to `https://maheslcmtech.manipal.edu/s/attendance`.
- Waits for the student to complete Microsoft SSO and MFA authentication.
- Once redirected back to the `/s/attendance` route, captures full session cookies, local storage, and session tokens into `auth.json`.

### 2. `sync.js` (Headless Apex Interceptor)
- Boots a headless Chromium browser using `auth.json`.
- Intercepts outgoing `/s/sfsites/aura` POST requests specifically matching `getCOPList` or `commonLWCApexMethods`.
- **Telemetry Beacon Filtering**: Discards OpenTelemetry background beacons (`O11yInstrumentationResult`, `interactionMetrics`).
- **Multi-Semester Winner Strategy**: SLCM fires `getCOPList` multiple times on load (once per semester filter). The scraper retains the largest non-empty payload, ensuring trailing empty calls (0 items) do not overwrite verified records (10 items).
- **Deep Envelope Unwrapping**: Recursively parses `action.returnValue` trees or JSON strings to locate the true array of course objects.
- Extracts verified counts (`Total_number_of_classes_attended__c`, `Total_Classes__c`, `Course_Code__c`, `CourseOffering`).
- Outputs clean data into `sync-output.json`.

---

## 🛠️ Step-by-Step Usage

### Step 1: Initialize Scraper Environment
```bash
cd scraper
npm install
npx playwright install chromium
```

### Step 2: One-Time Login (or on session expiry)
```bash
node login.js
```
A browser will open. Log in with your MAHE email and approve your Microsoft Authenticator prompt. Wait until `auth.json` is generated.

### Step 3: Run Desktop Reverse-Push Sync (Recommended)
```bash
node agent.js
```
On first run, `agent.js` prompts for your hosted application URL (e.g. `https://rollbook.vercel.app`) and your **Personal Sync Token** (generated under **Settings** $\rightarrow$ **SLCM Sync Bridge** on desktop). These are saved in `scraper/.env`.

The script:
1. Validates or prompts for interactive Microsoft SSO + MFA login.
2. Intercepts attendance data directly from Salesforce Aura responses.
3. Automatically posts the verified payload to `{APP_URL}/api/sync/push`.
4. Your hosted Roll Book dashboard updates immediately!

### Step 4: Browser Bookmarklet Sync (Zero-Install, Mobile & Desktop)
If you don't want to run Node.js or terminal commands:
1. In Roll Book, open **Settings** $\rightarrow$ **Sync & Import** and click **Generate My Sync Token**.
2. Drag the **🔖 Sync Roll Book** button to your browser bookmarks bar (or click **Copy Bookmarklet Code** on mobile).
3. In a new tab, log into your university SLCM portal (`https://maheslcmtech.manipal.edu`).
4. Click your **Sync Roll Book** bookmark. A subtle status pill will appear: *"Listening for attendance data…"*
5. Click into the **Attendance** section on SLCM.
6. The bookmarklet captures the live Salesforce Aura response and automatically pushes it to your Roll Book account!
7. If the university site's Content Security Policy blocks the direct push, the bookmarklet presents the captured JSON with a **Copy** button. Expand **"Bookmarklet showed you data to copy instead?"** in Roll Book settings, paste it, and click **Apply Pasted Data**.

### Step 5: Manual Fallback (Offline JSON Import)
If you prefer offline manual import:
1. Run `node sync.js` to output `scraper/sync-output.json`.
2. Open Roll Book web app on your desktop browser.
3. Go to **Settings** $\rightarrow$ **Sync & Import**.
4. Click **Upload sync-output.json manually**, choose `scraper/sync-output.json`, and confirm the reconciliation diff.

> [!NOTE]
> **Scraper Execution Context**: Both the **Browser Bookmarklet** and the **Desktop Scraper (`node agent.js`)** use the same underlying personal sync token architecture. While the Playwright agent requires local Node.js, the Bookmarklet runs inside your active browser session on desktop or mobile with zero installation.

---

## 🚨 Troubleshooting & Diagnostics

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `[Session Expired] Redirected to login page` | Salesforce or Azure SSO token expired | Run `node login.js` to refresh session |
| `auth.json not found` | First-time setup incomplete | Run `node login.js` before `sync.js` |
| `Intercepted call with 0 items` | Sibling empty semester tabs firing | `sync.js` auto-retains the largest non-empty payload |
| Navigation timeout on slow network | Page loading exceeded timeout envelope | Check VPN/Wi-Fi connection |
| SLCM internal endpoint changed | MAHE updated Apex method name | Open DevTools Network tab on `/s/attendance`, find the new Fetch call, and update `postData.includes(...)` in `sync.js` |
