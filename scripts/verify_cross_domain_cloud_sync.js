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
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('\n======================================================');
    console.log('TEST 1: SIMULATE CLOUD DELETION (0 COURSES IN DB)');
    console.log('======================================================');

    // 1. Teacher Portal when DB has 0 courses
    await page.goto(`http://127.0.0.1:${PORT}/teacher-portal.html`);
    await page.evaluate(() => {
      if (window.SUPABASE_HELPER) {
        window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", []);
      }
      localStorage.setItem("edupeak_courses_db", "[]");
      if (window.TEACHER_CONTROLLER) {
        window.TEACHER_CONTROLLER.loadCustomData();
        window.TEACHER_CONTROLLER.renderMetrics();
        window.TEACHER_CONTROLLER.renderCourses();
      }
    });
    await page.waitForTimeout(500);

    const teacherCardsCount = await page.locator('#teacherCoursesGrid .teacher-card').count();
    const metricCourses = await page.locator('#metricTotalCourses').textContent();
    console.log(`Teacher Portal Courses rendered: ${teacherCardsCount}, metric: "${metricCourses.trim()}"`);

    if (teacherCardsCount === 0 && metricCourses.trim() === '0') {
      console.log('✅ Teacher Portal correctly shows 0 courses when database is empty.');
      results.push({ portal: 'Teacher Portal (Empty)', status: 'PASS', count: teacherCardsCount });
    } else {
      console.error(`❌ Teacher Portal failed: count=${teacherCardsCount}, metric=${metricCourses}`);
      results.push({ portal: 'Teacher Portal (Empty)', status: 'FAIL', count: teacherCardsCount });
    }

    // 2. Student Dashboard when DB has 0 courses
    console.log('\n--- 2. Testing Student Dashboard ---');
    await page.goto(`http://127.0.0.1:${PORT}/student-dashboard.html`);
    await page.evaluate(() => {
      window.switchStudentPortalTab('courses');
    });
    await page.waitForTimeout(500);

    const studentCoursesCount = await page.locator('#studentCoursesContainer .course-card').count();
    console.log(`Student Dashboard Catalog Courses: ${studentCoursesCount}`);

    if (studentCoursesCount === 0) {
      console.log('✅ Student Dashboard correctly shows 0 courses.');
      results.push({ portal: 'Student Dashboard (Empty)', status: 'PASS', count: studentCoursesCount });
    } else {
      console.error(`❌ Student Dashboard failed: count=${studentCoursesCount}`);
      results.push({ portal: 'Student Dashboard (Empty)', status: 'FAIL', count: studentCoursesCount });
    }

    // 3. Courses Catalog (courses.html) when DB has 0 courses
    console.log('\n--- 3. Testing Public Courses Catalog (courses.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
    await page.waitForTimeout(500);

    const catalogCardsCount = await page.locator('#categorizedCoursesContainer .course-card').count();
    const countAll = await page.locator('#count-all').textContent();
    console.log(`Public Catalog courses: ${catalogCardsCount}, count-all badge: "${countAll}"`);

    if (catalogCardsCount === 0 && countAll.trim() === '0') {
      console.log('✅ Public Courses Catalog correctly shows 0 courses and count badge 0.');
      results.push({ portal: 'Courses Catalog (Empty)', status: 'PASS', count: catalogCardsCount });
    } else {
      console.error(`❌ Courses Catalog failed: count=${catalogCardsCount}, badge=${countAll}`);
      results.push({ portal: 'Courses Catalog (Empty)', status: 'FAIL', count: catalogCardsCount });
    }

    // 4. Reactive Cloud Sync Test (Simulate adding and deleting course dynamically on courses.html)
    console.log('\n======================================================');
    console.log('TEST 2: SIMULATE CLOUD SYNC EVENT (DYNAMIC ADD & DELETE)');
    console.log('======================================================');
    await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
    await page.waitForTimeout(500);

    await page.evaluate(() => {
      const newCourse = [{
        id: "crs-test-dyn-01",
        title: "2027 A/L Physics Cloud Live Stream",
        title_si: "2027 උසස් පෙළ භෞතික විද්‍යාව සජීවී විකාශය",
        teacher: "Prof. Sanath Wickramasinghe",
        teacherName: "Prof. Sanath Wickramasinghe",
        stream: "Physical Science",
        fee: "LKR 4,000 / Month",
        category: "theory",
        level: "2027 A/L",
        examYear: "2027 A/L",
        liveTime: "Sundays 8:00 AM"
      }];
      window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", newCourse);
      window.dispatchEvent(new CustomEvent("edupeak:courses-synced", { detail: newCourse }));
    });
    await page.waitForTimeout(500);

    const updatedCatalogCount = await page.locator('#categorizedCoursesContainer .course-card').count();
    const updatedCountAll = await page.locator('#count-all').textContent();
    console.log(`Courses catalog updated via sync event: ${updatedCatalogCount} course(s), badge: "${updatedCountAll}"`);

    if (updatedCatalogCount === 1 && updatedCountAll.trim() === '1') {
      console.log('✅ Cloud sync event successfully rendered 1 course on courses.html!');
      results.push({ portal: 'Reactive Sync (Add 1 Course)', status: 'PASS', count: updatedCatalogCount });
    } else {
      console.error(`❌ Dynamic sync failed on courses.html: count=${updatedCatalogCount}`);
      results.push({ portal: 'Reactive Sync (Add 1 Course)', status: 'FAIL', count: updatedCatalogCount });
    }

    // Now delete it dynamically
    await page.evaluate(() => {
      window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", []);
      window.dispatchEvent(new CustomEvent("edupeak:courses-synced", { detail: [] }));
    });
    await page.waitForTimeout(500);

    const clearedCatalogCount = await page.locator('#categorizedCoursesContainer .course-card').count();
    const clearedCountAll = await page.locator('#count-all').textContent();
    console.log(`Courses catalog cleared via sync event: ${clearedCatalogCount} course(s), badge: "${clearedCountAll}"`);

    if (clearedCatalogCount === 0 && clearedCountAll.trim() === '0') {
      console.log('✅ Cloud sync event successfully cleared courses on courses.html!');
      results.push({ portal: 'Reactive Sync (Delete All)', status: 'PASS', count: clearedCatalogCount });
    } else {
      console.error(`❌ Dynamic clear failed on courses.html: count=${clearedCatalogCount}`);
      results.push({ portal: 'Reactive Sync (Delete All)', status: 'FAIL', count: clearedCatalogCount });
    }

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n========================================');
  console.log('FINAL SUMMARY OF ALL PORTAL TESTS');
  console.log('========================================');
  console.table(results);

  const anyFailed = results.some(r => r.status === 'FAIL');
  if (anyFailed) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL PORTALS AND CROSS-DOMAIN SYNC TESTS PASSED PERFECTLY!');
  }
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
