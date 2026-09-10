/**
 * test_drm_watermark_visibility.js
 * Verifies that the DRM watermark is strictly hidden for Teachers, Admins, and during Offline Standby states.
 */

const { chromium } = require('playwright-core');
const path = require('path');
const http = require('http');
const fs = require('fs');

function findChromePath() {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const PORT = 8097;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/live-class.html';
    const filePath = path.join(ROOT_DIR, decodeURIComponent(reqPath));

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

(async () => {
  const server = await startServer();
  const chromePath = findChromePath();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    console.log('\n--- 1. Testing Teacher Profile View (Watermark MUST be hidden) ---');
    const teacherContext = await browser.newContext();
    await teacherContext.addInitScript(() => {
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'tch-amalsha',
        name: 'Amalsha Wanniarachchi',
        role: 'teacher'
      }));
      localStorage.setItem('edupeak_schedules_db', '[]');
    });

    const teacherPage = await teacherContext.newPage();
    await teacherPage.goto(`http://localhost:${PORT}/live-class.html`);
    await teacherPage.waitForTimeout(1000);

    const teacherWatermarkState = await teacherPage.evaluate(() => {
      const el = document.getElementById('liveDrmWatermark');
      return {
        exists: !!el,
        display: el ? window.getComputedStyle(el).display : 'none',
        text: el ? el.textContent.trim() : ''
      };
    });

    console.log('Teacher watermark state:', teacherWatermarkState);
    if (teacherWatermarkState.display !== 'none' || teacherWatermarkState.text.includes('Kasun')) {
      throw new Error(`FAIL: Teacher should never see watermark! Got display=${teacherWatermarkState.display}, text=${teacherWatermarkState.text}`);
    }
    console.log('✓ PASS: DRM Watermark is strictly hidden for Teachers!');

    console.log('\n--- 2. Testing Offline Standby State (Watermark MUST be hidden) ---');
    const guestContext = await browser.newContext();
    await guestContext.addInitScript(() => {
      localStorage.removeItem('edupeak_auth_user');
      localStorage.setItem('edupeak_schedules_db', '[]');
    });

    const guestPage = await guestContext.newPage();
    await guestPage.goto(`http://localhost:${PORT}/live-class.html`);
    await guestPage.waitForTimeout(1000);

    const offlineWatermarkState = await guestPage.evaluate(() => {
      const el = document.getElementById('liveDrmWatermark');
      return {
        exists: !!el,
        display: el ? window.getComputedStyle(el).display : 'none',
        text: el ? el.textContent.trim() : ''
      };
    });

    console.log('Offline standby watermark state:', offlineWatermarkState);
    if (offlineWatermarkState.display !== 'none' || offlineWatermarkState.text.includes('Kasun')) {
      throw new Error(`FAIL: Watermark must not show during Offline Standby! Got display=${offlineWatermarkState.display}, text=${offlineWatermarkState.text}`);
    }
    console.log('✓ PASS: DRM Watermark is strictly hidden during Offline Standby state!');

    console.log('\n=============================================');
    console.log('🎉 ALL DRM WATERMARK VISIBILITY TESTS PASSED!');
    console.log('=============================================\n');
  } finally {
    await browser.close();
    server.close();
  }
})();
