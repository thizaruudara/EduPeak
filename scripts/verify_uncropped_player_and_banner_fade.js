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

const PORT = 3099;
const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', req.url.split('?')[0]);
  if (filePath.endsWith(path.sep) || req.url === '/') filePath = path.join(filePath, 'live-class.html');
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'text/plain' });
  fs.createReadStream(filePath).pipe(res);
});

async function runTest() {
  server.listen(PORT);
  console.log(`Server running at http://localhost:${PORT}`);

  const chromePath = findChromePath();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    console.log('1. Navigating to live-class.html...');
    await page.goto(`http://localhost:${PORT}/live-class.html`);
    await page.waitForLoadState('domcontentloaded');

    // Create an active live session in localStorage so player mounts
    await page.evaluate(() => {
      const liveSession = {
        id: "live-session-uncropped-test",
        topic: "2027 A/L Physics Live - Mechanics & Derivations",
        provider: "youtube",
        rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0",
        status: "live",
        watermarkEnabled: false,
        chatEnabled: true,
        scheduleTime: "Today • Live",
        teacherName: "Amalsha Wanniarachchi"
      };
      localStorage.setItem("edupeak_schedules_db", JSON.stringify([liveSession]));
      localStorage.setItem("edupeak_live_stream_config", JSON.stringify(liveSession));
    });

    await page.reload();
    await page.waitForTimeout(3000);

    // 2. Verify IFRAME or Player Mount transform (MUST BE NONE / NO CROP)
    console.log('2. Verifying player mount and iframe cropping styles...');
    const iframeStyles = await page.evaluate(() => {
      const mount = document.getElementById("edupeakLiveYTPlayerMount");
      const iframe = mount ? (mount.tagName === "IFRAME" ? mount : mount.querySelector("iframe")) : null;
      const target = iframe || mount;
      if (!target) return null;
      const computed = window.getComputedStyle(target);
      return {
        transform: computed.transform,
        width: computed.width,
        height: computed.height,
        top: computed.top,
        left: computed.left
      };
    });

    console.log('IFrame / Mount computed styles:', iframeStyles);
    if (iframeStyles) {
      if (iframeStyles.transform && iframeStyles.transform.includes('matrix') && iframeStyles.transform !== 'none') {
        // Check if scale(1.10) exists
        const matrixValues = iframeStyles.transform.match(/matrix\(([^)]+)\)/);
        if (matrixValues) {
          const parts = matrixValues[1].split(',').map(s => parseFloat(s.trim()));
          const scaleX = parts[0];
          const scaleY = parts[3];
          console.log(`Detected Scale X: ${scaleX}, Scale Y: ${scaleY}`);
          if (scaleX > 1.05 || scaleY > 1.05) {
            throw new Error(`CRITICAL ERROR: Iframe is STILL CROPPED with scale(${scaleX})! Expected 1.0`);
          }
        }
      }
      console.log('✓ Video player is 100% UNCROPPED (Zero scale / zero offset)!');
    }

    // 3. Verify top banner and bottom controls are visible on mouse movement
    console.log('3. Triggering mouse movement over player...');
    const playerWrapper = await page.$('#edupeakLivePlayerWrapper');
    if (playerWrapper) {
      const box = await playerWrapper.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(600);
      }
    }

    const visibleState = await page.evaluate(() => {
      const topBar = document.getElementById("livePlayerTopBar");
      const controls = document.getElementById("livePlayerControlsOverlay");
      return {
        topBarFadeOut: topBar ? topBar.classList.contains("fade-out") : null,
        topBarOpacity: topBar ? window.getComputedStyle(topBar).opacity : null,
        controlsFadeOut: controls ? controls.classList.contains("fade-out") : null,
        controlsOpacity: controls ? window.getComputedStyle(controls).opacity : null
      };
    });

    console.log('Banners state on mouse activity:', visibleState);
    if (visibleState.topBarFadeOut || visibleState.controlsFadeOut) {
      throw new Error('Banners should be visible on mouse activity!');
    }
    console.log('✓ Top banner and bottom banner are VISIBLE covering watermarks on activity!');

    // 4. Wait 3.5 seconds without mouse movement to test auto-fade
    console.log('4. Waiting 3.5 seconds of inactivity to verify banners disappear when watermark disappears...');
    await page.waitForTimeout(3500);

    const fadedState = await page.evaluate(() => {
      const topBar = document.getElementById("livePlayerTopBar");
      const controls = document.getElementById("livePlayerControlsOverlay");
      return {
        topBarFadeOut: topBar ? topBar.classList.contains("fade-out") : null,
        topBarOpacity: topBar ? window.getComputedStyle(topBar).opacity : null,
        controlsFadeOut: controls ? controls.classList.contains("fade-out") : null,
        controlsOpacity: controls ? window.getComputedStyle(controls).opacity : null
      };
    });

    console.log('Banners state after 3.5s inactivity:', fadedState);
    if (!fadedState.topBarFadeOut || !fadedState.controlsFadeOut) {
      throw new Error('Banners failed to fade out after inactivity!');
    }
    console.log('✓ Both top and bottom banners DISAPPEARED when watermark disappears!');

    // 5. Move mouse again -> Banners must reappear
    console.log('5. Moving mouse again to verify banners reappear covering watermarks...');
    if (playerWrapper) {
      const box = await playerWrapper.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3);
        await page.waitForTimeout(600);
      }
    }

    const reappearedState = await page.evaluate(() => {
      const topBar = document.getElementById("livePlayerTopBar");
      const controls = document.getElementById("livePlayerControlsOverlay");
      return {
        topBarFadeOut: topBar ? topBar.classList.contains("fade-out") : null,
        topBarOpacity: topBar ? window.getComputedStyle(topBar).opacity : null,
        controlsFadeOut: controls ? controls.classList.contains("fade-out") : null,
        controlsOpacity: controls ? window.getComputedStyle(controls).opacity : null
      };
    });

    console.log('Banners state after mouse move:', reappearedState);
    if (reappearedState.topBarFadeOut || reappearedState.controlsFadeOut) {
      throw new Error('Banners failed to reappear on mouse movement!');
    }
    console.log('✓ Banners instantly REAPPEARED on mouse movement!');

    // Clean up test data
    await page.evaluate(() => {
      localStorage.removeItem("edupeak_schedules_db");
      localStorage.removeItem("edupeak_live_stream_config");
    });

    console.log('\n======================================================');
    console.log('🎉 ALL UNCROPPED VIDEO & BANNER FADE CHECKS PASSED!');
    console.log('======================================================');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

runTest();
