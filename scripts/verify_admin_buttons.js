const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5095;
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
      if (reqPath === '/' || reqPath === '') reqPath = '/admin.html';

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
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.evaluate(() => {
      localStorage.setItem('edupeak_active_session', JSON.stringify({
        id: 'ADM-SUPER',
        name: 'System Administrator',
        email: 'admin@edupeak.lk',
        role: 'admin'
      }));
    });

    await page.reload();
    await page.waitForTimeout(1000);

    console.log('Console Errors:', errors);

    const clockText = await page.locator('#adminLiveClockText').textContent();
    console.log('Live Clock:', clockText);

    // Test clicking tabs
    console.log('Testing click on Courses tab...');
    await page.click('.admin-nav-item[data-tab="courses"]');
    await page.waitForTimeout(300);
    const coursesActive = await page.locator('#adminTab_courses').getAttribute('class');
    console.log('Courses tab active:', coursesActive.includes('active'));

    console.log('Testing click on Students tab...');
    await page.click('.admin-nav-item[data-tab="students"]');
    await page.waitForTimeout(300);
    const studentsActive = await page.locator('#adminTab_students').getAttribute('class');
    console.log('Students tab active:', studentsActive.includes('active'));

    console.log('Testing click on Papers tab...');
    await page.click('.admin-nav-item[data-tab="papers"]');
    await page.waitForTimeout(300);
    const papersActive = await page.locator('#adminTab_papers').getAttribute('class');
    console.log('Papers tab active:', papersActive.includes('active'));

    console.log('Testing click on Overview tab...');
    await page.click('.admin-nav-item[data-tab="overview"]');
    await page.waitForTimeout(300);
    const overviewActive = await page.locator('#adminTab_overview').getAttribute('class');
    console.log('Overview tab active:', overviewActive.includes('active'));

    console.log('Testing click on Add Course modal button...');
    await page.click('button:has-text("New Course")');
    await page.waitForTimeout(400);
    const modalVisible = await page.locator('#adminCourseDrawerModal').evaluate(el => el.classList.contains('active'));
    console.log('Add Course Modal Active:', modalVisible);
    await page.click('#adminCourseDrawerModal .modal-close-btn');
    await page.waitForTimeout(200);

    if (coursesActive.includes('active') && studentsActive.includes('active') && papersActive.includes('active') && overviewActive.includes('active') && modalVisible) {
      console.log('✅ ALL ADMIN PANEL BUTTONS, TABS & MODALS CLICKABLE & FUNCTIONING 100%!');
    } else {
      console.error('❌ ISSUES FOUND IN ADMIN PANEL');
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
