// login.js — run this once, and again whenever your session expires.
// Opens a real, visible browser so you can log in through Microsoft SSO
// (including MFA) yourself. Once you land back on the attendance page,
// it saves the authenticated session to auth.json for sync.js to reuse.
//
// Run:  node login.js

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://maheslcmtech.manipal.edu/s/attendance');

  console.log('A browser window has opened.');
  console.log('Log in with your MAHE Microsoft account, complete MFA if prompted.');
  console.log('Waiting for you to land back on the attendance page (up to 5 minutes)...');

  // Wait until SSO finishes redirecting us back to the attendance page
  await page.waitForURL('**/s/attendance**', { timeout: 5 * 60 * 1000 });

  // Give the single-page app a moment to finish its own internal loading
  await page.waitForTimeout(5000);

  await context.storageState({ path: 'auth.json' });
  console.log('Session saved to auth.json. You can now run: node sync.js');

  await browser.close();
})();
