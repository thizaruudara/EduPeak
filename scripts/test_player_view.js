const { chromium } = require('playwright-core');
const path = require('path');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\56cf55bd-d563-4fd7-a54f-6ca56f007007';

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    if (window.AUTH_SYSTEM) {
      const student = window.AUTH_SYSTEM.defaultUsers.find(u => u.role === 'student');
      window.AUTH_SYSTEM.createSession(student);
    }
    if (window.openLMSPortal) {
      window.openLMSPortal('video-classroom');
    }
    if (window.updatePlayerWatermarkUser) {
      window.updatePlayerWatermarkUser();
    }
  });

  await page.waitForTimeout(2000);

  // Make sure watermark is clearly styled and visible for screenshot
  const watermarkEl = await page.$('#playerDrmWatermark');
  if (watermarkEl) {
    await watermarkEl.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_watermark_badge_close.png') });
    console.log('Watermark badge close-up saved');
  }

  const playerWrapper = await page.$('#edupeakPlayerWrapper');
  if (playerWrapper) {
    await playerWrapper.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_player_wrapper_watermark.png') });
    console.log('Player wrapper screenshot saved');
  }

  await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_video_player_modal_nic.png') });
  console.log('Full modal screenshot saved');

  await browser.close();
}

main();
