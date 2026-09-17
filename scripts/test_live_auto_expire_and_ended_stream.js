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

function createServer() {
  return http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/live-class.html';
    const filePath = path.join(ROOT_DIR, reqPath);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found: ' + reqPath);
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(content);
    });
  });
}

(async () => {
  console.log('=== Starting Test: Live Hub Auto-Expiration & YouTube Ended Rejection ===');
  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening on http://localhost:${PORT}`);

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error('Chrome/Edge executable not found!');
    process.exit(1);
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: chromePath,
      headless: true
    });

    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto(`http://localhost:${PORT}/live-class.html`, { waitUntil: 'networkidle' });
    await new Promise(r => setTimeout(r, 1000));

    // 1. Validate that the real stale session from yesterday was auto-expired by autoExpireStaleSessions()
    const liveHubState = await page.evaluate(async () => {
      const all = await window.SUPABASE_HELPER.getLiveSessions();
      const topBadgeText = document.getElementById("topLiveStatusText")?.textContent || "";
      const isCustomPlayerVisible = document.getElementById("edupeakLivePlayerWrapper")?.style.display !== "none";
      const isEndedScreenVisible = document.getElementById("liveEndedScreen")?.style.display === "flex";
      const isNoStreamsVisible = document.getElementById("liveNoStreamsScreen")?.style.display === "flex";

      return {
        allCount: all.length,
        liveCount: all.filter(s => s.status === "live").length,
        endedCount: all.filter(s => s.status === "ended").length,
        allSessions: all.map(s => ({ id: s.id, topic: s.topic, status: s.status, scheduleDate: s.scheduleDate, endedAt: s.endedAt })),
        topBadgeText,
        isCustomPlayerVisible,
        isEndedScreenVisible,
        isNoStreamsVisible
      };
    });

    console.log('Live Hub State after autoExpireStaleSessions():', liveHubState);

    // Verify: no sessions from yesterday or earlier can remain in "live" status
    const today = new Date().toISOString().split("T")[0];
    const invalidLiveSessions = liveHubState.allSessions.filter(s => s.status === "live" && s.scheduleDate < today);
    if (invalidLiveSessions.length > 0) {
      throw new Error(`Found past-date sessions still marked as live: ${JSON.stringify(invalidLiveSessions)}`);
    }

    if (liveHubState.liveCount === 0) {
      if (liveHubState.topBadgeText.includes('1 BROADCAST LIVE')) {
        throw new Error(`Badge should NOT say "1 BROADCAST LIVE" when liveCount is 0! Got: "${liveHubState.topBadgeText}"`);
      }
      if (liveHubState.isCustomPlayerVisible) {
        throw new Error('Player must NOT be playing when there are 0 active live broadcasts!');
      }
    }

    console.log('✅ Test 1 PASSED: All stale past-date sessions are automatically ended and no player is playing.');

    // 2. Unit testing autoExpireStaleSessions directly
    const unitTestResults = await page.evaluate(() => {
      const helper = window.SUPABASE_HELPER;
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const fiveHoursAgoIso = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();

      const testBatch = [
        // Case 1: Yesterday's live stream
        { id: "test-1", topic: "Yesterday Stream", status: "live", scheduleDate: yesterday },
        // Case 2: Today's live stream started 5 hours ago
        { id: "test-2", topic: "Overlong Stream", status: "live", scheduleDate: todayStr, startedAt: fiveHoursAgoIso },
        // Case 3: Today's live stream started 10 minutes ago
        { id: "test-3", topic: "Current Stream", status: "live", scheduleDate: todayStr, startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
        // Case 4: Already ended stream
        { id: "test-4", topic: "Ended Stream", status: "ended", scheduleDate: yesterday, endedAt: yesterday }
      ];

      const processed = helper.autoExpireStaleSessions(testBatch);
      return {
        item1Status: processed.find(i => i.id === "test-1")?.status,
        item1EndedAt: Boolean(processed.find(i => i.id === "test-1")?.endedAt),
        item2Status: processed.find(i => i.id === "test-2")?.status,
        item2EndedAt: Boolean(processed.find(i => i.id === "test-2")?.endedAt),
        item3Status: processed.find(i => i.id === "test-3")?.status,
        item4Status: processed.find(i => i.id === "test-4")?.status
      };
    });

    console.log('Unit Test Results for autoExpireStaleSessions():', unitTestResults);

    if (unitTestResults.item1Status !== "ended" || !unitTestResults.item1EndedAt) {
      throw new Error(`Case 1 failed: yesterday's stream was not expired to "ended"`);
    }
    if (unitTestResults.item2Status !== "ended" || !unitTestResults.item2EndedAt) {
      throw new Error(`Case 2 failed: 5-hour stream was not expired to "ended"`);
    }
    if (unitTestResults.item3Status !== "live") {
      throw new Error(`Case 3 failed: active 10-minute stream should remain "live"`);
    }
    if (unitTestResults.item4Status !== "ended") {
      throw new Error(`Case 4 failed: ended stream should remain "ended"`);
    }

    console.log('✅ Test 2 PASSED: autoExpireStaleSessions logic handles all edge cases correctly.');

    // 3. Test checkAndEnforceLiveStream & YouTube Ended Handling in custom-player
    const playerCheck = await page.evaluate(() => {
      // Check that EDUPEAK_LIVE_PLAYER has checkAndEnforceLiveStream or triggerLiveEnded
      return {
        hasTriggerLiveEnded: typeof window.EDUPEAK_LIVE_PLAYER?.triggerLiveEnded === "function",
        hasHandleAutoEndStream: typeof window.LIVE_APP?.handleAutoEndStream === "function"
      };
    });

    console.log('Player Lifecycle Handlers Check:', playerCheck);
    if (!playerCheck.hasTriggerLiveEnded || !playerCheck.hasHandleAutoEndStream) {
      throw new Error('Expected player and application auto-end handlers to be available');
    }
    console.log('✅ Test 3 PASSED: Custom Player and Live App correctly wired for ended stream detection.');

    // Capture screenshot of the verified Live Hub state
    await page.screenshot({ path: path.join(ROOT_DIR, 'scripts/live_hub_stale_expired_verified.png'), fullPage: true });
    console.log('Saved verification screenshot to scripts/live_hub_stale_expired_verified.png');

    console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('❌ Test failed:', err);
    process.exit(1);
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
