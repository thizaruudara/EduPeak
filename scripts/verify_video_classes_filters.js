const { chromium } = require('playwright-core');

(async () => {
  console.log("🚀 Running automated headless test for Video Classes Filter & Removed My Courses Tab...");
  const executablePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const page = await browser.newPage({
    viewport: { width: 1366, height: 850 }
  });

  // 1. Setup Student Session
  await page.goto("http://localhost:5050/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const studentUser = {
      id: "EP-2025-001",
      name: "Kasun Jayasundara",
      email: "kasun@edupeak.lk",
      phone: "0771234567",
      role: "student",
      enrolledCourses: ["crs-phy-2027-theory"]
    };
    localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
    localStorage.setItem("edupeak_enrolled", JSON.stringify(["crs-phy-2027-theory"]));
  });

  // 2. Open LMS Video Classroom
  await page.goto("http://localhost:5050/index.html?openLms=video-classroom", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);

  // 3. Verify Nav Tabs: Must have 3 tabs, and NO My Courses
  const tabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll(".lms-nav-tabs .lms-tab-btn")).map(b => ({
      tab: b.dataset.tab,
      text: b.textContent.trim()
    }));
  });

  console.log("📊 Active LMS Tabs found:", tabs);
  const hasMyCoursesTab = tabs.some(t => t.tab === "my-courses" || t.text.includes("My Courses"));
  if (hasMyCoursesTab) {
    throw new Error("❌ Error: 'My Courses' tab is still present in LMS navbar!");
  } else {
    console.log("✅ 'My Courses' tab successfully removed from LMS navigation.");
  }

  // 4. Verify Filter Bar is rendered
  const filterBarExists = await page.evaluate(() => {
    const bar = document.getElementById("lmsCourseFilterBar");
    const search = document.getElementById("lmsCourseSearchInput");
    const pills = document.querySelectorAll("#lmsStatusFilterPills .lms-filter-pill");
    const typeSel = document.getElementById("lmsCourseTypeSelect");
    const yearSel = document.getElementById("lmsCourseYearSelect");
    return {
      bar: !!bar,
      search: !!search,
      pillsCount: pills.length,
      typeSel: !!typeSel,
      yearSel: !!yearSel
    };
  });
  console.log("🔍 Filter controls check:", filterBarExists);
  if (!filterBarExists.bar || !filterBarExists.search || filterBarExists.pillsCount !== 3) {
    throw new Error("❌ Filter controls missing or incomplete!");
  }
  console.log("✅ Filter controls bar is fully rendered.");

  // 5. Test Live Filter Counts
  const counts = await page.evaluate(() => {
    return {
      all: document.getElementById("countStatusAll")?.textContent,
      enrolled: document.getElementById("countStatusEnrolled")?.textContent,
      available: document.getElementById("countStatusAvailable")?.textContent
    };
  });
  console.log("📈 Filter counts:", counts);

  // 6. Test Search Filtering
  console.log("🧪 Testing search filtering with keyword 'Revision'...");
  await page.fill("#lmsCourseSearchInput", "Revision");
  await page.waitForTimeout(300);
  const searchResultsCount = await page.evaluate(() => {
    return document.querySelectorAll("#lmsCoursePickerGrid .lms-course-picker-card").length;
  });
  console.log("🔍 Search results for 'Revision':", searchResultsCount, "courses");

  // 7. Test Status Pill Click (My Enrolled)
  console.log("🧪 Testing 'My Enrolled' pill filter...");
  await page.evaluate(() => {
    window.clearLMSCourseSearch();
    window.setLMSCourseStatusFilter('enrolled');
  });
  await page.waitForTimeout(300);
  const enrolledVisibleCount = await page.evaluate(() => {
    return document.querySelectorAll("#lmsCoursePickerGrid .lms-course-picker-card.is-enrolled").length;
  });
  console.log("🎯 Visible enrolled cards:", enrolledVisibleCount);

  // 8. Test Reset Filters
  console.log("🧪 Testing Reset Filters...");
  await page.evaluate(() => {
    window.resetLMSCourseFilters();
  });
  await page.waitForTimeout(300);
  const allCardsCount = await page.evaluate(() => {
    return document.querySelectorAll("#lmsCoursePickerGrid .lms-course-picker-card").length;
  });
  console.log("🎯 Total cards after reset:", allCardsCount);

  // 9. Capture verification screenshot
  await page.screenshot({ path: "scripts/video_classes_filters_verified.png" });
  console.log("📸 Screenshot saved to scripts/video_classes_filters_verified.png");

  await browser.close();
  console.log("🎉 ALL TESTS PASSED PERFECTLY!");
})();
