const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log("🚀 Starting Comprehensive Video Player, Quality, Watermark, Course Picker & Live Player Verification...");

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
    // 1. Load Homepage
    console.log("1️⃣ Navigating to http://localhost:5050/index.html...");
    await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Ensure student is logged in with NIC
    await page.evaluate(() => {
      const testStudent = {
        id: "EP-2025-001",
        name: "Kasun Jayasundara",
        name_si: "කසුන් ජයසුන්දර",
        email: "kasun@edupeak.lk",
        role: "student",
        nic: "200541935351",
        stream: "Physical Science",
        batchYear: "2026",
        avatarLetter: "K"
      };
      localStorage.setItem("edupeak_active_session", JSON.stringify(testStudent));
      if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) {
        window.AUTH_SYSTEM.updateUIForAuthState();
      }
    });

    // 2. Open LMS Video Classroom
    console.log("2️⃣ Opening LMS Video Classroom...");
    await page.evaluate(() => {
      window.openLMSPortal('video-classroom');
    });
    await page.waitForTimeout(1000);

    // Check that Course Picker view is visible first
    const coursePickerVisible = await page.evaluate(() => {
      const pickerView = document.getElementById("lmsCoursePickerView");
      const playerView = document.getElementById("lmsVideoClassroomPlayerView");
      return (
        pickerView && 
        window.getComputedStyle(pickerView).display !== "none" &&
        playerView &&
        window.getComputedStyle(playerView).display === "none"
      );
    });
    console.log("✅ Course Selection Grid shown first before video:", coursePickerVisible);
    if (!coursePickerVisible) throw new Error("Course picker grid was NOT shown first in Video Classroom!");

    await page.screenshot({ path: path.join(screenshotsDir, '01_lms_course_picker.png'), fullPage: false });

    // 3. Select a Course from the Grid
    console.log("3️⃣ Selecting a course from grid...");
    await page.evaluate(() => {
      const firstCard = document.querySelector(".lms-course-picker-card");
      if (firstCard) firstCard.click();
    });
    await page.waitForTimeout(1000);

    const playerViewVisible = await page.evaluate(() => {
      const pickerView = document.getElementById("lmsCoursePickerView");
      const playerView = document.getElementById("lmsVideoClassroomPlayerView");
      return (
        pickerView && 
        window.getComputedStyle(pickerView).display === "none" &&
        playerView &&
        window.getComputedStyle(playerView).display !== "none"
      );
    });
    console.log("✅ Classroom player view activated on course selection:", playerViewVisible);
    if (!playerViewVisible) throw new Error("Classroom player view failed to activate on course click!");

    // 4. Verify Watermark Default State & NIC Content
    console.log("4️⃣ Verifying Anti-Piracy Watermark (Default Disabled & NIC-only text)...");
    const watermarkStatus = await page.evaluate(() => {
      const wm = document.getElementById("playerDrmWatermark");
      const textEl = document.getElementById("playerWatermarkText");
      const isDisplayNone = wm ? window.getComputedStyle(wm).display === "none" : false;
      const textContent = textEl ? textEl.textContent.trim() : "";
      return { isDisplayNone, textContent };
    });
    console.log("Watermark initial state (should be display: none):", watermarkStatus.isDisplayNone);
    console.log("Watermark text content (should be NIC '200541935351' only):", watermarkStatus.textContent);

    if (!watermarkStatus.isDisplayNone) {
      throw new Error("Watermark must be DISABLED by default!");
    }
    if (watermarkStatus.textContent !== "200541935351") {
      throw new Error(`Watermark text must be student NIC only! Got: "${watermarkStatus.textContent}"`);
    }

    // Enable watermark dynamically to verify active styling & rendering
    await page.evaluate(() => {
      window.EDUPEAK_PLAYER.setWatermarkEnabled(true);
    });
    await page.waitForTimeout(500);

    const watermarkEnabledStatus = await page.evaluate(() => {
      const wm = document.getElementById("playerDrmWatermark");
      return wm && window.getComputedStyle(wm).display !== "none";
    });
    console.log("✅ Watermark can be enabled and displays student NIC:", watermarkEnabledStatus);

    await page.screenshot({ path: path.join(screenshotsDir, '02_video_player_with_nic_watermark.png'), fullPage: false });

    // 5. Test Interactive Video Quality Selector
    console.log("5️⃣ Testing Video Quality Selector dropdown...");
    await page.evaluate(() => {
      window.EDUPEAK_PLAYER.toggleQualityMenu();
    });
    await page.waitForTimeout(300);

    const qualityMenuOpen = await page.evaluate(() => {
      const menu = document.getElementById("playerQualityMenu");
      return menu && menu.classList.contains("active");
    });
    console.log("Quality menu dropdown toggled:", qualityMenuOpen);

    // Select 720p HD
    await page.evaluate(() => {
      window.EDUPEAK_PLAYER.setPlaybackQuality('hd720');
    });
    await page.waitForTimeout(500);

    const currentQualityLabel = await page.evaluate(() => {
      const label = document.getElementById("playerQualityLabel");
      return label ? label.textContent.trim() : "";
    });
    console.log("✅ Video Quality label updated to:", currentQualityLabel);
    if (currentQualityLabel !== "720p HD") {
      throw new Error(`Expected Quality label to be '720p HD', got: ${currentQualityLabel}`);
    }

    // 6. Test Switch Course Back button
    console.log("6️⃣ Testing 'Switch Course / Back to Courses' button...");
    await page.evaluate(() => {
      window.showCoursePickerInLMS();
    });
    await page.waitForTimeout(500);

    const coursePickerBackVisible = await page.evaluate(() => {
      const pickerView = document.getElementById("lmsCoursePickerView");
      const playerView = document.getElementById("lmsVideoClassroomPlayerView");
      return (
        pickerView && 
        window.getComputedStyle(pickerView).display !== "none" &&
        playerView &&
        window.getComputedStyle(playerView).display === "none"
      );
    });
    console.log("✅ Switched back to course selection grid:", coursePickerBackVisible);

    // 7. Test Live Classroom Custom Player
    console.log("7️⃣ Testing Live Classroom Branded Custom Player...");
    await page.evaluate(() => {
      window.switchLMSTab('live-room');
    });
    await page.waitForTimeout(1000);

    const livePlayerStatus = await page.evaluate(() => {
      const liveWrapper = document.getElementById("edupeakLivePlayerWrapper");
      const liveMount = document.getElementById("edupeakLiveYTPlayerMount");
      const liveQualityTrigger = document.getElementById("livePlayerQualityTriggerBtn");
      const liveWmText = document.getElementById("livePlayerWatermarkText");
      const rawIframe = document.getElementById("lmsLiveStreamIframe");

      return {
        hasLiveWrapper: !!liveWrapper,
        hasLiveMount: !!liveMount,
        hasQualityControl: !!liveQualityTrigger,
        liveNicText: liveWmText ? liveWmText.textContent.trim() : "",
        hasRawIframe: !!rawIframe
      };
    });

    console.log("Live Custom Player wrapper present:", livePlayerStatus.hasLiveWrapper);
    console.log("Live Quality switcher present:", livePlayerStatus.hasQualityControl);
    console.log("Live student watermark NIC:", livePlayerStatus.liveNicText);
    console.log("Raw default YouTube iframe removed:", !livePlayerStatus.hasRawIframe);

    if (!livePlayerStatus.hasLiveWrapper || livePlayerStatus.hasRawIframe) {
      throw new Error("Live class must use custom player instead of raw iframe!");
    }
    if (livePlayerStatus.liveNicText !== "200541935351") {
      throw new Error(`Live watermark text should be student NIC, got: ${livePlayerStatus.liveNicText}`);
    }

    await page.screenshot({ path: path.join(screenshotsDir, '03_live_class_custom_player.png'), fullPage: false });

    // 8. Test Teacher Portal & Admin Modals Watermark Checkboxes
    console.log("8️⃣ Verifying Teacher Portal & Admin modal Watermark toggle checkboxes...");
    await page.goto('http://localhost:5050/teacher-portal.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const teacherWatermarkCheckboxes = await page.evaluate(() => {
      const courseCb = document.getElementById("courseWatermarkCheckbox");
      const editCourseCb = document.getElementById("editCourseWatermarkCheckbox");
      const lessonCb = document.getElementById("lessonWatermarkCheckbox");
      const editLessonCb = document.getElementById("editLessonWatermarkCheckbox");

      return {
        courseCbExists: !!courseCb,
        courseCbDefaultUnchecked: courseCb ? !courseCb.checked : false,
        editCourseCbExists: !!editCourseCb,
        lessonCbExists: !!lessonCb,
        lessonCbDefaultUnchecked: lessonCb ? !lessonCb.checked : false,
        editLessonCbExists: !!editLessonCb
      };
    });

    console.log("Teacher Portal watermark toggles:", teacherWatermarkCheckboxes);
    if (!teacherWatermarkCheckboxes.courseCbExists || !teacherWatermarkCheckboxes.courseCbDefaultUnchecked ||
        !teacherWatermarkCheckboxes.lessonCbExists || !teacherWatermarkCheckboxes.lessonCbDefaultUnchecked) {
      throw new Error("Teacher Portal watermark toggle checkboxes missing or not disabled by default!");
    }

    await page.screenshot({ path: path.join(screenshotsDir, '04_teacher_portal_watermark_checkboxes.png'), fullPage: false });

    console.log("\n🎉 ALL 5 USER REQUIREMENTS SUCCESSFULLY VERIFIED & PASSED!");

  } catch (err) {
    console.error("❌ Test failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runTests();
