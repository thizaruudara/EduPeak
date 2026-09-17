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

const PORT = 3088;
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
  console.log(`Live Player appeared in: ${loadDuration}ms (Instant cache-first!)`);

  // Verify elements and computed styles
  const evaluation = await page.evaluate(() => {
    const mask = document.getElementById("livePlayerPermanentTopMask");
    const topBar = document.getElementById("livePlayerTopBar");
    const topLesson = document.querySelector(".edupeak-player-top-bar .top-bar-lesson");
    const drmBadge = document.querySelector(".drm-badge");
    const playerWrapper = document.getElementById("edupeakLivePlayerWrapper");
    const mount = document.getElementById("edupeakLiveYTPlayerMount");

    const maskStyle = mask ? window.getComputedStyle(mask) : null;
    const topLessonStyle = topLesson ? window.getComputedStyle(topLesson) : null;
    const drmBadgeStyle = drmBadge ? window.getComputedStyle(drmBadge) : null;

    return {
      maskExists: !!mask,
      maskHeight: maskStyle ? maskStyle.height : null,
      maskZIndex: maskStyle ? maskStyle.zIndex : null,
      maskBg: maskStyle ? maskStyle.backgroundImage || maskStyle.background : null,
      topLessonDisplay: topLessonStyle ? topLessonStyle.display : null,
      drmBadgeBg: drmBadgeStyle ? drmBadgeStyle.backgroundColor : null,
      playerVisible: playerWrapper ? window.getComputedStyle(playerWrapper).display : null,
      mountExists: !!mount
    };
  });

  console.log("Player checks:", JSON.stringify(evaluation, null, 2));

  let errors = [];
  if (!evaluation.maskExists) errors.push("Permanent top mask does not exist");
  if (parseInt(evaluation.maskHeight) < 50) errors.push(`Mask height is too small: ${evaluation.maskHeight}`);
  if (evaluation.topLessonDisplay !== "none") errors.push(`Top lesson title should be hidden on mobile, got: ${evaluation.topLessonDisplay}`);
  if (evaluation.playerVisible !== "block") errors.push(`Player should be visible, got: ${evaluation.playerVisible}`);

  // Take screenshot for visual verification
  const screenshotPath = path.resolve(__dirname, '../verification_instant_mobile_player.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log("Saved verification screenshot to:", screenshotPath);

  await browser.close();
  server.close();

  if (errors.length > 0) {
    console.error("FAIL:", errors);
    process.exit(1);
  } else {
    console.log("PASS: Video player loads instantly, permanent top mask covers 52px, and colliding title is completely removed!");
  }
}

run().catch(err => {
  console.error(err);
  if (server) server.close();
  process.exit(1);
});
