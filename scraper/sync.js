// sync.js — robust SLCM attendance synchronizer.
// Specifically targets the getCOPList / commonLWCApexMethods Apex action request
// and retains the largest non-empty semester attendance capture.

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Helper to recursively unwrap nested Salesforce Aura / LWC envelopes
function extractAttendanceList(raw) {
  if (!raw) return [];

  // Case 1: Stringified JSON
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return extractAttendanceList(parsed);
    } catch {
      return [];
    }
  }

  // Case 2: Array of objects
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === 'object' && raw[0] !== null) {
      return raw;
    }
    return raw;
  }

  // Case 3: Object containing nested array or wrapper
  if (typeof raw === 'object' && raw !== null) {
    const candidateKeys = [
      'returnValue',
      'records',
      'copList',
      'copRecords',
      'data',
      'result',
      'courses',
      'items',
      'list',
    ];

    for (const key of candidateKeys) {
      if (raw[key]) {
        const extracted = extractAttendanceList(raw[key]);
        if (extracted.length > 0) return extracted;
      }
    }

    // Inspect all object properties
    for (const val of Object.values(raw)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'object') {
        return val;
      }
      if (typeof val === 'object' && val !== null) {
        const nested = extractAttendanceList(val);
        if (nested.length > 0) return nested;
      }
    }
  }

  return [];
}

// Checks if a candidate list has valid attendance/course objects
function hasValidCourseRecords(list) {
  if (!Array.isArray(list) || list.length === 0) return false;
  return list.some((item) => {
    if (!item || typeof item !== 'object') return false;
    return (
      item.Total_number_of_classes_attended__c !== undefined ||
      item.CourseOffering !== undefined ||
      item.Total_Classes__c !== undefined ||
      item.Course_Code__c !== undefined ||
      item.classesAttended !== undefined ||
      (item.Name && (item.present !== undefined || item.total !== undefined))
    );
  });
}

(async () => {
  const authPath = path.resolve(__dirname, 'auth.json');
  if (!fs.existsSync(authPath)) {
    console.error('\n[Error] auth.json not found in scraper directory.');
    console.error('Please run: node login.js first to log in and save your session.\n');
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    storageState: authPath,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  let validCourseList = null;
  let rawCapturedData = null;
  let capturedActionDescriptor = '';

  console.log('Connecting to MAHE SLCM portal...');

  // Set up response listener targeting the specific getCOPList / commonLWCApexMethods POST request
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('/s/sfsites/aura') || response.request().method() !== 'POST') {
      return;
    }

    try {
      const postData = response.request().postData() || '';
      const decodedPost = decodeURIComponent(postData);

      // Check if this outgoing request is specifically for getCOPList / attendance
      const isTargetRequest =
        decodedPost.includes('getCOPList') ||
        decodedPost.includes('commonLWCApexMethods') ||
        postData.includes('getCOPList');

      const json = await response.json();
      if (!json || !json.actions || !Array.isArray(json.actions)) return;

      for (const action of json.actions) {
        if (action.state !== 'SUCCESS' || !action.returnValue) continue;

        const descriptor = action.descriptor || '';

        // Discard any O11y / telemetry logging beacons
        if (
          descriptor.includes('instrumentation') ||
          descriptor.includes('telemetry') ||
          descriptor.includes('logMetrics')
        ) {
          continue;
        }

        const candidateList = extractAttendanceList(action.returnValue);

        // Accept if request matches getCOPList OR candidate list has valid course objects
        if (isTargetRequest || hasValidCourseRecords(candidateList)) {
          // CRITICAL: Only overwrite if candidateList is non-empty and larger than current capture.
          // This prevents empty sibling semester tabs (0 items) from overwriting real data (10 items).
          if (candidateList.length > 0 && candidateList.length > (validCourseList?.length || 0)) {
            validCourseList = candidateList;
            rawCapturedData = action.returnValue;
            capturedActionDescriptor = descriptor || 'getCOPList';
            console.log(
              `✓ Intercepted Apex attendance call [${capturedActionDescriptor}] with ${candidateList.length} items.`
            );
          } else if (candidateList.length === 0) {
            console.log(
              `  (ignored empty getCOPList response — keeping previous capture of ${validCourseList?.length || 0} items)`
            );
          }
        } else {
          if (descriptor && !descriptor.includes('O11y')) {
            console.log(`[Aura Event] Received: ${descriptor}`);
          }
        }
      }
    } catch (e) {
      // Ignore non-JSON responses
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

  // Allow single-page application components time to dispatch all semester Aura calls
  console.log('Awaiting portal component telemetry...');
  const maxWaitMs = 15000;
  const pollInterval = 500;
  let elapsed = 0;

  while (elapsed < maxWaitMs) {
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
      console.error('Resolution: Run "node login.js" to authenticate, then retry "node sync.js".\n');
      await browser.close();
      process.exit(1);
    }

    // Once we have captured valid records and waited at least 4 seconds for sibling calls to settle
    if (validCourseList && validCourseList.length > 0 && elapsed >= 4000) {
      break;
    }
  }

  if (!validCourseList || validCourseList.length === 0) {
    const finalUrl = page.url();
    console.error('\n[Error] Did not capture attendance course list from SLCM.');
    console.error(`Current Page URL: ${finalUrl}`);
    console.error('Please rerun: node login.js to refresh your authentication session.\n');
    await browser.close();
    process.exit(1);
  }

  // Format into standard Roll Book schema
  const courses = validCourseList.map((c) => {
    const present = Number(
      c.Total_number_of_classes_attended__c ??
      c.classesAttended ??
      c.present ??
      c.Attended_Classes__c ??
      c.AttendedClasses ??
      0
    );

    const total = Number(
      c.Total_Classes__c ??
      c.totalClasses ??
      c.TotalClasses ??
      c.total ??
      (present + (c.absent || 0))
    );

    const absent = Math.max(0, total - present);

    const name =
      c.CourseOffering?.LearningCourse?.Name ??
      c.CourseOffering?.Name ??
      c.Course_Title__c ??
      c.courseName ??
      c.Name ??
      c.name ??
      'Unknown Course';

    const code =
      c.Course_Code__c ??
      c.CourseOffering?.Course_Code__c ??
      c.courseCode ??
      c.code ??
      '';

    return {
      name,
      code,
      present,
      absent,
    };
  });

  const outputPath = path.resolve(__dirname, 'sync-output.json');
  const payload = {
    courses,
    syncedAt: new Date().toISOString(),
    capturedVia: capturedActionDescriptor,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

  console.log(`\n========================================`);
  console.log(`✓ Synchronized ${courses.length} courses successfully!`);
  console.log(`Saved output to: ${outputPath}`);
  console.log(`========================================\n`);

  await browser.close();
})();
