const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5099;
const BASE_DIR = path.resolve(__dirname, '..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      const filePath = path.join(BASE_DIR, reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const actualPort = server.address().port;
      resolve({ server, port: actualPort });
    });
  });
}

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

async function runTests() {
  console.log("=== VERIFYING LIVE STANDBY & SCHEDULED STATES IN REAL BROWSER ===");
  const { server, port } = await startServer();
  const executablePath = findChromePath();

  const browser = await chromium.launch({
    executablePath,
    headless: true
  });

  const page = await browser.newPage();

  try {
    // 1. Load index.html with NO live broadcast scheduled (or concluded)
    await page.goto(`http://127.0.0.1:${port}/index.html`);

    await page.evaluate(() => {
      localStorage.setItem("edupeak_user", JSON.stringify({
        id: "stu_test_1",
        name: "Kasun Jayasundara",
        nic: "200512345678",
        role: "student",
        batch: "2027 A/L"
      }));

      localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
        topic: "No Live Broadcast Scheduled",
        provider: "youtube",
        rawUrl: "",
        embedUrl: "about:blank",
        status: "ended",
        scheduleTime: "",
        updatedAt: new Date().toISOString()
      }));

      // Open LMS modal and switch to Live tab
      if (typeof openEduPeakLmsPlayer === "function") {
        openEduPeakLmsPlayer();
      }
      if (typeof switchLmsTab === "function") {
        switchLmsTab("live-room");
      }
    });

    await page.waitForTimeout(600);

    const standbyVisibility = await page.evaluate(() => {
      const standby = document.getElementById("edupeakLiveStandbyWrapper");
      const player = document.getElementById("edupeakLivePlayerWrapper");
      const zoom = document.getElementById("lmsLiveZoomBtn");
      const title = document.getElementById("lmsLiveTopicTitle")?.textContent;
      const status = document.getElementById("lmsLiveStatusText")?.textContent;
      const badge = document.getElementById("lmsLiveBadgePill")?.textContent;
      const chatInput = document.getElementById("liveChatInputField");

      return {
        standbyDisplay: standby ? window.getComputedStyle(standby).display : 'missing',
        playerDisplay: player ? window.getComputedStyle(player).display : 'missing',
        zoomDisplay: zoom ? window.getComputedStyle(zoom).display : 'missing',
        title,
        status,
        badge,
        chatDisabled: chatInput ? chatInput.disabled : false,
        chatPlaceholder: chatInput ? chatInput.placeholder : ''
      };
    });

    console.log("\n[State 1: Standby / No Live Broadcast]");
    console.log("Standby Display:", standbyVisibility.standbyDisplay);
    console.log("Player Display:", standbyVisibility.playerDisplay);
    console.log("Zoom Button Display:", standbyVisibility.zoomDisplay);
    console.log("Title:", standbyVisibility.title);
    console.log("Status:", standbyVisibility.status);
    console.log("Chat Disabled:", standbyVisibility.chatDisabled);

    if (standbyVisibility.standbyDisplay === 'flex' && standbyVisibility.playerDisplay === 'none') {
      console.log("✅ PASS: Standby card is displayed and fake black player is hidden!");
    } else {
      throw new Error(`Standby display failure: standby=${standbyVisibility.standbyDisplay}, player=${standbyVisibility.playerDisplay}`);
    }

    if (standbyVisibility.zoomDisplay === 'none') {
      console.log("✅ PASS: Zoom room button is hidden when no live broadcast is scheduled!");
    } else {
      throw new Error(`Zoom button is visible: ${standbyVisibility.zoomDisplay}`);
    }

    // 2. Scheduled State
    await page.evaluate(() => {
      localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
        topic: "2027 A/L Physics - Mechanics Mastery Lecture",
        provider: "youtube",
        rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        status: "scheduled",
        scheduleTime: "Sunday 8:30 AM",
        teacherName: "Amalsha Wanniarachchi",
        updatedAt: new Date().toISOString()
      }));

      syncLiveStreamWithTeacher();
    });

    await page.waitForTimeout(300);

    const scheduledVisibility = await page.evaluate(() => {
      const standby = document.getElementById("edupeakLiveStandbyWrapper");
      const player = document.getElementById("edupeakLivePlayerWrapper");
      const title = document.getElementById("liveStandbyTitle")?.textContent;
      const desc = document.getElementById("liveStandbyDesc")?.textContent;
      return {
        standbyDisplay: standby ? window.getComputedStyle(standby).display : 'missing',
        playerDisplay: player ? window.getComputedStyle(player).display : 'missing',
        title,
        desc
      };
    });

    console.log("\n[State 2: Scheduled Class]");
    console.log("Standby Display:", scheduledVisibility.standbyDisplay);
    console.log("Player Display:", scheduledVisibility.playerDisplay);
    console.log("Title:", scheduledVisibility.title);
    console.log("Desc:", scheduledVisibility.desc);

    if (scheduledVisibility.standbyDisplay === 'flex' && scheduledVisibility.playerDisplay === 'none' && scheduledVisibility.desc.includes("Sunday 8:30 AM")) {
      console.log("✅ PASS: Scheduled card shows time 'Sunday 8:30 AM' and player is hidden!");
    } else {
      throw new Error("Scheduled state verification failed");
    }

    // 3. Live State
    await page.evaluate(() => {
      localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
        topic: "2027 A/L Physics - Live Now",
        provider: "zoom",
        rawUrl: "https://zoom.us/j/99887766",
        zoomUrl: "https://zoom.us/j/99887766",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        status: "live",
        watermarkEnabled: true,
        updatedAt: new Date().toISOString()
      }));

      syncLiveStreamWithTeacher();
    });

    await page.waitForTimeout(300);

    const liveVisibility = await page.evaluate(() => {
      const standby = document.getElementById("edupeakLiveStandbyWrapper");
      const player = document.getElementById("edupeakLivePlayerWrapper");
      const zoom = document.getElementById("lmsLiveZoomBtn");
      return {
        standbyDisplay: standby ? window.getComputedStyle(standby).display : 'missing',
        playerDisplay: player ? window.getComputedStyle(player).display : 'missing',
        zoomDisplay: zoom ? window.getComputedStyle(zoom).display : 'missing',
        zoomHref: zoom ? zoom.getAttribute('href') : ''
      };
    });

    console.log("\n[State 3: Live Broadcast Active]");
    console.log("Standby Display:", liveVisibility.standbyDisplay);
    console.log("Player Display:", liveVisibility.playerDisplay);
    console.log("Zoom Display:", liveVisibility.zoomDisplay);
    console.log("Zoom Href:", liveVisibility.zoomHref);

    if (liveVisibility.playerDisplay === 'block' && liveVisibility.standbyDisplay === 'none') {
      console.log("✅ PASS: Video player is visible and standby card is hidden during live stream!");
    } else {
      throw new Error("Live state verification failed");
    }

    if ((liveVisibility.zoomDisplay === 'inline-flex' || liveVisibility.zoomDisplay === 'flex') && liveVisibility.zoomHref.includes('zoom.us')) {
      console.log("✅ PASS: Zoom button is visible with proper Zoom URL during Zoom live session!");
    } else {
      throw new Error("Zoom button not shown or incorrect href: " + liveVisibility.zoomDisplay);
    }

    console.log("\n🎉 ALL 3 LIVE STREAM STATES VERIFIED ACCURATELY IN REAL BROWSER!");

  } finally {
    await browser.close();
    server.close();
  }
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
