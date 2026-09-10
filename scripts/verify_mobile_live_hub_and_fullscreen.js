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

const PORT = 8096;
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
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  // Test iPhone 13 / 14 Viewport (390 x 844)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });

  try {
    console.log('\n--- 1. Testing Mobile Layout Ordering & UI ---');
    const page = await context.newPage();

    const mockSchedules = [
      {
        id: 'sched-mobile-test',
        topic: 'Physics Masterclass - Mobile UI Test',
        provider: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        status: 'live',
        startedAt: new Date().toISOString(),
        teacherName: 'Amalsha Wanniarachchi',
        subject: 'Physics',
        examYear: '2027 A/L',
        watermarkEnabled: true,
        chatEnabled: true,
        viewersCount: 25
      }
    ];

    await context.addInitScript((scheds) => {
      localStorage.setItem('edupeak_schedules_db', JSON.stringify(scheds));
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'std-mobile-1',
        name: 'Student Mobile',
        role: 'student',
        nic: '200512345678'
      }));
    }, mockSchedules);

    await page.goto(`http://localhost:${PORT}/live-class.html?stream=sched-mobile-test`);
    await page.waitForTimeout(1500);

    // Verify order on mobile: Video stage (.live-theater-grid) must appear BEFORE .multi-live-hub-header
    const layoutPositions = await page.evaluate(() => {
      const theater = document.querySelector('.live-theater-grid');
      const hubHeader = document.querySelector('.multi-live-hub-header');
      const videoBox = theater ? theater.getBoundingClientRect() : null;
      const headerBox = hubHeader ? hubHeader.getBoundingClientRect() : null;
      return {
        videoTop: videoBox ? videoBox.top : null,
        headerTop: headerBox ? headerBox.top : null,
        hasBroadcastBug: Boolean(document.getElementById('livePlayerBroadcastBug')),
        hasUnmuteBtn: Boolean(document.getElementById('liveUnmutePromptBtn'))
      };
    });

    console.log('Mobile Layout Positions:', layoutPositions);
    if (layoutPositions.videoTop < layoutPositions.headerTop) {
      console.log('✓ PASS: Video player is positioned ABOVE other streams on mobile!');
    } else {
      throw new Error(`FAIL: Video player top (${layoutPositions.videoTop}) should be above hub header (${layoutPositions.headerTop})`);
    }

    if (layoutPositions.hasBroadcastBug) {
      console.log('✓ PASS: Studio Broadcast Bug is present in viewport to mask YouTube watermark cleanly!');
    } else {
      throw new Error('FAIL: Broadcast Bug not found in DOM');
    }

    console.log('\n--- 2. Testing Mobile Fullscreen Toggle ---');
    const fsTestResult = await page.evaluate(() => {
      const wrapper = document.getElementById('edupeakLivePlayerWrapper');
      if (!wrapper) return { success: false, reason: 'Wrapper not found' };
      // Call toggleFullscreen
      window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();
      const isFullscreenMode = wrapper.classList.contains('fullscreen-mode');
      const style = window.getComputedStyle(wrapper);
      const isFixed = style.position === 'fixed';
      const zIndex = style.zIndex;

      // Toggle off
      window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();
      const isExited = !wrapper.classList.contains('fullscreen-mode');

      return {
        success: isFullscreenMode && isFixed && isExited,
        isFullscreenMode,
        isFixed,
        zIndex,
        isExited
      };
    });

    console.log('Mobile Fullscreen Test:', fsTestResult);
    if (fsTestResult.success) {
      console.log('✓ PASS: Fullscreen toggle cleanly enters and exits mobile fixed breakout!');
    } else {
      throw new Error('FAIL: Fullscreen toggle failed: ' + JSON.stringify(fsTestResult));
    }

    console.log('\n======================================================');
    console.log('🎉 ALL MOBILE UI & FULLSCREEN TESTS PASSED 100%!');
    console.log('======================================================');
  } finally {
    await browser.close();
    server.close();
  }
})();
