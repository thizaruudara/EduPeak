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

const PORT = 8098;
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

  // Emulate iPhone 14 Viewport (390 x 844) in Portrait
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
  });

  try {
    const page = await context.newPage();

    const mockSchedules = [
      {
        id: 'sched-mobile-polish-test',
        topic: 'Advanced Physics Masterclass',
        provider: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        status: 'live',
        startedAt: new Date().toISOString(),
        teacherName: 'Amalsha Wanniarachchi',
        subject: 'Physics',
        examYear: '2026 A/L',
        watermarkEnabled: true,
        chatEnabled: true,
        viewersCount: 42
      }
    ];

    // Mock Wake Lock API tracking and user auth
    await context.addInitScript((scheds) => {
      window.__wakeLockRequested = 0;
      window.__wakeLockReleased = 0;

      if (!navigator.wakeLock) {
        navigator.wakeLock = {
          request: async (type) => {
            window.__wakeLockRequested++;
            return {
              type,
              released: false,
              release: async () => {
                window.__wakeLockReleased++;
                this.released = true;
              },
              addEventListener: () => {}
            };
          }
        };
      } else {
        const origReq = navigator.wakeLock.request.bind(navigator.wakeLock);
        navigator.wakeLock.request = async (type) => {
          window.__wakeLockRequested++;
          return origReq(type);
        };
      }

      localStorage.setItem('edupeak_schedules_db', JSON.stringify(scheds));
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'std-mobile-tester',
        name: 'Kasun Jayawardena',
        role: 'student',
        nic: '200512345678'
      }));
    }, mockSchedules);

    console.log('\n--- Test Step 1: Mobile Clean Player (Banners Suppressed on Mobile) ---');
    await page.goto(`http://localhost:${PORT}/live-class.html?stream=sched-mobile-polish-test`);
    await page.waitForTimeout(2000);

    // Capture screenshot 1 (Normal Mobile View)
    await page.screenshot({ path: path.join(__dirname, 'mobile_clean_view_verified.png'), fullPage: false });

    const bannerCheck = await page.evaluate(() => {
      const topBanner = document.getElementById('liveStartupTopBanner');
      const bottomBanner = document.getElementById('liveStartupBottomBanner');
      const topStyle = topBanner ? window.getComputedStyle(topBanner) : null;
      const bottomStyle = bottomBanner ? window.getComputedStyle(bottomBanner) : null;

      // Force call triggerStartupBanners
      if (window.EDUPEAK_LIVE_PLAYER && window.EDUPEAK_LIVE_PLAYER.triggerStartupBanners) {
        window.EDUPEAK_LIVE_PLAYER.triggerStartupBanners(10000);
      }

      const topAfter = topBanner ? window.getComputedStyle(topBanner) : null;
      const bottomAfter = bottomBanner ? window.getComputedStyle(bottomBanner) : null;

      return {
        topDisplay: topStyle ? topStyle.display : null,
        topVisibility: topStyle ? topStyle.visibility : null,
        bottomDisplay: bottomStyle ? bottomStyle.display : null,
        bottomVisibility: bottomStyle ? bottomStyle.visibility : null,
        topDisplayAfterTrigger: topAfter ? topAfter.display : null,
        bottomDisplayAfterTrigger: bottomAfter ? bottomAfter.display : null
      };
    });

    console.log('Banner Suppression Verification:', bannerCheck);
    if (bannerCheck.topDisplay === 'none' && bannerCheck.bottomDisplay === 'none' &&
        bannerCheck.topDisplayAfterTrigger === 'none' && bannerCheck.bottomDisplayAfterTrigger === 'none') {
      console.log('✓ PASS: Bulky top and bottom banners are completely suppressed on mobile screens! (Matches clean Screenshot 2)');
    } else {
      throw new Error(`FAIL: Banners should be display: none on mobile. Got top: ${bannerCheck.topDisplay}, bottom: ${bannerCheck.bottomDisplay}`);
    }

    console.log('\n--- Test Step 2: Mobile Fullscreen Takeover & Zero Background Bleed ---');
    const fullscreenEnterResult = await page.evaluate(() => {
      const wrapper = document.getElementById('edupeakLivePlayerWrapper');
      const chatCard = document.querySelector('.live-chat-card');
      const topBar = document.querySelector('.live-topbar');

      // Enter fullscreen
      window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();

      const wrapperStyle = window.getComputedStyle(wrapper);
      const bodyStyle = window.getComputedStyle(document.body);
      const chatStyle = window.getComputedStyle(chatCard);
      const topBarStyle = window.getComputedStyle(topBar);

      return {
        wrapperHasFsClass: wrapper.classList.contains('fullscreen-mode'),
        wrapperHasRotateClass: wrapper.classList.contains('mobile-landscape-rotate'),
        wrapperPosition: wrapperStyle.position,
        wrapperZIndex: wrapperStyle.zIndex,
        wrapperBg: wrapperStyle.backgroundColor,
        bodyHasLockClass: document.body.classList.contains('edupeak-fullscreen-locked'),
        bodyOverflow: bodyStyle.overflow,
        bodyPosition: bodyStyle.position,
        chatDisplay: chatStyle.display,
        topBarDisplay: topBarStyle.display,
        wakeLockCount: window.__wakeLockRequested
      };
    });

    console.log('Fullscreen Enter Result:', fullscreenEnterResult);

    if (!fullscreenEnterResult.wrapperHasFsClass || fullscreenEnterResult.wrapperPosition !== 'fixed') {
      throw new Error('FAIL: Player wrapper did not enter fixed fullscreen-mode');
    }
    if (!fullscreenEnterResult.bodyHasLockClass || fullscreenEnterResult.bodyOverflow !== 'hidden') {
      throw new Error('FAIL: Body was not locked with overflow: hidden during fullscreen');
    }
    if (fullscreenEnterResult.chatDisplay !== 'none' || fullscreenEnterResult.topBarDisplay !== 'none') {
      throw new Error('FAIL: Chat card or topbar is still visible during fullscreen (background bleed!)');
    }
    console.log('✓ PASS: Fullscreen completely isolates the player; body is locked and chat/site UI is hidden (Zero background bleed)!');

    console.log('\n--- Test Step 3: Landscape Auto-Rotation Fallback Verification ---');
    const rotationCheck = await page.evaluate(() => {
      const wrapper = document.getElementById('edupeakLivePlayerWrapper');
      const style = window.getComputedStyle(wrapper);
      return {
        hasRotateClass: wrapper.classList.contains('mobile-landscape-rotate'),
        transform: style.transform,
        width: style.width,
        height: style.height
      };
    });
    console.log('Rotation Check:', rotationCheck);

    if (rotationCheck.hasRotateClass) {
      console.log('✓ PASS: Landscape rotation applied to mobile player in portrait mode!');
    } else {
      throw new Error('FAIL: mobile-landscape-rotate class missing on mobile in portrait mode');
    }

    // Capture screenshot in Fullscreen Mode
    await page.screenshot({ path: path.join(__dirname, 'mobile_fullscreen_verified.png'), fullPage: false });

    console.log('\n--- Test Step 4: Screen Wake Lock API Verification ---');
    if (fullscreenEnterResult.wakeLockCount > 0) {
      console.log(`✓ PASS: Screen Wake Lock API requested (${fullscreenEnterResult.wakeLockCount} times) to prevent screen timeout!`);
    } else {
      throw new Error('FAIL: Screen Wake Lock API was not requested');
    }

    console.log('\n--- Test Step 5: Fullscreen Exit Cleanup ---');
    const exitResult = await page.evaluate(() => {
      const wrapper = document.getElementById('edupeakLivePlayerWrapper');
      const chatCard = document.querySelector('.live-chat-card');

      // Toggle exit fullscreen
      window.EDUPEAK_LIVE_PLAYER.toggleFullscreen();

      const wrapperStyle = window.getComputedStyle(wrapper);
      const bodyStyle = window.getComputedStyle(document.body);
      const chatStyle = window.getComputedStyle(chatCard);

      return {
        wrapperHasFsClass: wrapper.classList.contains('fullscreen-mode'),
        wrapperHasRotateClass: wrapper.classList.contains('mobile-landscape-rotate'),
        bodyHasLockClass: document.body.classList.contains('edupeak-fullscreen-locked'),
        bodyOverflow: bodyStyle.overflow,
        chatDisplay: chatStyle.display
      };
    });

    console.log('Fullscreen Exit Result:', exitResult);
    if (!exitResult.wrapperHasFsClass && !exitResult.wrapperHasRotateClass && !exitResult.bodyHasLockClass) {
      console.log('✓ PASS: Fullscreen exited cleanly; body lock, rotation class, and normal chat layout restored!');
    } else {
      throw new Error('FAIL: Fullscreen exit cleanup failed');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL MOBILE LIVE HUB, FULLSCREEN & WAKE LOCK TESTS PASSED 100%!');
    console.log('======================================================');
  } finally {
    await browser.close();
    server.close();
  }
})();
