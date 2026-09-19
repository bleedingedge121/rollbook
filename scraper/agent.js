// agent.js — One-off SLCM sync runner that pushes attendance directly to your hosted Roll Book app.
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { runLogin } = require('./login');
const { runScrape } = require('./sync');

const ENV_PATH = path.resolve(__dirname, '.env');
const AUTH_PATH = path.resolve(__dirname, 'auth.json');

function loadLocalEnv(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        env[key] = val;
      }
    }
  }
  return env;
}

function saveLocalEnv(filePath, data) {
  const lines = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

async function promptConfig() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  console.log('\n========================================');
  console.log('⚙️  Roll Book Scraper Setup');
  console.log('Configure your connection to the hosted app once.');
  console.log('========================================\n');

  const appUrl = (
    await ask('1. Enter your Roll Book App URL (e.g. https://your-app.vercel.app or http://localhost:3000): ')
  ).trim();

  const syncToken = (
    await ask('2. Enter your Personal Sync Token (generate in Roll Book > Settings > SLCM Sync): ')
  ).trim();

  rl.close();

  if (!appUrl || !syncToken) {
    console.error('\n❌ Both App URL and Sync Token are required to continue.\n');
    process.exit(1);
  }

  return { APP_URL: appUrl, SYNC_TOKEN: syncToken };
}

async function main() {
  console.log('\n========================================');
  console.log('🚀 Roll Book SLCM Live Attendance Pusher');
  console.log('========================================\n');

  const fileEnv = loadLocalEnv(ENV_PATH);
  let appUrl = process.env.APP_URL || fileEnv.APP_URL;
  let syncToken = process.env.SYNC_TOKEN || fileEnv.SYNC_TOKEN;

  // If configuration is missing, prompt user interactively
  if (!appUrl || !syncToken) {
    const answers = await promptConfig();
    appUrl = answers.APP_URL;
    syncToken = answers.SYNC_TOKEN;
    saveLocalEnv(ENV_PATH, { APP_URL: appUrl, SYNC_TOKEN: syncToken });
    console.log(`✓ Saved configuration to scraper/.env`);
  }

  const cleanAppUrl = appUrl.replace(/\/+$/, '');

  // Step 1: Check authentication session
  if (!fs.existsSync(AUTH_PATH)) {
    console.log('[Auth] No saved SLCM session found. Launching login browser...');
    await runLogin(AUTH_PATH);
  }

  // Step 2: Scrape attendance figures
  console.log('[Scraper] Connecting to SLCM portal...');
  let payload;
  try {
    payload = await runScrape(AUTH_PATH);
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED' || err.message === 'DID_NOT_CAPTURE_COURSES') {
      console.log('[Scraper] SLCM session expired or invalid. Opening browser to re-authenticate...');
      await runLogin(AUTH_PATH);
      payload = await runScrape(AUTH_PATH);
    } else {
      throw err;
    }
  }

  console.log(`[Scraper] Successfully captured attendance for ${payload.courses.length} course(s).`);

  // Step 3: Push attendance payload to hosted Roll Book API
  const pushEndpoint = `${cleanAppUrl}/api/sync/push`;
  console.log(`[Sync] Pushing attendance to ${pushEndpoint}...`);

  const response = await fetch(pushEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${syncToken}`,
    },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('\n❌ Failed to push attendance to Roll Book:');
    console.error(`Status ${response.status}: ${resJson.error || response.statusText}`);
    if (response.status === 401) {
      console.error('\n💡 Tip: Your sync token may be expired or invalid.');
      console.error('Go to Settings > SLCM Sync in Roll Book to generate a new token, then update scraper/.env.\n');
    }
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('✓ Attendance successfully synchronized with Roll Book!');
  console.log(`Updated Courses: ${resJson.count || payload.courses.length}`);
  console.log(`Timestamp:       ${new Date(payload.syncedAt).toLocaleString()}`);
  console.log('========================================');
  console.log('Refresh your Roll Book web dashboard to see updated numbers!\n');
}

main().catch((err) => {
  console.error('\n❌ Sync failed:', err.message);
  process.exit(1);
});
