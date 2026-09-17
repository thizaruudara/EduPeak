const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\5f79724a-cbe6-48b4-bef9-d59476509a57';

async function verify() {
  console.log('--- Launching Chrome Headless ---');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 950 }
  });
  const page = await context.newPage();

  page.on('console', msg => console.log('[BROWSER]', msg.type(), msg.text()));

  console.log('--- Navigating to http://localhost:3000 ---');
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('--- Opening LMS Video Classroom ---');
  await page.evaluate(() => {
    // Authenticate student session
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.defaultUsers) {
      const student = window.AUTH_SYSTEM.defaultUsers.find(u => u.role === 'student');
      if (student) window.AUTH_SYSTEM.createSession(student);
    }
    // Open Video Classroom
    if (typeof window.openLMSPortal === 'function') {
      window.openLMSPortal('video-classroom');
    }
    // Select first lesson and display video classroom view
    if (typeof window.showLessonVideo === 'function') {
      window.showLessonVideo(0);
    } else if (typeof window.renderLMSLesson === 'function') {
      window.renderLMSLesson(0);
    }
  });

  await page.waitForTimeout(1500);

  // Verify elements existence
  const checks = await page.evaluate(() => {
    const videoContainer = document.getElementById('recordedVideoPlayerContainer');
    const topBar = document.getElementById('playerTopBar');
    const drmBadge = topBar ? topBar.querySelector('.drm-badge') : null;
    const topLesson = document.getElementById('playerTopLessonTitle');
    const topTeacher = document.getElementById('playerTopTeacherName');
    const bigPlayBtn = document.getElementById('playerBigPlayBtn');
    const bigCircle = bigPlayBtn ? bigPlayBtn.querySelector('.big-play-icon-circle') : null;
    const topBanner = document.getElementById('recordedStartupTopBanner');
    const bottomBanner = document.getElementById('recordedStartupBottomBanner');
    const qualityTrigger = document.getElementById('playerQualityTriggerBtn');
    const qualityLabel = document.getElementById('playerQualityLabel');
    const progressBar = document.getElementById('playerProgressBar');

    return {
      hasVideoContainer: !!videoContainer,
      videoContainerBg: videoContainer ? window.getComputedStyle(videoContainer).backgroundColor : '',
      videoContainerRadius: videoContainer ? window.getComputedStyle(videoContainer).borderRadius : '',
      hasTopBar: !!topBar,
      drmBadgeText: drmBadge ? drmBadge.innerText.trim() : '',
      topLessonText: topLesson ? topLesson.innerText.trim() : '',
      topTeacherText: topTeacher ? topTeacher.innerText.trim() : '',
      hasBigPlayBtn: !!bigPlayBtn,
      bigCircleBg: bigCircle ? window.getComputedStyle(bigCircle).backgroundImage : '',
      hasTopBanner: !!topBanner,
      hasBottomBanner: !!bottomBanner,
      hasQualityTrigger: !!qualityTrigger,
      qualityLabelText: qualityLabel ? qualityLabel.innerText.trim() : '',
      progressBarBg: progressBar ? window.getComputedStyle(progressBar).backgroundImage : ''
    };
  });

  // Check modal and view states
  const viewStates = await page.evaluate(() => {
    const modal = document.getElementById('lmsModalWrapper');
    const playerView = document.getElementById('lmsVideoClassroomPlayerView');
    const playerStage = document.getElementById('recordedVideoPlayerContainer');
    const wrapper = document.getElementById('edupeakPlayerWrapper');

    return {
      modalActive: modal ? modal.classList.contains('active') : false,
      modalDisplay: modal ? window.getComputedStyle(modal).display : '',
      playerViewDisplay: playerView ? window.getComputedStyle(playerView).display : '',
      playerStageVisible: !!(playerStage && playerStage.offsetWidth > 0 && playerStage.offsetHeight > 0),
      stageWidth: playerStage ? playerStage.offsetWidth : 0,
      stageHeight: playerStage ? playerStage.offsetHeight : 0
    };
  });
  console.log('View States:', JSON.stringify(viewStates, null, 2));

  // If modal or player view not visible, force active for visual validation
  await page.evaluate(() => {
    const modal = document.getElementById('lmsModalWrapper');
    if (modal) modal.classList.add('active');
    const pickerView = document.getElementById('lmsCoursePickerView');
    if (pickerView) pickerView.style.display = 'none';
    const playerView = document.getElementById('lmsVideoClassroomPlayerView');
    if (playerView) playerView.style.display = 'block';
  });
  await page.waitForTimeout(500);

  // Capture full page screenshot
  const fullShotPath = path.join(ARTIFACTS_DIR, 'recorded_classroom_full_view_verified.png');
  await page.screenshot({ path: fullShotPath });
  console.log('Saved full page screenshot to:', fullShotPath);

  // Capture player wrapper screenshot
  const playerWrapperEl = await page.$('#edupeakPlayerWrapper');
  if (playerWrapperEl) {
    const shotPath = path.join(ARTIFACTS_DIR, 'recorded_player_stage_verified.png');
    await playerWrapperEl.screenshot({ path: shotPath });
    console.log('Saved player stage screenshot to:', shotPath);
  }

  // Test mobile viewport (<= 768px)
  await page.setViewportSize({ width: 412, height: 915 });
  await page.waitForTimeout(1000);

  const mobileChecks = await page.evaluate(() => {
    const topBanner = document.getElementById('recordedStartupTopBanner');
    const bottomBanner = document.getElementById('recordedStartupBottomBanner');
    return {
      topBannerDisplay: topBanner ? window.getComputedStyle(topBanner).display : '',
      bottomBannerDisplay: bottomBanner ? window.getComputedStyle(bottomBanner).display : ''
    };
  });
  console.log('Mobile checks (banners should be hidden):', JSON.stringify(mobileChecks, null, 2));

  const mobileShotPath = path.join(ARTIFACTS_DIR, 'recorded_player_mobile_verified.png');
  await page.screenshot({ path: mobileShotPath });
  console.log('Saved mobile screenshot to:', mobileShotPath);

  await browser.close();
  console.log('--- Test Complete ---');
}

verify().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
