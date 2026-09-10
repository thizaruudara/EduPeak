const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5093;
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
    headless: true, // 100% background headless execution - NO window opened
  });

  const results = [];

  try {
    const page = await browser.newPage();

    // -------------------------------------------------------------
    // TEST 1: Teacher Portal Courses
    // -------------------------------------------------------------
    console.log('\n--- 1. Testing Teacher Portal Courses ---');
    await page.goto(`http://127.0.0.1:${PORT}/teacher-portal.html`);
    await page.waitForTimeout(1000);

    const teacherCardsCount = await page.locator('#teacherCoursesGrid .teacher-card').count();
    const metricCourses = await page.locator('#metricTotalCourses').textContent();
    console.log(`Teacher Portal Courses rendered: ${teacherCardsCount}, metricTotalCourses: "${metricCourses.trim()}"`);

    if (teacherCardsCount >= 5 && metricCourses.trim() === '5') {
      console.log('✅ TEST 1 PASSED: Teacher Portal renders all 5 courses properly!');
      results.push({ test: 'Teacher Portal Courses', status: 'PASS', count: teacherCardsCount });
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 5 courses, found ${teacherCardsCount}`);
      results.push({ test: 'Teacher Portal Courses', status: 'FAIL', count: teacherCardsCount });
    }

    // -------------------------------------------------------------
    // TEST 2: Student Dashboard (Enrolled + Catalog Tab)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Student Dashboard ---');
    await page.goto(`http://127.0.0.1:${PORT}/student-dashboard.html`);
    await page.waitForTimeout(1000);

    const enrolledCardsCount = await page.locator('#dashEnrolledCoursesList .enrolled-course-item').count();
    console.log(`Student Dashboard Enrolled Courses count: ${enrolledCardsCount}`);

    // Switch to Courses tab
    await page.evaluate(() => window.switchStudentPortalTab('courses'));
    await page.waitForTimeout(800);

    const studentCatalogCount = await page.locator('#studentCoursesContainer .course-card').count();
    console.log(`Student Dashboard Catalog Courses count: ${studentCatalogCount}`);

    if (enrolledCardsCount >= 2 && studentCatalogCount >= 5) {
      console.log('✅ TEST 2 PASSED: Student Dashboard displays active enrollments and all 5 catalog courses!');
      results.push({ test: 'Student Dashboard', status: 'PASS', enrolled: enrolledCardsCount, catalog: studentCatalogCount });
    } else {
      console.error(`❌ TEST 2 FAILED: Expected enrolled >= 2 & catalog >= 5, got enrolled=${enrolledCardsCount}, catalog=${studentCatalogCount}`);
      results.push({ test: 'Student Dashboard', status: 'FAIL', enrolled: enrolledCardsCount, catalog: studentCatalogCount });
    }

    // -------------------------------------------------------------
    // TEST 3: Admin Console Courses
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Admin Portal ---');
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForTimeout(500);

    // Fill in admin login gate
    await page.fill('#adminGateEmail', 'admin@edupeak.lk');
    await page.fill('#adminGatePassword', 'admin123');
    await page.click('#adminGateSubmitBtn');
    await page.waitForTimeout(1200);

    const adminActiveStat = await page.locator('#adminStatActiveCourses').textContent();
    console.log(`Admin Overview Active Courses Stat: "${adminActiveStat.trim()}"`);

    // Switch to Admin Courses tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('courses'));
    await page.waitForTimeout(800);

    const adminTableRows = await page.locator('#adminCoursesTbody tr').count();
    console.log(`Admin Courses Directory Table Rows: ${adminTableRows}`);

    if (adminActiveStat.trim() === '5' && adminTableRows >= 5) {
      console.log('✅ TEST 3 PASSED: Admin Console displays 5 active courses in stats and table!');
      results.push({ test: 'Admin Portal', status: 'PASS', stat: adminActiveStat.trim(), rows: adminTableRows });
    } else {
      console.error(`❌ TEST 3 FAILED: Expected stat=5 & rows>=5, got stat=${adminActiveStat.trim()}, rows=${adminTableRows}`);
      results.push({ test: 'Admin Portal', status: 'FAIL', stat: adminActiveStat.trim(), rows: adminTableRows });
    }

    // -------------------------------------------------------------
    // TEST 4: Public Courses Page (courses.html)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Public Courses Page (courses.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
    await page.waitForTimeout(1000);

    const publicCoursesCount = await page.locator('#categorizedCoursesContainer .course-card').count();
    console.log(`Public courses.html card count: ${publicCoursesCount}`);

    if (publicCoursesCount >= 5) {
      console.log('✅ TEST 4 PASSED: courses.html displays all 5 masterclasses!');
      results.push({ test: 'Public Courses Page', status: 'PASS', count: publicCoursesCount });
    } else {
      console.error(`❌ TEST 4 FAILED: Expected >= 5 courses, got ${publicCoursesCount}`);
      results.push({ test: 'Public Courses Page', status: 'FAIL', count: publicCoursesCount });
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n========================================');
  console.log('FINAL SUMMARY OF SYNCHRONIZATION TESTS');
  console.log('========================================');
  console.table(results);

  const anyFailed = results.some(r => r.status === 'FAIL');
  if (anyFailed) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL 4 PORTALS (Teacher, Student, Admin, Courses) SYNCHRONIZED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
