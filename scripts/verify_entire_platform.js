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

async function runAudit() {
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true, // 100% background headless execution (No window opened)
  });

  const auditLog = [];

  function record(pageName, feature, status, details) {
    auditLog.push({ Page: pageName, Feature: feature, Status: status, Details: details });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${pageName}] ${feature}: ${details}`);
  }

  try {
    const page = await browser.newPage();

    // =========================================================================
    // 1. HOME PAGE (index.html)
    // =========================================================================
    console.log('\n--- Scanning 1. Home Page (index.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/index.html`);
    await page.waitForTimeout(800);

    const title = await page.title();
    record('Home Page', 'Page Title & Metadata', title.includes('EduPeak') ? 'PASS' : 'FAIL', title);

    const instCards = await page.locator('#institutesGrid .institute-card, #institutesGrid .inst-card, #institutesGrid > div').count();
    record('Home Page', 'Campus Institutes Section', instCards >= 1 ? 'PASS' : 'FAIL', `${instCards} campuses displayed`);

    // Authenticate student session for LMS test
    await page.evaluate(() => {
      const studentUser = {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        email: "student@edupeak.lk",
        role: "student",
        examYear: "2027 A/L",
        stream: "Physical Science",
        branch: "Victory Embilipitiya",
        enrolledCourses: ["crs-phy-2027-theory", "crs-phy-2027-revision"]
      };
      localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
      if (window.AUTH_SYSTEM) window.AUTH_SYSTEM.updateUIForAuthState();
    });

    // Test LMS Classroom Overlay
    const lmsLaunchSuccess = await page.evaluate(() => {
      if (typeof window.openLMSPortal === 'function') {
        window.openLMSPortal('video-classroom');
        const modal = document.getElementById('lmsModalWrapper');
        return modal && modal.classList.contains('active');
      }
      return false;
    });
    record('Home Page', 'LMS Video Player Launch', lmsLaunchSuccess ? 'PASS' : 'FAIL', 'Modal opens active for authenticated student');

    // =========================================================================
    // 2. PUBLIC COURSES DIRECTORY (courses.html)
    // =========================================================================
    console.log('\n--- Scanning 2. Public Courses Page (courses.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/courses.html`);
    await page.waitForTimeout(800);

    const catalogCards = await page.locator('#categorizedCoursesContainer .course-card').count();
    record('Courses Page', 'All Masterclasses Rendered', catalogCards >= 5 ? 'PASS' : 'FAIL', `${catalogCards} courses active`);

    const countAll = await page.locator('#count-all').textContent();
    record('Courses Page', 'Category Counter Pill', countAll.trim() === '5' ? 'PASS' : 'FAIL', `Total: ${countAll.trim()}`);

    // Test Details Modal
    await page.evaluate(() => window.showCourseDetailsModal('crs-phy-2027-theory'));
    await page.waitForTimeout(400);
    const modalActive = await page.locator('#courseDetailsModal').getAttribute('class');
    record('Courses Page', 'Course Details Modal', modalActive.includes('active') ? 'PASS' : 'FAIL', 'Modal triggered successfully');

    // =========================================================================
    // 3. CHECKOUT & ENROLLMENT FLOW (checkout.html)
    // =========================================================================
    console.log('\n--- Scanning 3. Checkout Page (checkout.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/checkout.html?course=crs-phy-2027-theory`);
    await page.waitForTimeout(800);

    const summaryTitle = await page.locator('#summaryCourseTitle, #alreadyEnrolledCourseName').first().textContent();
    record('Checkout Page', 'Course Parameter Auto-Fill', summaryTitle.includes('2027') || summaryTitle.includes('Physics') ? 'PASS' : 'FAIL', summaryTitle.trim());

    const studentNameVal = await page.inputValue('#studentNameInput');
    record('Checkout Page', 'Logged-In Student Pre-fill', studentNameVal.length > 0 ? 'PASS' : 'FAIL', `Name: ${studentNameVal}`);

    // =========================================================================
    // 4. STUDENT LMS DASHBOARD (student-dashboard.html)
    // =========================================================================
    console.log('\n--- Scanning 4. Student LMS Dashboard (student-dashboard.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/student-dashboard.html`);
    await page.waitForTimeout(800);

    const studentBatch = await page.locator('#dashStudentBatch').textContent();
    record('Student Dashboard', 'Student Profile Batch', studentBatch.includes('2027') ? 'PASS' : 'FAIL', studentBatch.trim());

    const enrolledListCount = await page.locator('#dashEnrolledCoursesList .enrolled-course-item').count();
    record('Student Dashboard', 'Active Enrolled Masterclasses', enrolledListCount >= 2 ? 'PASS' : 'FAIL', `${enrolledListCount} enrolled classes`);

    // Switch to Courses Catalog Tab
    await page.evaluate(() => window.switchStudentPortalTab('courses'));
    await page.waitForTimeout(600);
    const studentCatalogCount = await page.locator('#studentCoursesContainer .course-card').count();
    record('Student Dashboard', 'Explore Courses Catalog Tab', studentCatalogCount >= 5 ? 'PASS' : 'FAIL', `${studentCatalogCount} batches available`);

    // =========================================================================
    // 5. STUDENT PROFILE (profile.html)
    // =========================================================================
    console.log('\n--- Scanning 5. Student Profile Page (profile.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/profile.html`);
    await page.waitForTimeout(800);

    const profName = await page.inputValue('#profileFullName');
    const profNic = await page.inputValue('#profileNic');
    record('Profile Page', 'Profile Data Pre-Fill', (profName.includes('Kasun') && profNic.length > 0) ? 'PASS' : 'FAIL', `${profName} (NIC: ${profNic})`);

    // =========================================================================
    // 6. PAST PAPERS PDF VAULT (past-papers.html)
    // =========================================================================
    console.log('\n--- Scanning 6. Past Papers Vault (past-papers.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/past-papers.html`);
    await page.waitForTimeout(800);

    const papersCount = await page.locator('#papersGridContainer .paper-card').count();
    record('Paper Vault', 'Past Papers Catalog Rendered', papersCount >= 3 ? 'PASS' : 'FAIL', `${papersCount} PDF documents listed`);

    // =========================================================================
    // 7. TEACHER PORTAL & STUDIO (teacher-portal.html)
    // =========================================================================
    console.log('\n--- Scanning 7. Teacher Portal (teacher-portal.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/teacher-portal.html`);
    await page.waitForTimeout(800);

    const teacherCoursesCount = await page.locator('#teacherCoursesGrid .teacher-card').count();
    const metricCourses = await page.locator('#metricTotalCourses').textContent();
    record('Teacher Portal', 'Faculty Course Directory', teacherCoursesCount >= 5 ? 'PASS' : 'FAIL', `${teacherCoursesCount} courses (Metric: ${metricCourses.trim()})`);

    // Switch to Lessons Tab
    await page.evaluate(() => window.TEACHER_CONTROLLER.switchTab('lessons'));
    await page.waitForTimeout(400);
    const lessonsListCount = await page.locator('#teacherLessonsTbody tr').count();
    record('Teacher Portal', 'Lessons & Video Manager', lessonsListCount >= 1 ? 'PASS' : 'FAIL', `${lessonsListCount} lessons managed`);

    // Switch to Quizzes Tab
    await page.evaluate(() => window.TEACHER_CONTROLLER.switchTab('quizzes'));
    await page.waitForTimeout(400);
    const quizListCount = await page.locator('#teacherQuizList .quiz-question-builder-card, #teacherQuizList > div').count();
    record('Teacher Portal', 'Speed MCQ Quizzes Arena', quizListCount >= 1 ? 'PASS' : 'FAIL', `${quizListCount} quizzes active`);

    // Switch to Registered Students Tab
    await page.evaluate(() => window.TEACHER_CONTROLLER.switchTab('students'));
    await page.waitForTimeout(400);
    const teacherStudentsCount = await page.locator('#teacherStudentsTbody tr').count();
    record('Teacher Portal', 'Registered Students Directory', teacherStudentsCount >= 1 ? 'PASS' : 'FAIL', `${teacherStudentsCount} student rows`);

    // =========================================================================
    // 8. MASTER ADMIN CONSOLE (admin.html)
    // =========================================================================
    console.log('\n--- Scanning 8. Master Admin Console (admin.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForTimeout(500);

    await page.fill('#adminGateEmail', 'admin@edupeak.lk');
    await page.fill('#adminGatePassword', 'admin123');
    await page.click('#adminGateSubmitBtn');
    await page.waitForTimeout(1200);

    const adminStatCourses = await page.locator('#adminStatActiveCourses').textContent();
    record('Admin Portal', 'Overview Key Metrics', adminStatCourses.trim() === '5' ? 'PASS' : 'FAIL', `Active Courses: ${adminStatCourses.trim()}`);

    // Switch to Students Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('students'));
    await page.waitForTimeout(400);
    const adminStudentsRows = await page.locator('#adminStudentsTbody tr').count();
    record('Admin Portal', 'Student Management Roster', adminStudentsRows >= 1 ? 'PASS' : 'FAIL', `${adminStudentsRows} students listed`);

    // Switch to Courses Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('courses'));
    await page.waitForTimeout(400);
    const adminCourseRows = await page.locator('#adminCoursesTbody tr').count();
    record('Admin Portal', 'Curriculum & Courses Directory', adminCourseRows >= 5 ? 'PASS' : 'FAIL', `${adminCourseRows} active courses`);

    // Switch to Teachers Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('teachers'));
    await page.waitForTimeout(400);
    const adminTeachersRows = await page.locator('#adminTeachersTbody tr').count();
    record('Admin Portal', 'Faculty Members Directory', adminTeachersRows >= 1 ? 'PASS' : 'FAIL', `${adminTeachersRows} lecturers`);

    // Switch to Institutes Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('institutes'));
    await page.waitForTimeout(400);
    const adminInstRows = await page.locator('#adminInstitutesTbody tr').count();
    record('Admin Portal', 'Campus Branches & Institutes', adminInstRows >= 1 ? 'PASS' : 'FAIL', `${adminInstRows} campuses`);

    // Switch to Paper Vault Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('papers'));
    await page.waitForTimeout(400);
    const adminPaperRows = await page.locator('#adminPapersTableBody tr').count();
    record('Admin Portal', 'PDF Paper Vault Management', adminPaperRows >= 1 ? 'PASS' : 'FAIL', `${adminPaperRows} papers in admin`);

    // =========================================================================
    // 9. AUTHENTICATION & LOGIN (login.html)
    // =========================================================================
    console.log('\n--- Scanning 9. Login Portal (login.html) ---');
    await page.goto(`http://127.0.0.1:${PORT}/login.html`);
    await page.waitForTimeout(800);

    const loginTitle = await page.title();
    record('Login Page', 'Sign In Portal Loaded', loginTitle.includes('Sign In') || loginTitle.includes('Login') || loginTitle.includes('EduPeak') ? 'PASS' : 'FAIL', loginTitle);

  } finally {
    await browser.close();
    server.close();
  }

  console.log('\n================================================================================');
  console.log('COMPLETE END-TO-END PLATFORM AUDIT REPORT');
  console.log('================================================================================');
  console.table(auditLog);

  const failures = auditLog.filter(item => item.Status === 'FAIL');
  if (failures.length > 0) {
    console.error(`\n❌ Total Failures: ${failures.length}`);
    process.exit(1);
  } else {
    console.log(`\n🎉 PERFECT SCORE! ALL ${auditLog.length} CHECKS PASSED ACROSS THE ENTIRE PLATFORM!`);
  }
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
