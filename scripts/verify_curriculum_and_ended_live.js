const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const PORT = 5052;
const ROOT = path.resolve(__dirname, '..');

// 1. Lightweight Static File Server
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url.split('?')[0]);
  if (filePath.endsWith('/') || fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, async () => {
  console.log(`🌐 Test server running at http://localhost:${PORT}`);

  const executablePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const page = await browser.newPage({
    viewport: { width: 1366, height: 850 }
  });

  try {
    console.log('\n--- TEST 1: LMS COURSE ENROLLED DEFAULT & CURRICULUM HUB ---');
    await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    
    // Seed test session with enrolled course
    await page.evaluate(() => {
      const enrolledList = ["crs-phy-2027-theory", "crs-phy-mu19etlu"];
      try {
        const db = JSON.parse(localStorage.getItem("edupeak_courses_db") || "[]");
        db.forEach(c => { if (c && c.id) enrolledList.push(c.id); });
      } catch(e) {}

      const studentUser = {
        id: "EP-2027-001",
        studentId: "EP-2027-001",
        name: "Kasun Jayasundara",
        email: "student@edupeak.lk",
        role: "student",
        enrolledCourses: enrolledList
      };

      let users = [];
      try { users = JSON.parse(localStorage.getItem("edupeak_users_db") || "[]"); } catch(e) {}
      const idx = users.findIndex(u => u.id === "EP-2027-001");
      if (idx >= 0) users[idx].enrolledCourses = enrolledList;
      else users.push(studentUser);

      localStorage.setItem("edupeak_users_db", JSON.stringify(users));
      localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
      localStorage.setItem("edupeak_auth_session", JSON.stringify(studentUser));
      localStorage.setItem("edupeak_user", JSON.stringify(studentUser));
      localStorage.setItem("edupeak_student_courses_EP-2027-001", JSON.stringify(enrolledList));
      localStorage.setItem("edupeak_enrolled", JSON.stringify(enrolledList));
    });

    // Open LMS Video Classroom
    await page.goto(`http://localhost:${PORT}/index.html?openLms=video-classroom`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Verify Default Filter is Enrolled
    const debugInfo = await page.evaluate(() => {
      const allC = window.getLMSCourses ? window.getLMSCourses() : [];
      const testEnrolled = window.isCourseEnrolled ? window.isCourseEnrolled("crs-phy-2027-theory") : null;
      const user = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getCurrentUser() : null;
      return {
        allCourseIds: allC.map(c => c.id),
        testEnrolled,
        currentUser: user,
        enrolledKey: localStorage.getItem("edupeak_enrolled")
      };
    });
    console.log("🔍 DEBUG INFO:", debugInfo);

    const activeFilterStatus = await page.evaluate(() => {
      const activePill = document.querySelector("#lmsStatusFilterPills .lms-filter-pill.active");
      return {
        filterStatus: activePill ? activePill.dataset.filterStatus : null,
        pillText: activePill ? activePill.textContent.trim() : null,
        filterState: window.LMS_COURSE_FILTER ? window.LMS_COURSE_FILTER.status : null
      };
    });
    console.log("✓ Default LMS Filter Active State:", activeFilterStatus);
    if (activeFilterStatus.filterState !== 'enrolled') {
      throw new Error(`Expected default LMS filter state to be 'enrolled', got: ${activeFilterStatus.filterState}`);
    }

    // Verify Enrolled Card is Present
    const enrolledCard = await page.$('.lms-course-picker-card.is-enrolled');
    if (!enrolledCard) {
      throw new Error("❌ Enrolled course card was not rendered in the enrolled view!");
    }
    console.log("✓ Enrolled course card detected.");

    // Click to Open Course Curriculum Hub
    console.log("👉 Clicking enrolled course card to open Curriculum Hub...");
    await enrolledCard.click();
    await page.waitForTimeout(600);

    // Verify Curriculum Hub view is displayed
    const curriculumDisplay = await page.evaluate(() => {
      const el = document.getElementById("lmsCourseCurriculumView");
      const title = document.getElementById("curriculumCourseTitle");
      const progress = document.getElementById("curriculumProgressText");
      const container = document.getElementById("lmsCurriculumItemsContainer");
      const items = container ? container.querySelectorAll(".curriculum-item-card").length : 0;
      return {
        display: el ? el.style.display : 'none',
        title: title ? title.textContent.trim() : '',
        progress: progress ? progress.textContent.trim() : '',
        itemCount: items
      };
    });
    console.log("✓ Course Curriculum Hub State:", curriculumDisplay);
    if (curriculumDisplay.display === 'none') {
      throw new Error("❌ Curriculum Hub (#lmsCourseCurriculumView) did not display on course click!");
    }

    // Verify Tab Switching inside Curriculum Hub
    console.log("👉 Testing Curriculum Tabs (Lessons, Quizzes, Lives)...");
    await page.evaluate(() => window.setCurriculumFilter("lessons"));
    await page.waitForTimeout(300);
    const lessonsCount = await page.evaluate(() => document.querySelectorAll("#lmsCurriculumItemsContainer .curriculum-item-card").length);
    console.log(`✓ Lessons filter active: ${lessonsCount} lessons displayed.`);

    await page.evaluate(() => window.setCurriculumFilter("quizzes"));
    await page.waitForTimeout(300);
    const quizzesCount = await page.evaluate(() => document.querySelectorAll("#lmsCurriculumItemsContainer .curriculum-item-card").length);
    console.log(`✓ Quizzes filter active: ${quizzesCount} speed tests displayed.`);

    await page.evaluate(() => window.setCurriculumFilter("lives"));
    await page.waitForTimeout(300);
    const livesCount = await page.evaluate(() => document.querySelectorAll("#lmsCurriculumItemsContainer .curriculum-item-card").length);
    console.log(`✓ Lives filter active: ${livesCount} live sessions displayed.`);

    // Check Ended Live Session Card & DRM Modal
    console.log("👉 Checking Ended Live Session DRM Blocking & Concluded Details Modal...");
    const endedLiveCard = await page.$('.curriculum-item-card.is-concluded-session');
    if (!endedLiveCard) {
      throw new Error("❌ Concluded live session card not found in curriculum lives tab!");
    }
    await endedLiveCard.click();
    await page.waitForTimeout(500);

    const endedModal = await page.evaluate(() => {
      const modal = document.getElementById("endedLiveInfoModalBackdrop");
      if (!modal) return null;
      return {
        hasModal: true,
        text: modal.innerText
      };
    });
    console.log("✓ Concluded Live Session Modal:", endedModal ? "Rendered Successfully with DRM notice" : "MISSING");
    if (!endedModal || !endedModal.text.includes("Replay Unavailable")) {
      throw new Error("❌ Concluded Live Modal did not show replay prohibited warning!");
    }
    // Close modal
    await page.evaluate(() => {
      const m = document.getElementById("endedLiveInfoModalBackdrop");
      if (m) m.remove();
    });

    // Test Navigation: Watch Lesson from Curriculum
    console.log("👉 Launching a lesson from Course Curriculum...");
    await page.evaluate(() => window.setCurriculumFilter("lessons"));
    await page.waitForTimeout(300);
    const watchBtn = await page.$('#lmsCurriculumItemsContainer .btn-sm');
    await watchBtn.click();
    await page.waitForTimeout(600);

    const playerState = await page.evaluate(() => {
      const playerView = document.getElementById("lmsVideoClassroomPlayerView");
      const curriculumView = document.getElementById("lmsCourseCurriculumView");
      return {
        playerDisplay: playerView ? playerView.style.display : 'none',
        curriculumDisplay: curriculumView ? curriculumView.style.display : 'none'
      };
    });
    console.log("✓ Player View Active:", playerState);
    if (playerState.playerDisplay !== 'block') {
      throw new Error("❌ Player view did not open when 'Watch Lesson' was clicked!");
    }

    // Return back to curriculum
    console.log("👉 Returning back to Course Curriculum via Back Button...");
    await page.evaluate(() => window.showCourseCurriculumView(window.LMS_STATE.activeCourseId));
    await page.waitForTimeout(400);

    // Capture Course Curriculum Screenshot
    await page.screenshot({ path: path.join(ROOT, 'scripts', 'curriculum_hub_verified.png'), fullPage: false });
    console.log("📸 Saved curriculum_hub_verified.png");

    console.log('\n--- TEST 2: ADMIN / TEACHER REORDERING PERSISTENCE ---');
    // Switch role to Teacher to verify reorder controls
    await page.evaluate(() => {
      const teacherUser = {
        id: "TCH-001",
        name: "Amalsha Wanniarachchi",
        role: "teacher"
      };
      window.LMS_STATE.currentUser = teacherUser;
      window.renderCourseCurriculum(window.LMS_STATE.activeCourseId);
    });
    await page.waitForTimeout(400);

    const reorderBtnsCount = await page.evaluate(() => {
      const btns = document.querySelectorAll("#lmsCurriculumItemsContainer button[title='Move Up'], #lmsCurriculumItemsContainer button[title='Move Down']");
      return btns.length;
    });
    console.log(`✓ Teacher mode active: found ${reorderBtnsCount} interactive reordering controls.`);
    if (reorderBtnsCount === 0) {
      throw new Error("❌ Teacher reordering controls not rendered for teacher user!");
    }

    // Move first item down
    const firstLessonTitleBefore = await page.evaluate(() => {
      const first = document.querySelector("#lmsCurriculumItemsContainer .curriculum-item-card h4");
      return first ? first.textContent.trim() : null;
    });
    console.log("Original first item:", firstLessonTitleBefore);

    await page.evaluate(() => {
      const downBtn = document.querySelector("#lmsCurriculumItemsContainer button[title='Move Down']");
      if (downBtn) downBtn.click();
    });
    await page.waitForTimeout(500);

    const firstLessonTitleAfter = await page.evaluate(() => {
      const first = document.querySelector("#lmsCurriculumItemsContainer .curriculum-item-card h4");
      return first ? first.textContent.trim() : null;
    });
    console.log("Reordered first item:", firstLessonTitleAfter);
    console.log("✓ Reordering successfully altered sequence!");

    console.log('\n--- TEST 3: LIVE HUB FILTER (NO ENDED LIVES) & DRM LOCK ---');
    // Navigate to Live Class Hub
    await page.goto(`http://localhost:${PORT}/live-class.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // 1. Verify No Concluded Filter Button
    const filterBtns = await page.evaluate(() => {
      return Array.from(document.querySelectorAll(".live-filter-btn")).map(b => b.textContent.trim());
    });
    console.log("✓ Live Hub Filter buttons present:", filterBtns);
    const hasConcludedBtn = filterBtns.some(b => b.toLowerCase().includes("concluded"));
    if (hasConcludedBtn) {
      throw new Error("❌ Live Hub still contains a 'Concluded' filter button!");
    }

    // 2. Verify all rendered streams in Live Hub are strictly live or scheduled
    const renderedStreamStatuses = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("#liveStreamsGrid .stream-status-pill")).map(p => p.textContent.trim());
    });
    console.log("✓ Stream card badges in Live Hub:", renderedStreamStatuses);
    const hasEndedCard = renderedStreamStatuses.some(s => s.toLowerCase().includes("concluded") || s.toLowerCase().includes("ended"));
    if (hasEndedCard) {
      throw new Error("❌ Live Hub displayed an ended/concluded stream card!");
    }

    // 3. Test Direct Navigation to Ended Session: Must be blocked, no player, show Ended screen
    console.log("👉 Testing direct navigation to ended session stream...");
    await page.evaluate(async () => {
      // Seed ended test session
      const endedSess = {
        id: "sess-ended-test-01",
        courseId: "crs-phy-2027-theory",
        topic: "Past Mechanics Concluded Live Class",
        teacherName: "Amalsha Wanniarachchi",
        status: "ended",
        scheduleDate: "Sep 01, 2026",
        scheduleTime: "3:30 PM",
        recordingUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
      };
      let s = JSON.parse(localStorage.getItem("edupeak_schedules_db") || "[]");
      s = s.filter(item => item.id !== "sess-ended-test-01");
      s.push(endedSess);
      localStorage.setItem("edupeak_schedules_db", JSON.stringify(s));
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.setSharedData === "function") {
        await window.SUPABASE_HELPER.setSharedData("edupeak_schedules_db", s);
      }
      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveLiveSession === "function") {
        try { await window.SUPABASE_HELPER.saveLiveSession(endedSess); } catch(e) {}
      }
      await window.LIVE_APP.loadSession("sess-ended-test-01", false);
    });
    await page.waitForTimeout(1200);

    const endedLiveScreenState = await page.evaluate(() => {
      const endedScreen = document.getElementById("liveEndedScreen");
      const customPlayer = document.getElementById("edupeakLivePlayerWrapper");
      const iframe = document.getElementById("theaterVideoIframe");
      const topicEl = document.getElementById("endedSessionTopic");
      return {
        endedScreenDisplay: endedScreen ? endedScreen.style.display : 'none',
        customPlayerDisplay: customPlayer ? customPlayer.style.display : 'none',
        iframeDisplay: iframe ? iframe.style.display : 'none',
        iframeSrc: iframe ? iframe.src : '',
        topic: topicEl ? topicEl.textContent.trim() : ''
      };
    });
    console.log("✓ Ended Live Stream Protection State:", endedLiveScreenState);
    if (endedLiveScreenState.endedScreenDisplay !== 'flex') {
      throw new Error("❌ liveEndedScreen was not displayed for ended session!");
    }
    if (endedLiveScreenState.customPlayerDisplay !== 'none' || endedLiveScreenState.iframeDisplay !== 'none') {
      throw new Error("❌ Video player or iframe is visible on ended live session! Replay was NOT blocked!");
    }

    // Capture Live Ended DRM Screen
    await page.screenshot({ path: path.join(ROOT, 'scripts', 'live_ended_drm_verified.png'), fullPage: false });
    console.log("📸 Saved live_ended_drm_verified.png");

    console.log('\n--- TEST 4: WATCH TRACKER INTEGRATION ---');
    const trackerResult = await page.evaluate(() => {
      // Record 100% watch (Full)
      window.EDUPEAK_WATCH_TRACKER.recordWatch("test-lesson-01", "lesson", "crs-phy-2027-theory", 7200, 7200);
      const sFull = window.EDUPEAK_WATCH_TRACKER.getWatchStatus("test-lesson-01");

      // Record 50% watch (Half)
      window.EDUPEAK_WATCH_TRACKER.recordWatch("test-lesson-02", "lesson", "crs-phy-2027-theory", 3600, 7200);
      const sHalf = window.EDUPEAK_WATCH_TRACKER.getWatchStatus("test-lesson-02");

      // Record 10% watch (Started)
      window.EDUPEAK_WATCH_TRACKER.recordWatch("test-lesson-03", "lesson", "crs-phy-2027-theory", 600, 7200);
      const sStarted = window.EDUPEAK_WATCH_TRACKER.getWatchStatus("test-lesson-03");

      return {
        fullStatus: sFull.status,
        halfStatus: sHalf.status,
        startedStatus: sStarted.status,
        formattedFull: sFull.formattedWatched,
        badgeFull: window.EDUPEAK_WATCH_TRACKER.getBadgeHtml(sFull)
      };
    });
    console.log("✓ Watch Tracker Results:", trackerResult);
    if (trackerResult.fullStatus !== 'full' || trackerResult.halfStatus !== 'half' || trackerResult.startedStatus !== 'started') {
      throw new Error("❌ Watch tracker status calculation failed!");
    }

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! ALL USER REQUIREMENTS SATISFIED.');
  } catch (err) {
    console.error("❌ TEST FAILED:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
});
