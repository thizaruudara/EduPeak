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
  console.log("🚀 Starting Student Roster Synchronization Verification...");
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const adminUrl = `http://127.0.0.1:${PORT}/admin.html`;
  const teacherUrl = `http://127.0.0.1:${PORT}/teacher-portal.html`;

  try {
    // 1. Check Admin Panel
    console.log(`1. Navigating to Admin Panel: ${adminUrl}`);
    await page.goto(adminUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const adminStudentRows = await page.evaluate(() => {
      // Switch to students tab in admin
      if (window.ADMIN_CONTROLLER) {
        window.ADMIN_CONTROLLER.switchTab("students");
      }
      const rows = document.querySelectorAll("#adminStudentsTbody tr");
      const countLabel = document.getElementById("adminStudentsCountLabel")?.innerText;
      const studentIds = Array.from(rows).map(r => r.querySelector("td strong")?.innerText).filter(Boolean);
      return {
        count: studentIds.length,
        countLabel,
        studentIds
      };
    });

    console.log("Admin Panel Students:", adminStudentRows);

    // 2. Check Teacher Portal
    console.log(`2. Navigating to Teacher Portal: ${teacherUrl}`);
    await page.goto(teacherUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const teacherStudentRows = await page.evaluate(() => {
      if (window.TEACHER_CONTROLLER) {
        window.TEACHER_CONTROLLER.switchTab("students");
      }
      const rows = document.querySelectorAll("#teacherStudentsTbody tr");
      const countLabel = document.getElementById("teacherStudentsCountLabel")?.innerText;
      const studentIds = Array.from(rows).map(r => r.querySelector("td strong")?.innerText).filter(Boolean);
      return {
        count: studentIds.length,
        countLabel,
        studentIds
      };
    });

    console.log("Teacher Portal Students:", teacherStudentRows);

    console.log("\n==========================================");
    console.log("COMPARISON RESULTS");
    console.log("==========================================");
    console.log(`Admin Panel Count:   ${adminStudentRows.count}`);
    console.log(`Teacher Portal Count: ${teacherStudentRows.count}`);

    if (adminStudentRows.count !== teacherStudentRows.count) {
      throw new Error(`Mismatch! Admin has ${adminStudentRows.count} students but Teacher has ${teacherStudentRows.count} students.`);
    }

    if (adminStudentRows.count !== 1) {
      throw new Error(`Expected exactly 1 registered student (student@edupeak.lk), got ${adminStudentRows.count}`);
    }

    if (!adminStudentRows.studentIds.includes("EP-2027-001")) {
      throw new Error(`Expected EP-2027-001 in admin students, got: ${JSON.stringify(adminStudentRows.studentIds)}`);
    }

    if (!teacherStudentRows.studentIds.includes("EP-2027-001")) {
      throw new Error(`Expected EP-2027-001 in teacher students, got: ${JSON.stringify(teacherStudentRows.studentIds)}`);
    }

    console.log("🎉 SUCCESS: Both Admin and Teacher portals show exactly 1 registered student: student@edupeak.lk (EP-2027-001)!");
  } finally {
    await browser.close();
    server.close();
  }
})();
