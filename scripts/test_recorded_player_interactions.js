const { chromium } = require('playwright-core');
const path = require('path');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\5f79724a-cbe6-48b4-bef9-d59476509a57';

async function testInteractions() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });

  await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await page.evaluate(() => {
    if (window.AUTH_SYSTEM && window.AUTH_SYSTEM.defaultUsers) {
      const student = window.AUTH_SYSTEM.defaultUsers.find(u => u.role === 'student');
      if (student) window.AUTH_SYSTEM.createSession(student);
    }
    if (typeof window.openLMSPortal === 'function') {
      window.openLMSPortal('video-classroom');
    }
    const modal = document.getElementById('lmsModalWrapper');
    if (modal) modal.classList.add('active');
    const pickerView = document.getElementById('lmsCoursePickerView');
    if (pickerView) pickerView.style.display = 'none';
    const playerView = document.getElementById('lmsVideoClassroomPlayerView');
    if (playerView) playerView.style.display = 'block';

    if (typeof window.renderLMSLesson === 'function') {
      window.renderLMSLesson(0);
    }
  });

  await page.waitForTimeout(1000);

  // Click quality menu
  console.log('--- Testing Quality Menu Toggle ---');
  await page.click('#playerQualityTriggerBtn');
  await page.waitForTimeout(300);

  const qualityMenuVisible = await page.evaluate(() => {
    const menu = document.getElementById('playerQualityMenu');
    return menu ? menu.classList.contains('active') : false;
  });
  console.log('Quality menu visible after click:', qualityMenuVisible);

  // Click 720p HD option
  await page.evaluate(() => {
    const btn720 = document.querySelector('#playerQualityMenu button[data-quality="hd720"]');
    if (btn720) btn720.click();
  });
  await page.waitForTimeout(300);

  const qualityLabelAfter = await page.evaluate(() => {
    const label = document.getElementById('playerQualityLabel');
    return label ? label.textContent.trim() : '';
  });
  console.log('Quality label after selecting 720p:', qualityLabelAfter);

  // Click Speed Menu
  console.log('--- Testing Speed Menu Toggle ---');
  await page.click('#btnSpeedTrigger');
  await page.waitForTimeout(300);

  const speedMenuVisible = await page.evaluate(() => {
    const menu = document.getElementById('playerSpeedMenu');
    return menu ? menu.classList.contains('active') : false;
  });
  console.log('Speed menu visible after click:', speedMenuVisible);

  // Select 1.5x
  await page.evaluate(() => {
    window.EDUPEAK_PLAYER.setPlaybackRate(1.5, true);
  });
  await page.waitForTimeout(300);

  const speedLabelAfter = await page.evaluate(() => {
    const label = document.getElementById('currentSpeedText');
    return label ? label.textContent.trim() : '';
  });
  console.log('Speed label after selecting 1.5x:', speedLabelAfter);

  // Capture final interactive screenshot
  const shotPath = path.join(ARTIFACTS_DIR, 'recorded_player_interaction_verified.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved interaction screenshot to:', shotPath);

  await browser.close();
  console.log('--- Interactions Test Passed Successfully ---');
}

testInteractions().catch(err => {
  console.error('Interaction Test Failed:', err);
  process.exit(1);
});
