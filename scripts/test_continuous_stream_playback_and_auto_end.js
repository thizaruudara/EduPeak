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

// Simple static local HTTP server
const PORT = 8094;
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
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const context = await browser.newContext();

  try {
    console.log('\n--- 1. Testing Continuous Playback Time Offset on Reload ---');
    const page = await context.newPage();

    // Prepare mock session: Started 150 seconds ago with unique ID per run
    const testSessionId = 'sched-play-' + Date.now();
    const startedAtTime = new Date(Date.now() - 150 * 1000).toISOString();

    const mockSchedules = [
      {
        id: testSessionId,
        topic: 'Continuous Playback Physics Masterclass',
        provider: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        status: 'live',
        startedAt: startedAtTime,
        scheduleDate: '2026-09-10',
        scheduleStartTime: '08:00',
        scheduleEndTime: '10:00',
        scheduleTime: 'Today • 08:00 AM - 10:00 AM',
        teacherName: 'Dr. K. Perera',
        subject: 'Physics',
        examYear: '2026 A/L',
        watermarkEnabled: true,
        chatEnabled: true,
        viewersCount: 350
      }
    ];

    await context.addInitScript((scheds) => {
      localStorage.setItem('edupeak_schedules_db', JSON.stringify(scheds));
      localStorage.setItem('edupeak_live_stream_config', JSON.stringify(scheds[0]));
      localStorage.setItem('edupeak_last_active_stream', scheds[0].id);
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'std-test-user-1',
        name: 'Kasun Bandara',
        role: 'student',
        nic: '200512345678'
      }));

      const checkHelper = setInterval(() => {
        if (window.SUPABASE_HELPER) {
          window.SUPABASE_HELPER.getLiveSessions = async () => {
            try { return JSON.parse(localStorage.getItem('edupeak_schedules_db') || '[]'); } catch(e) { return scheds; }
          };
          clearInterval(checkHelper);
        }
      }, 20);
    }, mockSchedules);

    await page.goto(`http://localhost:${PORT}/live-class.html?stream=${testSessionId}`);
    await page.waitForTimeout(1000);

    const elapsedOnFirstLoad = await page.evaluate(() => {
      return window.EDUPEAK_LIVE_PLAYER ? window.EDUPEAK_LIVE_PLAYER.getElapsedSeconds() : -1;
    });

    console.log(`Initial elapsed seconds calculated: ${elapsedOnFirstLoad}s (Expected ~150s)`);
    if (elapsedOnFirstLoad >= 148 && elapsedOnFirstLoad <= 155) {
      console.log('✓ PASS: Initial elapsed offset correctly computed from startedAt timestamp!');
    } else {
      throw new Error(`FAIL: Expected ~150s, got ${elapsedOnFirstLoad}s`);
    }

    // Wait 3 seconds and reload the page
    console.log('Waiting 3 seconds and reloading page to test continuous playback persistence...');
    await page.waitForTimeout(3000);
    await page.reload();
    // Wait for page scripts and session to finish loading after reload
    await page.waitForFunction(() => {
      return window.LIVE_APP && window.LIVE_APP.activeSession && window.EDUPEAK_LIVE_PLAYER && window.EDUPEAK_LIVE_PLAYER.getElapsedSeconds() > 0;
    }, { timeout: 6000 }).catch(() => {});

    const debugInfo = await page.evaluate(() => {
      return {
        activeId: window.LIVE_APP ? window.LIVE_APP.activeSessionId : null,
        activeSession: window.LIVE_APP ? window.LIVE_APP.activeSession : null,
        elapsed: window.EDUPEAK_LIVE_PLAYER ? window.EDUPEAK_LIVE_PLAYER.getElapsedSeconds() : -1
      };
    });
    console.log("Debug info after reload:", JSON.stringify(debugInfo));

    const elapsedAfterReload = debugInfo.elapsed;

    console.log(`Elapsed seconds after reload: ${elapsedAfterReload}s (Expected ~154s)`);
    if (elapsedAfterReload >= 152 && elapsedAfterReload > elapsedOnFirstLoad) {
      console.log('✓ PASS: Video playback continues smoothly across reload without restarting at 00:00!');
    } else {
      throw new Error(`FAIL: Video reset or did not advance continuously after reload: ${elapsedAfterReload}s vs ${elapsedOnFirstLoad}s`);
    }

    console.log('\n--- 2. Testing Automatic Live Stream Conclusion on Video Ended ---');
    // Open a second tab (student 2)
    const studentPage = await context.newPage();
    await studentPage.goto(`http://localhost:${PORT}/live-class.html?stream=${testSessionId}`);
    await studentPage.waitForTimeout(800);

    // Verify initial active player state
    const isPlayerVisible = await page.evaluate(() => {
      const p = document.getElementById('edupeakLivePlayerWrapper');
      return p && p.style.display !== 'none';
    });
    console.log(`Player visible before end: ${isPlayerVisible}`);
    if (!isPlayerVisible) throw new Error('FAIL: Player should be visible when live');

    // Trigger video completion on page 1 (simulating YouTube onStateChange ENDED or duration finished)
    console.log('Simulating video completion (YT.PlayerState.ENDED)...');
    const trigDebug = await page.evaluate(() => {
      let playerHasTrigger = !!(window.EDUPEAK_LIVE_PLAYER && window.EDUPEAK_LIVE_PLAYER.triggerLiveEnded);
      let appHasAutoEnd = !!(window.LIVE_APP && typeof window.LIVE_APP.handleAutoEndStream === "function");
      let currentActiveId = window.LIVE_APP ? window.LIVE_APP.activeSessionId : null;
      let curStatusBefore = window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : null;
      
      if (window.EDUPEAK_LIVE_PLAYER && window.EDUPEAK_LIVE_PLAYER.triggerLiveEnded) {
        window.EDUPEAK_LIVE_PLAYER.triggerLiveEnded();
      }
      return { playerHasTrigger, appHasAutoEnd, currentActiveId, curStatusBefore };
    });
    console.log("Trigger debug:", JSON.stringify(trigDebug));

    await page.waitForTimeout(1200);

    // Verify page 1 transitioned to concluded state
    const statusOnPage1 = await page.evaluate(() => {
      return window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : '';
    });
    const endedScreenOnPage1 = await page.evaluate(() => {
      const s = document.getElementById('liveEndedScreen');
      return s && s.style.display === 'flex';
    });

    console.log(`Page 1 session status: "${statusOnPage1}" (Expected "ended")`);
    console.log(`Page 1 liveEndedScreen visible: ${endedScreenOnPage1}`);

    if (statusOnPage1 === 'ended' && endedScreenOnPage1) {
      console.log('✓ PASS: Live stream automatically concluded and switched to ended screen on broadcaster/player tab!');
    } else {
      throw new Error(`FAIL: Page 1 did not transition to ended state: status=${statusOnPage1}, endedScreen=${endedScreenOnPage1}`);
    }

    // Verify studentPage (tab 2) also received the update and transitioned to concluded screen
    await studentPage.waitForTimeout(1000);
    const statusOnPage2 = await studentPage.evaluate(() => {
      return window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : '';
    });
    const endedScreenOnPage2 = await studentPage.evaluate(() => {
      const s = document.getElementById('liveEndedScreen');
      return s && s.style.display === 'flex';
    });

    console.log(`Student tab session status: "${statusOnPage2}" (Expected "ended")`);
    console.log(`Student tab liveEndedScreen visible: ${endedScreenOnPage2}`);

    if (statusOnPage2 === 'ended' && endedScreenOnPage2) {
      console.log('✓ PASS: Student tab synchronized automatically and displayed ended screen in real-time!');
    } else {
      throw new Error(`FAIL: Student tab did not automatically update to ended state: status=${statusOnPage2}, endedScreen=${endedScreenOnPage2}`);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL CONTINUOUS PLAYBACK & AUTO-END TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
})();
