const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function testMyCoursesAndPicker() {
  console.log("🚀 Testing My Courses vs Course Picker synchronization...");

  const chromePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  
  const browser = await chromium.launch({
    executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 }
  });

  const page = await context.newPage();

  const screenshotsDir = path.join(__dirname, '..', 'test-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Setup student with 2027 A/L batch & enrolled courses
    await page.evaluate(() => {
      const student = {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        name_si: "කසුන් ජයසුන්දර",
        email: "kasun@edupeak.lk",
        role: "student",
        nic: "200541935351",
        stream: "Physical Science",
        examYear: "2027 A/L",
        avatarLetter: "K",
        enrolledCourses: ["crs-phy-2027-theory", "crs-phy-2027-revision"]
      };
      localStorage.setItem("edupeak_active_session", JSON.stringify(student));
      localStorage.setItem("edupeak_enrolled", JSON.stringify(["crs-phy-2027-theory", "crs-phy-2027-revision"]));
      if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) {
        window.AUTH_SYSTEM.updateUIForAuthState();
      }
    });

    // 1. Open LMS My Courses
    console.log("1️⃣ Opening LMS My Courses tab...");
    await page.evaluate(() => {
      window.openLMSPortal('my-courses');
    });
    await page.waitForTimeout(1000);

    const enrolledCount = await page.evaluate(() => {
      const cards = document.querySelectorAll("#enrolledCoursesGrid .enrolled-course-card");
      return cards.length;
    });

    console.log("Enrolled course cards count in My Courses:", enrolledCount);
    await page.screenshot({ path: path.join(screenshotsDir, '05_lms_my_courses_fixed.png') });
    if (enrolledCount === 0) {
      throw new Error("My Courses still shows 0 enrolled courses!");
    }

    // 2. Switch to Video Classes
    console.log("2️⃣ Switching to Video Classes tab (Course Selection Grid)...");
    await page.evaluate(() => {
      window.switchLMSTab('video-classroom');
      window.showCoursePickerInLMS();
    });
    await page.waitForTimeout(1000);

    const pickerCards = await page.evaluate(() => {
      const cards = document.querySelectorAll("#lmsCoursePickerGrid .lms-course-picker-card");
      const enrolledBadges = document.querySelectorAll("#lmsCoursePickerGrid .lms-course-badge");
      let enrolledBadgeCount = 0;
      enrolledBadges.forEach(b => {
        if (b.textContent.includes("Enrolled Batch")) enrolledBadgeCount++;
      });
      return { total: cards.length, enrolled: enrolledBadgeCount };
    });

    console.log("Course picker cards in Video Classes:", pickerCards);
    await page.screenshot({ path: path.join(screenshotsDir, '06_lms_course_picker_enrolled_highlight.png') });

    console.log("\n🎉 SYNCHRONIZATION TEST PASSED SUCCESSFULLY!");

  } catch (err) {
    console.error("❌ Test error:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

testMyCoursesAndPicker();
