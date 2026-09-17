// sync.js — robust SLCM attendance synchronizer.
// Captures Salesforce Apex attendance response through both request inspection and JSON response matching.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const authPath = path.resolve(__dirname, 'auth.json');
  if (!fs.existsSync(authPath)) {
    console.error('\n[Error] auth.json not found in scraper directory.');
    console.error('Please run: node login.js first to log in and save your session.\n');
    process.exit(1);
  }

  const isDebug = process.argv.includes('--debug') || process.argv.includes('--head');
  const browser = await chromium.launch({
    headless: !isDebug,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState: authPath,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  let attendanceData = null;
  let capturedActionName = '';

  console.log('Connecting to MAHE SLCM portal...');

  // Multi-tier response listener: inspects URL, decoded POST body, and returned JSON payload
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/s/sfsites/aura') || response.request().method() !== 'POST') {
      return;
    }

    try {
      const postData = response.request().postData() || '';
      const decodedPost = decodeURIComponent(postData);

      // Attempt to parse JSON response
      const json = await response.json();
      if (!json || !json.actions || !Array.isArray(json.actions)) return;

      for (const action of json.actions) {
        // Check 1: Action descriptor includes getCOPList
        const isCOPList =
          decodedPost.includes('getCOPList') ||
          postData.includes('getCOPList') ||
          (action.descriptor && action.descriptor.includes('getCOPList'));

        // Check 2: Structure check (array of course objects with attendance fields)
        const isAttendancePayload =
          Array.isArray(action.returnValue) &&
          action.returnValue.length > 0 &&
          action.returnValue.some(
            (item) =>
              item &&
              (item.Total_number_of_classes_attended__c !== undefined ||
                item.CourseOffering !== undefined ||
                item.Total_Classes__c !== undefined)
          );

        if (action.state === 'SUCCESS' && (isCOPList || isAttendancePayload)) {
          attendanceData = action.returnValue;
          capturedActionName = action.descriptor || 'getCOPList';
          console.log(`✓ Captured attendance payload (${attendanceData.length} records found).`);
        }
      }
    } catch (e) {
      // Ignore non-JSON or unparseable responses
    }
  });

  try {
    await page.goto('https://maheslcmtech.manipal.edu/s/attendance', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (err) {
    console.warn('Navigation note:', err.message);
  }

  // Allow single-page application components up to 15 seconds to dispatch their Aura calls
  console.log('Awaiting portal component telemetry...');
  const maxWaitMs = 15000;
  const pollInterval = 500;
  let elapsed = 0;

  while (!attendanceData && elapsed < maxWaitMs) {
    await page.waitForTimeout(pollInterval);
    elapsed += pollInterval;

    // Check if redirected to Microsoft SSO / login page
    const currentUrl = page.url();
    if (
      currentUrl.includes('login.microsoftonline.com') ||
      currentUrl.includes('/login') ||
      currentUrl.includes('/s/login')
    ) {
      console.error('\n[Session Expired] The portal redirected to the login page.');
      console.error('Your authentication token has expired.');
      console.error('Resolution: Run "node login.js" to authenticate, then retry "node sync.js".\n');
      await browser.close();
      process.exit(1);
    }
  }

  if (!attendanceData) {
    const finalUrl = page.url();
    console.error('\n[Error] Did not capture attendance data from SLCM.');
    console.error(`Current Page URL: ${finalUrl}`);
    console.error('Possible causes:');
    console.error(' 1. Your session is expired. Fix: run "node login.js".');
    console.error(' 2. Network/VPN block on SLCM endpoints.');
    console.error(' 3. Run with debug mode: "node sync.js --debug" to inspect the browser visually.\n');
    await browser.close();
    process.exit(1);
  }

  // Format into standard Roll Book schema
  const courses = attendanceData.map((c) => {
    const present = c.Total_number_of_classes_attended__c ?? 0;
    const total = c.Total_Classes__c ?? 0;
    const absent = Math.max(0, total - present);

    return {
      name:
        c.CourseOffering?.LearningCourse?.Name ??
        c.CourseOffering?.Name ??
        c.Name ??
        'Unknown Course',
      code: c.Course_Code__c ?? '',
      present,
      absent,
    };
  });

  const outputPath = path.resolve(__dirname, 'sync-output.json');
  const payload = {
    courses,
    syncedAt: new Date().toISOString(),
    capturedVia: capturedActionName,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log(`\n========================================`);
  console.log(`✓ Synchronized ${courses.length} courses successfully!`);
  console.log(`Saved output to: ${outputPath}`);
  console.log(`========================================\n`);

  await browser.close();
})();
