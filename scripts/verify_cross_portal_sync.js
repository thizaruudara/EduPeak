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
    
    // 1. Test past-papers with empty array
    await page.goto(`http://127.0.0.1:${PORT}/past-papers.html`);
    await page.evaluate(() => {
      localStorage.setItem('edupeak_papers_db', '[]');
      document.cookie = 'edupeak_papers_db=' + encodeURIComponent('[]') + '; path=/; SameSite=Lax';
    });
    await page.reload();
    await page.waitForTimeout(600);

    const paperCards = await page.locator('.paper-card').count();
    console.log(`[TEST 1] Past papers count when deleted: ${paperCards}`);

    // 2. Test courses.html with empty array
    await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
    await page.evaluate(() => {
      localStorage.setItem('edupeak_courses_db', '[]');
      document.cookie = 'edupeak_courses_db=' + encodeURIComponent('[]') + '; path=/; SameSite=Lax';
    });
    await page.reload();
    await page.waitForTimeout(600);

    const courseCards = await page.locator('.course-card').count();
    console.log(`[TEST 2] Courses count when deleted: ${courseCards}`);

    if (paperCards === 0 && courseCards === 0) {
      console.log('✅ ALL PORTAL SYNC TESTS PASSED: When deleted in Admin, student portal renders 0 items!');
    } else {
      console.error('❌ FAILED: Unexpected item counts.');
      process.exitCode = 1;
    }

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
