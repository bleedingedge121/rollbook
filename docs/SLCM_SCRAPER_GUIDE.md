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

### Method 1: Instant Browser Console Sync (Zero-Install, Zero Terminal - Recommended for Laptop)
If you don't want to run Node.js or terminal commands, you can sync directly from your browser:
1. In Roll Book, open **Settings** $\rightarrow$ **Sync & Import** and generate your Personal Sync Token.
2. Click **`💻 Copy Console Script (Laptop)`**.
3. In a separate tab, log into your university SLCM portal and navigate to the **Attendance** section.
4. Press <kbd>F12</kbd> (or right-click anywhere $\rightarrow$ *Inspect*) and click the **Console** tab.
5. *(Note for first-time DevTools users: If Chrome displays a security warning about pasting, type `allow pasting` into the console and press Enter).*
6. Paste the copied code (<kbd>Ctrl+V</kbd>) and hit <kbd>Enter</kbd>.
7. A dark **Roll Book Sync** banner will appear at the bottom-right of SLCM. Click another tab (like **Home**) and click back into **Attendance** so the network request fires.
8. The banner will capture all your subjects. Because Salesforce sites restrict outbound network requests (`connect-src`), the banner provides a convenient **Copy JSON** button. Click **Copy JSON**, switch back to Roll Book Settings $\rightarrow$ **Paste Attendance Data**, paste, and click **Apply Pasted Data**!

### Method 2: Mobile Phone Sync Advice (iPhone / Android)
Mobile browsers restrict developer tools and enforce strict policies against bookmarklet scripts.
- **Best Practice**: Run the 5-second console script (Method 1) on any laptop or desktop once a week.
- Because Roll Book saves all your courses and attendance directly to your account in Neon PostgreSQL, **opening Roll Book on your phone will automatically show all your updated figures in real-time**!

### Method 3: Automated Desktop CLI Scraper (`agent.js`)
For automated desktop scraping without touching DevTools:
```bash
cd scraper
npm install
npx playwright install chromium
node agent.js
```
On first run, `agent.js` prompts for your hosted application URL (e.g. `https://rollbook-peach.vercel.app`) and your **Personal Sync Token**. These are saved in `scraper/.env`.

The script:
1. Validates or prompts for interactive Microsoft SSO + MFA login.
2. Intercepts attendance data directly from Salesforce Aura responses.
3. Automatically posts the verified payload to `{APP_URL}/api/sync/push`.
4. Your hosted Roll Book dashboard updates immediately!

### Method 4: Manual File Fallback (Offline JSON Import)
If you prefer offline manual import:
1. Run `node sync.js` to output `scraper/sync-output.json`.
2. Open Roll Book web app on your desktop browser.
3. Go to **Settings** $\rightarrow$ **Sync & Import** $\rightarrow$ Click **Upload sync-output.json**.
4. The visual **Sync Reconcile Modal** displays a course-by-course preview (present, absent, percentage change) before applying updates to your database.

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
