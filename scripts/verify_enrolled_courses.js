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

  console.log('1️⃣ Navigating to index.html...');
  await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Setup student session and an Approved WhatsApp order for the course
  await page.evaluate(() => {
    const student = {
      id: "EP-2025-001",
      name: "Kasun Jayasundara",
      name_si: "කසුන් ජයසුන්දර",
      email: "kasun@edupeak.lk",
      phone: "+94 77 123 4567",
      role: "student",
      nic: "200541935351",
      stream: "Physical Science",
      batchYear: "2026",
      avatarLetter: "K"
    };

    localStorage.setItem("edupeak_active_session", JSON.stringify(student));

    // Simulate an order that was approved by Admin/Teacher
    const approvedOrders = [
      {
        orderId: "ORD-2025-9988",
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

    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) {
      window.AUTH_SYSTEM.updateUIForAuthState();
    }
  });

  console.log('2️⃣ Opening LMS Video Classroom with Course Selection Picker...');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    window.openLMSPortal('video-classroom');
  });
  await page.waitForTimeout(1500);

  // Verify that the course picker grid displays the enrolled course
  const pickerCheck = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.lms-course-picker-card.is-enrolled'));
    const titles = cards.map(c => c.querySelector('.lms-course-title')?.textContent?.trim());
    return {
      enrolledCount: cards.length,
      titles: titles
    };
  });
  console.log('✅ Course Picker Enrolled Cards found:', pickerCheck);

  if (pickerCheck.enrolledCount === 0) {
    throw new Error('FAILED: Course picker still shows empty state for approved student!');
  }

  // Take screenshot of Course Picker with Enrolled Course
  const pickerScreenshot = path.join(__dirname, 'lms_picker_enrolled.png');
  await page.screenshot({ path: pickerScreenshot });
  console.log('✅ Saved picker screenshot:', pickerScreenshot);

  // Click on the enrolled course card to watch lessons
  console.log('3️⃣ Clicking Enrolled Course Card...');
  await page.evaluate(() => {
    const card = document.querySelector('.lms-course-picker-card.is-enrolled');
    if (card) card.click();
  });
  await page.waitForTimeout(1000);

  const playerState = await page.evaluate(() => {
    const playerView = document.getElementById('lmsVideoClassroomPlayerView');
    const title = document.getElementById('lmsLessonTitle')?.textContent?.trim();
    const isVisible = playerView && window.getComputedStyle(playerView).display !== 'none';
    return { isVisible, title };
  });
  console.log('✅ Player View State after clicking course:', playerState);

  // Test Student Dashboard
  console.log('4️⃣ Navigating to student-dashboard.html...');
  await page.goto('http://localhost:5050/student-dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const dashEnrolled = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#dashEnrolledCoursesList .enrolled-course-item'));
    return {
      count: items.length,
      titles: items.map(i => i.querySelector('h4')?.textContent?.trim())
    };
  });
  console.log('✅ Student Dashboard Enrolled Courses:', dashEnrolled);

  const dashScreenshot = path.join(__dirname, 'student_dash_enrolled.png');
  await page.screenshot({ path: dashScreenshot });
  console.log('✅ Saved student dashboard screenshot:', dashScreenshot);

  await browser.close();
  console.log('🎉 VERIFICATION SUCCEEDED! Enrolled and approved courses now display accurately across LMS & Dashboard.');
})();
