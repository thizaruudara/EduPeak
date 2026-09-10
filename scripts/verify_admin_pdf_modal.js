const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5123;
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

    server.listen(PORT, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function findChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return possiblePaths.find((p) => p && fs.existsSync(p));
}

(async () => {
  console.log("🚀 Verifying Admin PDF Viewer Modal Hidden State...");
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const adminUrl = `http://127.0.0.1:${PORT}/admin.html`;

  try {
    await page.goto(adminUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const isHiddenByDefault = await page.evaluate(() => {
      const modal = document.getElementById("adminPdfViewerModal");
      if (!modal) return false;
      const style = window.getComputedStyle(modal);
      return style.opacity === "0" && style.pointerEvents === "none" && style.position === "fixed";
    });

    console.log("Is Admin PDF Modal properly hidden by default?", isHiddenByDefault);
    if (!isHiddenByDefault) {
      throw new Error("Admin PDF Modal is NOT hidden by default!");
    }

    await page.evaluate(() => {
      const modal = document.getElementById("adminPdfViewerModal");
      modal.classList.add("active");
    });
    await page.waitForTimeout(350);

    const opensCorrectly = await page.evaluate(() => {
      const modal = document.getElementById("adminPdfViewerModal");
      const style = window.getComputedStyle(modal);
      return {
        opacity: style.opacity,
        pointerEvents: style.pointerEvents,
        position: style.position,
        ok: style.opacity === "1" && style.pointerEvents === "auto" && style.position === "fixed"
      };
    });

    console.log("Does Admin PDF Modal show as fixed overlay when active?", opensCorrectly);
    if (!opensCorrectly.ok) {
      throw new Error(`Admin PDF Modal does NOT open as active overlay! Got: ${JSON.stringify(opensCorrectly)}`);
    }

    console.log("🎉 SUCCESS: Admin PDF Modal is cleanly hidden and styled as fixed overlay!");
  } finally {
    await browser.close();
    server.close();
  }
})();
