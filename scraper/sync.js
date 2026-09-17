// sync.js — pulls current attendance using the session saved by login.js.
// Intercepts the Salesforce Apex getCOPList response directly via page.waitForResponse,
// avoiding 'networkidle' timeouts caused by background Aura telemetry/polling beacons.
//
// Run:    node sync.js
// Output: sync-output.json, in the shape Roll Book's Settings > Sync expects

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const authPath = path.resolve(__dirname, 'auth.json');
  if (!fs.existsSync(authPath)) {
    console.error('auth.json not found. Please run: node login.js first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: authPath });
  const page = await context.newPage();

  let attendanceData = null;

  console.log('Navigating to SLCM attendance portal...');

  // Set up the response listener promise BEFORE navigation to capture the Apex call reliably
  const copListResponsePromise = page.waitForResponse(
    async (response) => {
      const url = response.url();
      if (!url.includes('/s/sfsites/aura') || response.request().method() !== 'POST') {
        return false;
      }
      const postData = response.request().postData() || '';
      return postData.includes('getCOPList');
    },
    { timeout: 45000 }
  ).catch(() => null); // catch timeout gracefully so we can inspect page URL

  try {
    // Use 'domcontentloaded' instead of 'networkidle' because Salesforce Experience Cloud
    // runs continuous background polling/analytics beacons that prevent networkidle.
    await page.goto('https://maheslcmtech.manipal.edu/s/attendance', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
  } catch (err) {
    console.warn('Navigation note:', err.message);
  }

  // Check if session was redirected away to Microsoft login
  if (!page.url().includes('/s/attendance')) {
    console.error('\n[Error] Session appears expired (redirected away from attendance).');
    console.error('Please re-authenticate by running: node login.js\n');
    await browser.close();
    process.exit(1);
  }

  console.log('Waiting for getCOPList Apex attendance data...');
  const response = await copListResponsePromise;

  if (response) {
    try {
      const json = await response.json();
      const action = json.actions?.[0];
      if (action?.state === 'SUCCESS' && Array.isArray(action.returnValue)) {
        attendanceData = action.returnValue;
      }
    } catch (e) {
      console.error('Failed to parse Salesforce JSON response:', e.message);
    }
  }

  if (!attendanceData) {
    console.error('\n[Error] Did not capture the getCOPList response.');
    console.error('Either your session is stale (rerun: node login.js) or SLCM portal internals changed.');
    await browser.close();
    process.exit(1);
  }

  const courses = attendanceData.map((c) => {
    const present = c.Total_number_of_classes_attended__c ?? 0;
    const total = c.Total_Classes__c ?? 0;
    const absent = Math.max(0, total - present);

    return {
      name: c.CourseOffering?.LearningCourse?.Name ?? c.Name,
      code: c.Course_Code__c ?? '',
      present,
      absent,
    };
  });

  const outputPath = path.resolve(__dirname, 'sync-output.json');
  const payload = {
    courses,
    syncedAt: new Date().toISOString(),
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log(`\nSuccessfully synchronized ${courses.length} courses to sync-output.json`);
  console.log(`Saved at: ${outputPath}`);

  await browser.close();
})();
