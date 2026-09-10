const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5098;
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
    server.listen(PORT, '127.0.0.1', () => resolve(server));
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

async function debug() {
  const server = await startServer();
  const browser = await chromium.launch({
    executablePath: findChromePath(),
    headless: true
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
  await page.waitForTimeout(500);

  const step1 = await page.evaluate(() => {
    return {
      edupeakDataCourses: window.EDUPEAK_DATA ? window.EDUPEAK_DATA.courses : 'none',
      supabaseGetCourses: window.SUPABASE_HELPER ? 'exists' : 'none',
      getSharedDataCourses: window.SUPABASE_HELPER ? window.SUPABASE_HELPER.getSharedData("edupeak_courses_db") : 'none',
      localStorage: localStorage.getItem("edupeak_courses_db")
    };
  });

  console.log('STEP 1 EVAL:', JSON.stringify(step1, null, 2));

  await browser.close();
  server.close();
}

debug();
