const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5092;
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      const filePath = path.join(BASE_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function findChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return possiblePaths.find((p) => p && fs.existsSync(p));
}

async function run() {
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    
    // Set up local storage with empty courses and admin login
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.evaluate(() => {
      localStorage.setItem('edupeak_courses_db', JSON.stringify([]));
      localStorage.setItem('edupeak_auth_session', JSON.stringify({
        user: { id: 'ep-admin-master', name: 'Administrator', role: 'admin', email: 'admin@edupeak.lk' },
        token: 'test'
      }));
    });

    // Reload page to test cold start with empty courses database
    await page.reload();
    await page.waitForTimeout(1000);

    const activeCoursesText = await page.locator('#adminStatActiveCourses').textContent();
    console.log(`[TEST RESULT] Active courses card stat text: "${activeCoursesText.trim()}"`);

    if (activeCoursesText.trim() === '0') {
      console.log('✅ TEST PASSED: Metric shows 0 Active Courses when all courses are deleted!');
    } else {
      console.error(`❌ TEST FAILED: Expected '0', received '${activeCoursesText.trim()}'`);
      process.exitCode = 1;
    }

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
