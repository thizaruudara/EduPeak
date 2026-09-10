const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5122;
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
  console.log("🚀 Starting Course Deletion & Student Enrollment Synchronization Verification...");
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
  const studentUrl = `http://127.0.0.1:${PORT}/student-dashboard.html`;

  try {
    // 1. Check Admin Panel when courses db is empty (all courses deleted)
    console.log(`1. Navigating to Admin Panel with empty courses catalog`);
    await page.goto(adminUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const initialCheck = await page.evaluate(() => {
      // Simulate deleting all courses
      localStorage.setItem("edupeak_courses_db", JSON.stringify([]));
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.init();
      }
      if (window.ADMIN_CONTROLLER) {
        window.ADMIN_CONTROLLER.switchTab("students");
        window.ADMIN_CONTROLLER.renderStudents();
      }
      const enrolled = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses("EP-2027-001") : [];
      const badgeText = document.querySelector("#adminStudentsTbody tr td:nth-child(6)")?.innerText.trim();
      return {
        enrolledCount: enrolled.length,
        badgeText
      };
    });

    console.log("Empty Course Catalog Check in Admin Panel:", initialCheck);
    if (initialCheck.enrolledCount !== 0) {
      throw new Error(`Expected 0 enrolled courses when all courses deleted, got: ${initialCheck.enrolledCount}`);
    }
    if (!initialCheck.badgeText.includes("None")) {
      throw new Error(`Expected 'None' badge in Admin Panel table, got: ${initialCheck.badgeText}`);
    }

    // 2. Check Teacher Portal
    console.log(`2. Navigating to Teacher Portal`);
    await page.goto(teacherUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    const teacherCheck = await page.evaluate(() => {
      localStorage.setItem("edupeak_courses_db", JSON.stringify([]));
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.init();
      }
      if (window.TEACHER_CONTROLLER) {
        window.TEACHER_CONTROLLER.switchTab("students");
        window.TEACHER_CONTROLLER.renderStudents();
      }
      const enrolled = window.AUTH_SYSTEM ? window.AUTH_SYSTEM.getStudentEnrolledCourses("EP-2027-001") : [];
      const badgeText = document.querySelector("#teacherStudentsTbody tr td:nth-child(7)")?.innerText.trim();
      return {
        enrolledCount: enrolled.length,
        badgeText
      };
    });

    console.log("Empty Course Catalog Check in Teacher Portal:", teacherCheck);
    if (teacherCheck.enrolledCount !== 0) {
      throw new Error(`Expected 0 enrolled courses in Teacher Portal when all courses deleted, got: ${teacherCheck.enrolledCount}`);
    }
    if (!teacherCheck.badgeText.includes("None")) {
      throw new Error(`Expected 'None' badge in Teacher Portal table, got: ${teacherCheck.badgeText}`);
    }

    // 3. Test deleting a single course via deleteCourse cascade
    console.log(`3. Testing single course cascade deletion`);
    await page.evaluate(async () => {
      const mockCourses = [
        { id: "crs-phy-2027-theory", title: "2027 Theory", category: "theory" },
        { id: "crs-phy-2027-revision", title: "2027 Revision", category: "revision" }
      ];
      localStorage.setItem("edupeak_courses_db", JSON.stringify(mockCourses));
      window.AUTH_SYSTEM.setStudentEnrolledCourses("EP-2027-001", ["crs-phy-2027-theory", "crs-phy-2027-revision"]);
      
      // Delete 1 course
      await window.SUPABASE_HELPER.deleteCourse("crs-phy-2027-theory");
    });

    const afterDeleteOne = await page.evaluate(() => {
      const enrolled = window.AUTH_SYSTEM.getStudentEnrolledCourses("EP-2027-001");
      return enrolled;
    });

    console.log("Enrolled after deleting 1 course:", afterDeleteOne);
    if (afterDeleteOne.length !== 1 || afterDeleteOne[0] !== "crs-phy-2027-revision") {
      throw new Error(`Expected only crs-phy-2027-revision left after deleting theory course, got: ${JSON.stringify(afterDeleteOne)}`);
    }

    console.log("🎉 SUCCESS: Course deletion and student enrollment count are perfectly synchronized!");
  } finally {
    await browser.close();
    server.close();
  }
})();
