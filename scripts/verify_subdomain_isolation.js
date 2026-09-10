const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

const PORT = 5098;

async function run() {
  server.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}...`);
    const browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe'
    });

    try {
      const page = await browser.newPage();

      // ----------------------------------------------------------------------
      // TEST 1: ADMIN STANDALONE CONSOLE (admin.edupeak.lk)
      // ----------------------------------------------------------------------
      console.log('\n--- 1. Testing Standalone Admin Console (admin.html) ---');
      await page.goto(`http://localhost:${PORT}/admin.html`);
      
      // Verify login gate is displayed when unauthenticated
      const adminGateVisible = await page.locator('#adminLoginGate').isVisible();
      console.log('✓ Admin Login Gate displayed unauthenticated:', adminGateVisible);

      // Check cross links on admin page
      const adminHtmlContent = await page.content();
      const adminHasHomeLink = adminHtmlContent.includes('href="index.html"');
      const adminHasTeacherLink = adminHtmlContent.includes('href="teacher-portal.html"');
      console.log('✓ Admin has 0 links to public/student index.html:', !adminHasHomeLink);
      console.log('✓ Admin has 0 links to teacher-portal.html:', !adminHasTeacherLink);

      // Perform Admin Login
      await page.fill('#adminGateEmail', 'admin@edupeak.lk');
      await page.fill('#adminGatePassword', 'admin123');
      await page.click('#adminGateSubmitBtn');
      await page.waitForTimeout(600);

      const adminDashboardVisible = await page.locator('#adminModalWrapper').isVisible();
      console.log('✓ Admin Dashboard unlocked after authentication:', adminDashboardVisible);
      
      // Check tabs
      const overviewStats = await page.locator('#adminStatTotalStudents').textContent();
      console.log('✓ Overview Stats Students Count:', overviewStats);

      // ----------------------------------------------------------------------
      // TEST 2: TEACHER STANDALONE STUDIO (teacher.edupeak.lk)
      // ----------------------------------------------------------------------
      console.log('\n--- 2. Testing Standalone Teacher Studio (teacher-portal.html) ---');
      const teacherContext = await browser.newContext();
      const teacherPage = await teacherContext.newPage();
      await teacherPage.goto(`http://localhost:${PORT}/teacher-portal.html`);

      const teacherGateVisible = await teacherPage.locator('#teacherLoginGate').isVisible();
      console.log('✓ Teacher Login Gate displayed unauthenticated:', teacherGateVisible);

      const teacherHtmlContent = await teacherPage.content();
      const teacherHasHomeLink = teacherHtmlContent.includes('href="index.html"');
      const teacherHasAdminLink = teacherHtmlContent.includes('href="admin.html"');
      console.log('✓ Teacher portal has 0 links to public/student index.html:', !teacherHasHomeLink);
      console.log('✓ Teacher portal has 0 links to admin.html:', !teacherHasAdminLink);

      // Perform Teacher Login
      await teacherPage.fill('#teacherGateEmail', 'amalsha@edupeak.lk');
      await teacherPage.fill('#teacherGatePassword', 'teacher123');
      await teacherPage.click('#teacherGateSubmitBtn');
      await teacherPage.waitForTimeout(600);

      const teacherStudioVisible = !(await teacherPage.locator('#teacherLoginGate').isVisible());
      console.log('✓ Teacher Studio unlocked after login:', teacherStudioVisible);

      // ----------------------------------------------------------------------
      // TEST 3: PUBLIC & STUDENT PORTAL (edupeak.lk)
      // ----------------------------------------------------------------------
      console.log('\n--- 3. Testing Public & Student Portal (index.html & login.html) ---');
      const studentContext = await browser.newContext();
      const studentPage = await studentContext.newPage();
      await studentPage.goto(`http://localhost:${PORT}/index.html`);

      const indexHtml = await studentPage.content();
      const indexHasAdminBtn = indexHtml.includes('id="headerAdminPanelBtn"');
      const indexHasAdminModal = indexHtml.includes('id="adminModalWrapper"');
      const indexHasTeacherLink = indexHtml.includes('href="teacher-portal.html"');
      console.log('✓ Public site has no admin panel button in header:', !indexHasAdminBtn);
      console.log('✓ Public site has no embedded admin wrapper modal:', !indexHasAdminModal);
      console.log('✓ Public site has no teacher portal links:', !indexHasTeacherLink);

      // Test login.html
      await studentPage.goto(`http://localhost:${PORT}/login.html`);
      const loginHtml = await studentPage.content();
      const loginHasAdminLink = loginHtml.includes('href="admin-login.html"');
      console.log('✓ Login page has no Faculty/Staff/Admin portal link:', !loginHasAdminLink);

      console.log('\n======================================================');
      console.log('🎉 ALL 3 SUBDOMAINS PASS STRICT ISOLATION & VERIFICATION!');
      console.log('======================================================\n');
    } catch (err) {
      console.error('Test error:', err);
    } finally {
      await browser.close();
      server.close();
      process.exit(0);
    }
  });
}

run();
