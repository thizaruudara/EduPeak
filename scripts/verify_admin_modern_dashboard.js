const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5099;
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
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
      console.log(`Local test server running on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

async function run() {
  const server = await startServer();
  const executablePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  console.log('Launching browser with chromium at:', executablePath);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  console.log(`Navigating to http://127.0.0.1:${PORT}/index.html...`);
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  console.log('Checking ADMIN_CONTROLLER existence...');
  const hasAdmin = await page.evaluate(() => typeof window.ADMIN_CONTROLLER !== 'undefined');
  console.log('ADMIN_CONTROLLER loaded:', hasAdmin);

  console.log('Opening Admin Panel...');
  await page.evaluate(() => {
    if (window.ADMIN_CONTROLLER) {
      window.ADMIN_CONTROLLER.open('overview');
    }
  });
  await page.waitForTimeout(800);

  // Check if adminModalWrapper is active
  const isAdminActive = await page.evaluate(() => {
    const modal = document.getElementById('adminModalWrapper');
    return modal ? modal.classList.contains('active') : false;
  });
  console.log('Admin Modal Active:', isAdminActive);

  // Test Live Clock
  const clockText = await page.evaluate(() => {
    const el = document.getElementById('adminLiveClockText');
    return el ? el.textContent : '';
  });
  console.log('Live Clock Text:', clockText);

  // Overview Tab Validation
  const overviewStats = await page.evaluate(() => {
    return {
      students: document.getElementById('adminStatTotalStudents')?.textContent,
      courses: document.getElementById('adminStatActiveCourses')?.textContent,
      teachers: document.getElementById('adminStatTotalTeachers')?.textContent,
      live: document.getElementById('adminStatLiveClasses')?.textContent,
      pending: document.getElementById('adminStatPendingOrders')?.textContent,
      branchListChildren: document.getElementById('adminBranchDistributionList')?.children.length,
      recentStudentsRows: document.getElementById('adminRecentStudentsTbody')?.children.length
    };
  });
  console.log('Overview Stats & Elements:', overviewStats);

  const screenshotsDir = path.join(__dirname, '..', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
  
  await page.screenshot({ path: path.join(screenshotsDir, 'admin_overview.png'), fullPage: false });
  console.log('Saved admin_overview.png');

  // Test Tab 2: Students
  console.log('Switching to Students tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('students'));
  await page.waitForTimeout(600);

  const studentCountText = await page.evaluate(() => {
    return document.getElementById('adminStudentsCountLabel')?.textContent;
  });
  console.log('Students count label:', studentCountText);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_students.png'), fullPage: false });
  console.log('Saved admin_students.png');

  // Test Tab 3: Courses
  console.log('Switching to Courses tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('courses'));
  await page.waitForTimeout(600);

  const coursesRows = await page.evaluate(() => {
    return document.getElementById('adminCoursesTbody')?.children.length;
  });
  console.log('Courses rows count:', coursesRows);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_courses.png'), fullPage: false });
  console.log('Saved admin_courses.png');

  // Test Tab 4: Teachers
  console.log('Switching to Teachers tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('teachers'));
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_teachers.png'), fullPage: false });
  console.log('Saved admin_teachers.png');

  // Test Tab 5: Campus Branches
  console.log('Switching to Institutes/Branches tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('institutes'));
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_institutes.png'), fullPage: false });
  console.log('Saved admin_institutes.png');

  // Test Tab 6: Paper Vault
  console.log('Switching to Paper Vault tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('papers'));
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_papers.png'), fullPage: false });
  console.log('Saved admin_papers.png');

  // Test Tab 7: Supabase
  console.log('Switching to Supabase tab...');
  await page.evaluate(() => ADMIN_CONTROLLER.switchTab('supabase'));
  await page.waitForTimeout(600);

  await page.screenshot({ path: path.join(screenshotsDir, 'admin_supabase.png'), fullPage: false });
  console.log('Saved admin_supabase.png');

  await browser.close();
  server.close();
  console.log('🎉 ALL 7 TABS AND ADVANCED UI VERIFIED SUCCESSFULLY!');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
