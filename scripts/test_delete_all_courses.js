const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5094;
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

  const results = [];

  try {
    const page = await browser.newPage();

    // -------------------------------------------------------------
    // SETUP: Delete all courses
    // -------------------------------------------------------------
    console.log('\n--- SETUP: Simulate Deleting All Courses ---');
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForTimeout(500);

    // Fill in admin login gate
    await page.fill('#adminGateEmail', 'admin@edupeak.lk');
    await page.fill('#adminGatePassword', 'admin123');
    await page.click('#adminGateSubmitBtn');
    await page.waitForTimeout(1200);

    // Run custom code to clear the edupeak_courses_db as SUPABASE_HELPER does
    await page.evaluate(() => {
      window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", []);
      localStorage.setItem("edupeak_courses_db", "[]");
    });
    console.log('✅ All courses deleted from local storage and cookie');

    // -------------------------------------------------------------
    // TEST 1: Teacher Portal Courses
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Teacher Portal Courses (Expected: 0) ---');
    await page.goto(`http://127.0.0.1:${PORT}/teacher-portal.html`);
    await page.waitForTimeout(1000);

    const teacherCardsCount = await page.locator('#teacherCoursesGrid .teacher-card').count();
    const metricCourses = await page.locator('#metricTotalCourses').textContent();
    console.log(`Teacher Portal Courses rendered: ${teacherCardsCount}, metricTotalCourses: "${metricCourses.trim()}"`);

    if (teacherCardsCount === 0 && metricCourses.trim() === '0') {
      console.log('✅ TEST 1 PASSED: Teacher Portal successfully shows 0 courses!');
      results.push({ test: 'Teacher Portal Courses', status: 'PASS', count: teacherCardsCount });
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 0 courses, found ${teacherCardsCount}`);
      results.push({ test: 'Teacher Portal Courses', status: 'FAIL', count: teacherCardsCount });
    }

    // -------------------------------------------------------------
    // TEST 2: Student Dashboard (Expected: 0)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Student Dashboard (Expected: 0) ---');
    await page.goto(`http://127.0.0.1:${PORT}/student-dashboard.html`);
    await page.waitForTimeout(1000);

    // Switch to Courses tab
    await page.evaluate(() => window.switchStudentPortalTab('courses'));
    await page.waitForTimeout(800);

    const studentCatalogCount = await page.locator('#studentCoursesContainer .course-card').count();
    console.log(`Student Dashboard Catalog Courses count: ${studentCatalogCount}`);

    if (studentCatalogCount === 0) {
      console.log('✅ TEST 2 PASSED: Student Dashboard successfully shows 0 courses!');
      results.push({ test: 'Student Dashboard', status: 'PASS', catalog: studentCatalogCount });
    } else {
      console.error(`❌ TEST 2 FAILED: Expected catalog 0, got catalog=${studentCatalogCount}`);
      results.push({ test: 'Student Dashboard', status: 'FAIL', catalog: studentCatalogCount });
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n========================================');
  console.log('FINAL SUMMARY OF DELETION TESTS');
  console.log('========================================');
  console.table(results);

  const anyFailed = results.some(r => r.status === 'FAIL');
  if (anyFailed) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PORTALS SUCCESSFULLY REFLECT EMPTY COURSES!');
  }
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
