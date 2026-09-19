// login.js — interactive Microsoft SSO + MFA login module
const { chromium } = require('playwright');
const path = require('path');

async function runLogin(authPath = path.resolve(__dirname, 'auth.json')) {
  console.log('[Login] Launching interactive browser for MAHE Microsoft SSO...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://maheslcmtech.manipal.edu/s/attendance', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    console.log('[Login] A browser window has opened.');
    console.log('[Login] Log in with your MAHE Microsoft account, complete MFA if prompted.');
    console.log('[Login] Waiting for redirect back to attendance page (up to 5 minutes)...');

    await page.waitForURL('**/s/attendance**', { timeout: 5 * 60 * 1000 });
    await page.waitForTimeout(5000);

    await context.storageState({ path: authPath });
    console.log(`[Login] Session saved to ${authPath}`);
    return { success: true, authPath };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runLogin()
    .then(() => console.log('Login complete. You can now run: node sync.js'))
    .catch((err) => {
      console.error('Login error:', err);
      process.exit(1);
    });
}

module.exports = { runLogin };
