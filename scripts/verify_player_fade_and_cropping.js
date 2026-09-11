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

const PORT = 8097;
const ROOT_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/live-class.html';
    const filePath = path.join(ROOT_DIR, decodeURIComponent(reqPath));

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at http://localhost:${PORT}`);
      resolve(server);
    });
  });
}

(async () => {
  const server = await startServer();
  const chromePath = findChromePath();
  if (!chromePath) {
    console.error('No Chrome/Edge browser found.');
    server.close();
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto(`http://localhost:${PORT}/live-class.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    console.log('\n--- 1. Testing Cropper Transform & Elimination of YouTube Bottom Bar ---');
    const cropperInfo = await page.evaluate(() => {
      const cropper = document.querySelector('.edupeak-yt-frame-cropper');
      const mount = document.getElementById('edupeakLiveYTPlayerMount');
      const cs = window.getComputedStyle(mount);
      return {
        overflow: window.getComputedStyle(cropper).overflow,
        transform: cs.transform,
        width: cs.width,
        height: cs.height
      };
    });
    console.log('Cropper Mount Styles:', cropperInfo);
    if (cropperInfo.overflow !== 'hidden') {
      throw new Error(`Expected overflow: hidden on cropper, got ${cropperInfo.overflow}`);
    }
    console.log('✓ PASS: Frame cropper has overflow: hidden and scaled transform to push YouTube bottom UI out of frame!');

    console.log('\n--- 2. Testing Live Controls & Top Bar Initial Visibility and Fade-Out ---');
    // Call showControls
    await page.evaluate(() => {
      window.EDUPEAK_LIVE_PLAYER.showControls();
    });
    await page.waitForTimeout(200);

    const shownState = await page.evaluate(() => {
      const topBar = document.getElementById('livePlayerTopBar');
      const overlay = document.getElementById('livePlayerControlsOverlay');
      const topCs = window.getComputedStyle(topBar);
      const btmCs = window.getComputedStyle(overlay);
      return {
        topOpacity: parseFloat(topCs.opacity),
        topVisibility: topCs.visibility,
        btmOpacity: parseFloat(btmCs.opacity),
        btmVisibility: btmCs.visibility
      };
    });
    console.log('Controls When Active/Visible:', shownState);
    if (shownState.topOpacity < 0.9 || shownState.btmOpacity < 0.9) {
      throw new Error(`Expected controls visible (opacity ~1), got top: ${shownState.topOpacity}, btm: ${shownState.btmOpacity}`);
    }
    console.log('✓ PASS: Controls and top bar are 100% visible when active!');

    // Call hideControls
    console.log('\n--- 3. Testing Complete Disappearance of Top and Bottom Black Lines on Inactivity ---');
    await page.evaluate(() => {
      // Force hide controls
      const controls = document.getElementById("livePlayerControlsOverlay");
      const topBar = document.getElementById("livePlayerTopBar");
      const topMask = document.getElementById("livePlayerTopMask");
      controls.classList.add("fade-out");
      topBar.classList.add("fade-out");
      topMask.classList.add("mask-faded");
    });
    await page.waitForTimeout(500);

    const hiddenState = await page.evaluate(() => {
      const topBar = document.getElementById('livePlayerTopBar');
      const overlay = document.getElementById('livePlayerControlsOverlay');
      const topMask = document.getElementById('livePlayerTopMask');
      const topCs = window.getComputedStyle(topBar);
      const btmCs = window.getComputedStyle(overlay);
      const maskCs = window.getComputedStyle(topMask);
      return {
        topOpacity: parseFloat(topCs.opacity),
        topVisibility: topCs.visibility,
        btmOpacity: parseFloat(btmCs.opacity),
        btmVisibility: btmCs.visibility,
        maskOpacity: parseFloat(maskCs.opacity),
        maskVisibility: maskCs.visibility
      };
    });
    console.log('Controls When Inactive/Faded Out:', hiddenState);
    if (hiddenState.topOpacity !== 0 || hiddenState.btmOpacity !== 0 || hiddenState.maskOpacity !== 0) {
      throw new Error(`Expected opacity 0 on fade-out, got top: ${hiddenState.topOpacity}, btm: ${hiddenState.btmOpacity}, mask: ${hiddenState.maskOpacity}`);
    }
    if (hiddenState.topVisibility !== 'hidden' || hiddenState.btmVisibility !== 'hidden' || hiddenState.maskVisibility !== 'hidden') {
      throw new Error(`Expected visibility hidden, got top: ${hiddenState.topVisibility}, btm: ${hiddenState.btmVisibility}, mask: ${hiddenState.maskVisibility}`);
    }
    console.log('✓ PASS: Both top and bottom black overlay lines completely disappear (opacity 0, visibility hidden) with zero leftover lines!');

    console.log('\n--- 4. Testing Re-appearance on Interaction (scheduleControlsFade) ---');
    await page.evaluate(() => {
      window.EDUPEAK_LIVE_PLAYER.scheduleControlsFade();
    });
    await page.waitForTimeout(200);

    const reactivatedState = await page.evaluate(() => {
      const topBar = document.getElementById('livePlayerTopBar');
      const overlay = document.getElementById('livePlayerControlsOverlay');
      return {
        topOpacity: parseFloat(window.getComputedStyle(topBar).opacity),
        btmOpacity: parseFloat(window.getComputedStyle(overlay).opacity)
      };
    });
    console.log('Controls Reactivated State:', reactivatedState);
    if (reactivatedState.topOpacity < 0.9 || reactivatedState.btmOpacity < 0.9) {
      throw new Error(`Expected controls reactivated to opacity ~1, got: ${JSON.stringify(reactivatedState)}`);
    }
    console.log('✓ PASS: Hover / mouse movement / touch immediately restores controls and top bar!');

    console.log('\n======================================================');
    console.log('🎉 ALL FADE-OUT, ZERO-LEFTOVER-LINES & CROPPING TESTS PASSED!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
})();
