const { chromium } = require('playwright-core');
const path = require('path');
const http = require('http');
const fs = require('fs');

function findChromePath() {
  const commonPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const PORT = 3089;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/live-class.html';
  const filePath = path.join(__dirname, '..', reqPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.json': 'application/json'
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

async function run() {
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`Test server running on port ${PORT}`);

  const chromePath = findChromePath();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, // Mobile iPhone viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
  });

  const page = await context.newPage();

  // Seed mock schedule and user in localStorage before loading the page
  await page.addInitScript(() => {
    const mockSession = {
      id: "test_live_instant",
      topic: "asdfasfs",
      examYear: "2026 A/L",
      subject: "theory",
      teacherName: "Amalsha Wanniarachchi",
      teacherBio: "MBBS (UG) • University of Sri Jayewardenepura",
      status: "live",
      rawUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      scheduleDate: "2026-09-17",
      scheduleTime: "10:00 - 12:00",
      startedAt: new Date().toISOString()
    };
    localStorage.setItem("edupeak_schedules_db", JSON.stringify([mockSession]));
    localStorage.setItem("edupeak_last_active_stream", "test_live_instant");
    localStorage.setItem("edupeak_current_user", JSON.stringify({
      id: "std_test_01",
      name: "Kasun Perera",
      role: "student",
      nic: "200512345678"
    }));
  });

  const startTime = Date.now();
  await page.goto(`http://localhost:${PORT}/live-class.html`, { waitUntil: 'domcontentloaded' });

  // Wait for player to be displayed
  await page.waitForSelector('#edupeakLivePlayerWrapper', { state: 'visible', timeout: 5000 });
  const loadDuration = Date.now() - startTime;
  console.log(`Live Player appeared in: ${loadDuration}ms`);

  // Verify normal playing state: no permanent black bar
  const normalChecks = await page.evaluate(() => {
    const mask = document.getElementById("livePlayerPermanentTopMask");
    const topBar = document.getElementById("livePlayerTopBar");
    const topLesson = document.querySelector(".edupeak-player-top-bar .top-bar-lesson");
    const maskStyle = mask ? window.getComputedStyle(mask) : null;
    const topLessonStyle = topLesson ? window.getComputedStyle(topLesson) : null;

    return {
      maskPresent: !!mask && maskStyle.display !== 'none',
      topLessonDisplay: topLessonStyle ? topLessonStyle.display : null,
    };
  });

  console.log("Normal playback checks:", normalChecks);

  // Trigger fullscreen via API
  await page.evaluate(() => {
    window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();
  });

  // Verify fullscreen state: fullscreen-mode present, mobile-landscape-rotate NOT present
  const fsChecks = await page.evaluate(() => {
    const wrapper = document.getElementById("edupeakLivePlayerWrapper");
    const style = window.getComputedStyle(wrapper);
    return {
      hasFullscreenMode: wrapper.classList.contains("fullscreen-mode"),
      hasMobileLandscapeRotate: wrapper.classList.contains("mobile-landscape-rotate"),
      position: style.position,
      width: style.width,
      height: style.height,
      transform: style.transform
    };
  });

  console.log("Fullscreen checks:", fsChecks);

  // Take screenshot of clean fullscreen on mobile
  const fsScreenshotPath = path.resolve(__dirname, '../verification_mobile_fullscreen_clean.png');
  await page.screenshot({ path: fsScreenshotPath, fullPage: false });
  console.log("Saved fullscreen screenshot to:", fsScreenshotPath);

  // Exit fullscreen
  await page.evaluate(() => {
    window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();
  });

  await page.waitForTimeout(500);

  // Take screenshot of clean normal player (no black bar at top)
  const normalScreenshotPath = path.resolve(__dirname, '../verification_mobile_normal_clean.png');
  await page.screenshot({ path: normalScreenshotPath, fullPage: false });
  console.log("Saved normal playback screenshot to:", normalScreenshotPath);

  await browser.close();
  server.close();

  let errors = [];
  if (normalChecks.maskPresent) errors.push("Permanent top mask is still displayed (creates black bar at top of video)");
  if (!fsChecks.hasFullscreenMode) errors.push("Wrapper should have fullscreen-mode class");
  if (fsChecks.hasMobileLandscapeRotate) errors.push("Wrapper should NOT have mobile-landscape-rotate class (causes 90-degree sideways rotation)");
  if (fsChecks.transform && fsChecks.transform.includes('matrix') && fsChecks.transform !== 'none') {
    errors.push(`Wrapper should not have transform matrix applied in fullscreen, got: ${fsChecks.transform}`);
  }

  if (errors.length > 0) {
    console.error("FAIL:", errors);
    process.exit(1);
  } else {
    console.log("PASS: 1. No permanent black bar at top of video. 2. Fullscreen is clean without artificial 90-degree sideways rotation!");
  }
}

run().catch(err => {
  console.error(err);
  if (server) server.close();
  process.exit(1);
});
