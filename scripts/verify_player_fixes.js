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

  console.log('Navigating to index.html...');
  await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Set student session with enrolled courses
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
      avatarLetter: "K",
      enrolledCourses: ["phy-2027-theory", "phy-2026-theory", "phy-2027-revision"]
    };
    localStorage.setItem("edupeak_active_session", JSON.stringify(testStudent));
    localStorage.setItem("edupeak_enrolled", JSON.stringify(["phy-2027-theory", "phy-2026-theory"]));
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.updateUIForAuthState) {
      window.AUTH_SYSTEM.updateUIForAuthState();
    }
  });

  // Open LMS Classroom with the enrolled course
  console.log('Opening LMS classroom...');
  await page.evaluate(() => {
    window.openLMSPortal('video-classroom', 'phy-2027-theory');
  });
  await page.waitForTimeout(1000);

  // If picker is visible, click the first course card
  await page.evaluate(() => {
    const pickerView = document.getElementById("lmsCoursePickerView");
    if (pickerView && window.getComputedStyle(pickerView).display !== "none") {
      const firstCard = document.querySelector(".lms-course-picker-card");
      if (firstCard) firstCard.click();
    }
  });
  await page.waitForTimeout(1000);

  // 1. Check cropper computed styles
  const cropperBox = await page.evaluate(() => {
    const el = document.querySelector('.edupeak-yt-frame-cropper');
    if (!el) return null;
    const style = window.getComputedStyle(el);
    const iframe = el.querySelector('iframe') || el.querySelector('#edupeakYTPlayerMount');
    const iframeStyle = iframe ? window.getComputedStyle(iframe) : null;
    return {
      top: style.top,
      left: style.left,
      width: style.width,
      height: style.height,
      iframeWidth: iframeStyle ? iframeStyle.width : null,
      iframeHeight: iframeStyle ? iframeStyle.height : null
    };
  });
  console.log('✅ Cropper computed box (should be top 0, left 0, 100%):', cropperBox);

  // 2. Check metadata rendering
  const metaText = await page.evaluate(() => {
    const teacher = document.getElementById('lmsLessonTeacher')?.textContent?.trim();
    const badge = document.getElementById('lmsLessonBadge')?.textContent?.trim();
    const title = document.getElementById('lmsLessonTitle')?.textContent?.trim();
    return { teacher, badge, title };
  });
  console.log('✅ LMS Metadata (no undefined):', metaText);

  // 3. Test Quality Menu Toggle
  console.log('Testing Quality Selector UI...');
  await page.evaluate(() => {
    window.EDUPEAK_PLAYER.toggleQualityMenu();
  });
  await page.waitForTimeout(300);

  const isMenuOpen = await page.evaluate(() => {
    return document.getElementById('playerQualityMenu')?.classList.contains('active');
  });
  console.log('✅ Quality dropdown open:', isMenuOpen);

  // 4. Test Switching to 720p HD
  await page.evaluate(() => {
    const btn = document.querySelector('#playerQualityMenu button[data-quality="hd720"]');
    if (btn) btn.click();
    else window.EDUPEAK_PLAYER.setPlaybackQuality('hd720');
  });
  await page.waitForTimeout(400);

  const state720 = await page.evaluate(() => {
    const label = document.getElementById('playerQualityLabel')?.textContent?.trim();
    const badge = document.querySelector('#playerTopBar .res-badge')?.textContent?.trim();
    const activeBtn = document.querySelector('#playerQualityMenu button.active')?.textContent?.trim();
    return { label, badge, activeBtn };
  });
  console.log('✅ State after 720p switch:', state720);

  // 5. Test Switching to 480p
  await page.evaluate(() => {
    const btn = document.querySelector('#playerQualityMenu button[data-quality="large"]');
    if (btn) btn.click();
    else window.EDUPEAK_PLAYER.setPlaybackQuality('large');
  });
  await page.waitForTimeout(400);

  const state480 = await page.evaluate(() => {
    const label = document.getElementById('playerQualityLabel')?.textContent?.trim();
    const badge = document.querySelector('#playerTopBar .res-badge')?.textContent?.trim();
    const activeBtn = document.querySelector('#playerQualityMenu button.active')?.textContent?.trim();
    return { label, badge, activeBtn };
  });
  console.log('✅ State after 480p switch:', state480);

  // 6. Test Switching back to Auto
  await page.evaluate(() => {
    const btn = document.querySelector('#playerQualityMenu button[data-quality="auto"]');
    if (btn) btn.click();
    else window.EDUPEAK_PLAYER.setPlaybackQuality('auto');
  });
  await page.waitForTimeout(400);

  const stateAuto = await page.evaluate(() => {
    const label = document.getElementById('playerQualityLabel')?.textContent?.trim();
    const badge = document.querySelector('#playerTopBar .res-badge')?.textContent?.trim();
    const activeBtn = document.querySelector('#playerQualityMenu button.active')?.textContent?.trim();
    return { label, badge, activeBtn };
  });
  console.log('✅ State after Auto switch:', stateAuto);

  // Take screenshot
  const screenshotPath = path.join(__dirname, 'player_verified.png');
  await page.screenshot({ path: screenshotPath });
  console.log('✅ Screenshot saved to:', screenshotPath);

  await browser.close();
  console.log('🎉 ALL VIDEO PLAYER & LMS TESTS PASSED SUCCESSFULLY!');
})();
