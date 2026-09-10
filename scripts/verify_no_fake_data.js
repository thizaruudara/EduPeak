const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const executablePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });

  console.log('--- TEST 1: Student with NO enrollments ---');
  await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Setup a clean student with ZERO enrolled courses
  await page.evaluate(() => {
    const freshStudent = {
      id: "EP-2025-001",
      name: "Kasun Jayasundara",
      name_si: "කසුන් ජයසුන්දර",
      email: "kasun@edupeak.lk",
      phone: "+94 77 123 4567",
      role: "student",
      nic: "200541935351",
      stream: "Physical Science",
      batchYear: "2026",
      avatarLetter: "K",
      enrolledCourses: []
    };

    localStorage.setItem("edupeak_active_session", JSON.stringify(freshStudent));
    localStorage.setItem("edupeak_pending_orders", JSON.stringify([]));
    localStorage.removeItem("edupeak_enrolled");
    localStorage.removeItem("edupeak_student_courses_EP-2025-001");

    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) {
      window.AUTH_SYSTEM.updateUIForAuthState();
    }
  });

  // Open LMS Video Classroom
  console.log('Opening LMS Course Picker...');
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.openLMSPortal('video-classroom');
  });
  await page.waitForTimeout(1500);

  const enrolledCount0 = await page.evaluate(() => {
    const cards = document.querySelectorAll('.lms-course-picker-card.is-enrolled');
    return cards.length;
  });
  console.log('✅ Enrolled cards when student has no orders (MUST BE 0):', enrolledCount0);

  const screenshotDir = path.join(__dirname, '..', 'artifacts');
  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'verified_no_fake_data_lms.png') });

  if (enrolledCount0 !== 0) {
    throw new Error('FAILED: Fake enrolled courses are still showing for a student with no enrollments!');
  }

  // Check student dashboard for 0 enrollments
  await page.goto('http://localhost:5050/student-dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const dashCount0 = await page.evaluate(() => {
    const items = document.querySelectorAll('#dashEnrolledCoursesList .enrolled-course-item');
    const emptyState = document.querySelector('#dashEnrolledCoursesList h4')?.textContent?.trim();
    return { itemsCount: items.length, emptyStateText: emptyState };
  });
  console.log('✅ Student Dashboard when student has no orders:', dashCount0);
  if (dashCount0.itemsCount !== 0) {
    throw new Error('FAILED: Student dashboard still shows fake enrolled courses!');
  }

  console.log('\n--- TEST 2: Student places and gets 1 Real Approved Course ---');
  await page.evaluate(() => {
    const approvedOrders = [
      {
        orderId: "ORD-2025-001",
        studentId: "EP-2025-001",
        studentName: "Kasun Jayasundara",
        studentPhone: "+94 77 123 4567",
        courseId: "crs-phy-2027-theory",
        courseTitle: "2027 A/L Physics - Complete Theory & Mechanics Masterclass",
        fee: "LKR 3,500 / Month",
        status: "Approved",
        approvedAt: new Date().toISOString()
      }
    ];
    localStorage.setItem("edupeak_pending_orders", JSON.stringify(approvedOrders));
  });

  // Go to LMS Course Picker again
  await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    window.openLMSPortal('video-classroom');
  });
  await page.waitForTimeout(1500);

  const enrolledAfterApprove = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#lmsCoursePickerGrid .lms-course-picker-card.is-enrolled'));
    const titles = cards.map(c => c.querySelector('.lms-course-title')?.textContent?.trim());
    return { count: cards.length, titles };
  });
  console.log('✅ LMS Course Picker after 1 approved order (MUST BE EXACTLY 1):', enrolledAfterApprove);

  if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'verified_real_approved_lms.png') });

  if (enrolledAfterApprove.count !== 1) {
    throw new Error(`FAILED: Expected exactly 1 approved course in Video Classroom, found ${enrolledAfterApprove.count}`);
  }

  // Check student dashboard after 1 approve
  await page.goto('http://localhost:5050/student-dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);

  const dashAfterApprove = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#dashEnrolledCoursesList .enrolled-course-item'));
    const titles = items.map(i => i.querySelector('h4')?.textContent?.trim());
    return { count: items.length, titles };
  });
  console.log('✅ Student Dashboard after 1 approved order (MUST BE EXACTLY 1):', dashAfterApprove);
  await page.screenshot({ path: path.join(screenshotDir, 'verified_real_approved_dashboard.png') });

  if (dashAfterApprove.count !== 1) {
    throw new Error(`FAILED: Expected exactly 1 course in dashboard, found ${dashAfterApprove.count}`);
  }

  await browser.close();
  console.log('🎉 ALL TESTS PASSED: Zero fake/mock data injected. Only real approved courses appear!');
})();
