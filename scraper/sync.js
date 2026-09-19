// sync.js — robust SLCM attendance synchronizer.
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

async function runScrape(authPath = path.resolve(__dirname, 'auth.json')) {
  if (!fs.existsSync(authPath)) {
    throw new Error('auth.json not found. Please log in first.');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
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

    console.log('[Scraper] Connecting to MAHE SLCM portal...');

    page.on('response', async (response) => {
      const url = response.url();
      if (!url.includes('/s/sfsites/aura') || response.request().method() !== 'POST') {
        return;
      }

      try {
        const postData = response.request().postData() || '';
        const decodedPost = decodeURIComponent(postData);

        const isTargetRequest =
          decodedPost.includes('getCOPList') ||
          decodedPost.includes('commonLWCApexMethods') ||
          postData.includes('getCOPList');

        const json = await response.json();
        if (!json || !json.actions || !Array.isArray(json.actions)) return;

        for (const action of json.actions) {
          if (action.state !== 'SUCCESS' || !action.returnValue) continue;

          const descriptor = action.descriptor || '';
          if (
            descriptor.includes('instrumentation') ||
            descriptor.includes('telemetry') ||
            descriptor.includes('logMetrics')
          ) {
            continue;
          }

          const candidateList = extractAttendanceList(action.returnValue);

          if (isTargetRequest || hasValidCourseRecords(candidateList)) {
            if (candidateList.length > 0 && candidateList.length > (validCourseList?.length || 0)) {
              validCourseList = candidateList;
              rawCapturedData = action.returnValue;
              capturedActionDescriptor = descriptor || 'getCOPList';
              console.log(
                `✓ Intercepted Apex attendance call [${capturedActionDescriptor}] with ${candidateList.length} items.`
              );
            }
          }
        }
      } catch (e) {
        // Ignore non-JSON
      }
    });

    try {
      await page.goto('https://maheslcmtech.manipal.edu/s/attendance', {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (err) {
      console.warn('[Scraper] Navigation notice:', err.message);
    }

    const maxWaitMs = 15000;
    const pollInterval = 500;
    let elapsed = 0;

    while (elapsed < maxWaitMs) {
      await page.waitForTimeout(pollInterval);
      elapsed += pollInterval;

      const currentUrl = page.url();
      if (
        currentUrl.includes('login.microsoftonline.com') ||
        currentUrl.includes('/login') ||
        currentUrl.includes('/s/login')
      ) {
        throw new Error('SESSION_EXPIRED');
      }

      if (validCourseList && validCourseList.length > 0 && elapsed >= 4000) {
        break;
      }
    }

    if (!validCourseList || validCourseList.length === 0) {
      throw new Error('DID_NOT_CAPTURE_COURSES');
    }

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

    const payload = {
      courses,
      syncedAt: new Date().toISOString(),
      capturedVia: capturedActionDescriptor,
    };

    const outputPath = path.resolve(__dirname, 'sync-output.json');
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));
    console.log(`[Scraper] Saved payload to: ${outputPath}`);

    return payload;
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  runScrape()
    .then((res) => {
      console.log(`\n========================================`);
      console.log(`✓ Synchronized ${res.courses.length} courses successfully!`);
      console.log(`========================================\n`);
    })
    .catch((err) => {
      console.error('Scrape error:', err.message);
      process.exit(1);
    });
}

module.exports = { runScrape, extractAttendanceList, hasValidCourseRecords };
