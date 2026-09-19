// agent.js — Local scraper bridge server on http://localhost:4747
const http = require('http');
const fs = require('fs');
const path = require('path');
const { runLogin } = require('./login');
const { runScrape } = require('./sync');

const PORT = 4747;
const AUTH_PATH = path.resolve(__dirname, 'auth.json');

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost:4747'}`);

  // Endpoint: GET /status
  if (req.method === 'GET' && url.pathname === '/status') {
    const hasSession = fs.existsSync(AUTH_PATH) && fs.statSync(AUTH_PATH).size > 10;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        hasSession,
        port: PORT,
      })
    );
    return;
  }

  // Endpoint: POST /login
  if (req.method === 'POST' && url.pathname === '/login') {
    try {
      console.log('[Agent] Triggering interactive login...');
      const result = await runLogin(AUTH_PATH);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Login complete', result }));
    } catch (err) {
      console.error('[Agent] Login failed:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Endpoint: POST /sync
  if (req.method === 'POST' && url.pathname === '/sync') {
    try {
      console.log('[Agent] 1-Click Sync requested.');

      // If no session exists, run interactive login first
      if (!fs.existsSync(AUTH_PATH)) {
        console.log('[Agent] auth.json missing. Opening login browser...');
        await runLogin(AUTH_PATH);
      }

      let payload;
      try {
        payload = await runScrape(AUTH_PATH);
      } catch (scrapeErr) {
        if (scrapeErr.message === 'SESSION_EXPIRED' || scrapeErr.message === 'DID_NOT_CAPTURE_COURSES') {
          console.log('[Agent] Session expired or stale. Re-launching login...');
          await runLogin(AUTH_PATH);
          payload = await runScrape(AUTH_PATH);
        } else {
          throw scrapeErr;
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    } catch (err) {
      console.error('[Agent] Sync error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: err.message || 'Scrape failed. Please check portal credentials or rerun login.',
        })
      );
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`🚀 SLCM Scraper Agent listening on http://localhost:${PORT}`);
  console.log(`Ready for 1-Click Sync requests from Roll Book.`);
  console.log(`========================================\n`);
});
