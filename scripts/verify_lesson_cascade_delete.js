const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5098;
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
  console.log("🚀 Starting Lesson & Quiz Cascade Deletion Verification Test...");
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Handle JS alerts/confirms
  page.on("dialog", async (dialog) => {
    console.log(`💬 Dialog [${dialog.type()}]: ${dialog.message()}`);
    await dialog.accept();
  });

  const teacherUrl = `http://127.0.0.1:${PORT}/teacher-portal.html`;
  const indexUrl = `http://127.0.0.1:${PORT}/index.html`;

  try {
    // 0. Set teacher auth session in storage
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      localStorage.setItem("edupeak_active_session", JSON.stringify({
        id: "TCH-PHYSICS",
        name: "Amalsha Wanniarachchi (MBBS UG)",
        email: "amalsha@edupeak.lk",
        role: "teacher"
      }));
    });

    console.log(`1. Navigating to Teacher Portal: ${teacherUrl}`);
    await page.goto(teacherUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    // 1. Reset databases to a clean test state with 1 course and 1 lesson
    console.log("2. Setting up test course, lesson, and quiz...");
    const setupResult = await page.evaluate(async () => {
      const testCourse = {
        id: "crs-cascade-test-1",
        title: "Cascade Test Physics Masterclass",
        title_si: "කැස්කේඩ් පරීක්ෂණ පාඨමාලාව",
        teacherId: "tch-physics",
        teacherName: "Amalsha Wanniarachchi",
        examYear: "2027 A/L",
        stream: "Physical Science",
        fee: "LKR 3,500 / Month",
        liveTime: "Every Saturday 07:30 AM - 01:30 PM",
        thumbnailIcon: "fa-atom"
      };

      const testLesson = {
        id: "lsn-cascade-test-1",
        courseId: "crs-cascade-test-1",
        title: "Test Lesson for Cascade Deletion",
        title_si: "කැස්කේඩ් පාඩම",
        duration: "45 mins",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        hasPdf: true,
        pdfName: "Test_Notes.pdf",
        chapters: [{ time: "00:00", title: "Intro" }]
      };

      const testQuiz = {
        id: 99991,
        courseId: "crs-cascade-test-1",
        subject: "Physics",
        question: "Cascade Test Question 1",
        options: ["A", "B", "C", "D"],
        correctAnswer: 0,
        explanation: "Test explanation"
      };

      if (window.SUPABASE_HELPER && typeof window.SUPABASE_HELPER.saveCourse === "function") {
        await window.SUPABASE_HELPER.saveCourse(testCourse);
      }
      window.TEACHER_CONTROLLER.saveCoursesDatabase([testCourse]);
      window.TEACHER_CONTROLLER.saveLessonsDatabase([testLesson]);
      window.TEACHER_CONTROLLER.saveQuizzesDatabase([testQuiz]);

      window.TEACHER_CONTROLLER.loadCustomData();
      window.TEACHER_CONTROLLER.renderMetrics();
      window.TEACHER_CONTROLLER.renderCourses();
      window.TEACHER_CONTROLLER.populateCourseDropdowns();

      return {
        coursesCount: window.TEACHER_CONTROLLER.getTeacherCourses().length,
        lessonsCount: window.TEACHER_CONTROLLER.getAllLessons().length,
        quizzesCount: window.TEACHER_CONTROLLER.getAllQuizzes().length
      };
    });

    console.log("Initial state after setup:", setupResult);
    if (setupResult.coursesCount !== 1 || setupResult.lessonsCount !== 1 || setupResult.quizzesCount !== 1) {
      throw new Error(`Failed to initialize test data correctly: ${JSON.stringify(setupResult)}`);
    }

    // 2. Switch to lessons tab and verify lesson is visible
    console.log("3. Checking Lessons tab in Teacher Studio...");
    await page.evaluate(() => {
      window.TEACHER_CONTROLLER.switchTab("lessons");
    });
    await page.waitForTimeout(500);

    const lessonRowText = await page.evaluate(() => {
      const tbody = document.getElementById("teacherLessonsTbody");
      return tbody ? tbody.innerText : "";
    });
    console.log("Lessons table content snippet:", lessonRowText.substring(0, 100).replace(/\n/g, ' '));
    if (!lessonRowText.includes("Test Lesson for Cascade Deletion")) {
      throw new Error("Lessons table does not contain test lesson!");
    }

    // 3. Delete the course via Teacher Controller
    console.log("4. Deleting course 'crs-cascade-test-1' from Teacher Studio...");
    await page.evaluate(async () => {
      window.TEACHER_CONTROLLER.handleDeleteCourse("crs-cascade-test-1");
    });
    await page.waitForTimeout(1000);

    // 4. Verify post-deletion state in Teacher Studio
    console.log("5. Checking Teacher Studio metrics and lessons after deletion...");
    const postDeleteState = await page.evaluate(() => {
      const courses = window.TEACHER_CONTROLLER.getTeacherCourses();
      const lessons = window.TEACHER_CONTROLLER.getAllLessons();
      const quizzes = window.TEACHER_CONTROLLER.getAllQuizzes();
      const metricCourses = document.getElementById("metricTotalCourses")?.innerText;
      const metricLessons = document.getElementById("metricTotalLessons")?.innerText;
      const metricQuizzes = document.getElementById("metricTotalQuizzes")?.innerText;
      const lessonsTbody = document.getElementById("teacherLessonsTbody")?.innerText;
      const quizList = document.getElementById("teacherQuizList")?.innerText;

      return {
        coursesCount: courses.length,
        lessonsCount: lessons.length,
        quizzesCount: quizzes.length,
        metricCourses,
        metricLessons,
        metricQuizzes,
        lessonsTbody,
        quizList
      };
    });

    console.log("Post-deletion state in Teacher Portal:", postDeleteState);

    if (postDeleteState.coursesCount !== 0) {
      throw new Error(`Expected 0 courses, got ${postDeleteState.coursesCount}`);
    }
    if (postDeleteState.lessonsCount !== 0) {
      throw new Error(`Expected 0 lessons, got ${postDeleteState.lessonsCount}`);
    }
    if (postDeleteState.quizzesCount !== 0) {
      throw new Error(`Expected 0 quizzes, got ${postDeleteState.quizzesCount}`);
    }
    if (postDeleteState.metricLessons !== "0") {
      throw new Error(`Expected metricTotalLessons to be '0', got '${postDeleteState.metricLessons}'`);
    }
    if (!postDeleteState.lessonsTbody.includes("No Courses Published Yet")) {
      throw new Error(`Expected lessons tab to show 'No Courses Published Yet', got: ${postDeleteState.lessonsTbody}`);
    }

    // 5. Navigate to index.html and check LMS Video Classroom
    console.log(`6. Navigating to Student LMS: ${indexUrl}`);
    await page.goto(indexUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);

    const lmsState = await page.evaluate(() => {
      const courses = window.getLMSCourses ? window.getLMSCourses() : [];
      const lessons = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.lmsLessons) ? window.EDUPEAK_DATA.lmsLessons : [];
      const quizzes = (window.EDUPEAK_DATA && window.EDUPEAK_DATA.quizQuestions) ? window.EDUPEAK_DATA.quizQuestions : [];

      return {
        lmsCoursesCount: courses.length,
        lmsLessonsCount: lessons.length,
        lmsQuizzesCount: quizzes.length
      };
    });

    console.log("Student LMS state:", lmsState);
    if (lmsState.lmsLessonsCount !== 0 || lmsState.lmsQuizzesCount !== 0) {
      throw new Error(`LMS still contains orphaned lessons or quizzes! ${JSON.stringify(lmsState)}`);
    }

    // 6. Reset default courses for standard usage
    console.log("7. Restoring default course catalog for normal usage...");
    await page.evaluate(async () => {
      const defaultCourses = [
        {
          id: "crs-phy-2027-theory",
          title: "2027 A/L Physics Theory Masterclass",
          title_si: "2027 අ.පො.ස. උසස් පෙළ භෞතික විද්‍යාව සිද්ධාන්ත",
          teacherId: "tch-physics",
          teacherName: "Amalsha Wanniarachchi",
          examYear: "2027 A/L",
          stream: "Physical Science",
          stream_si: "භෞතික විද්‍යා අංශය",
          fee: "LKR 3,500 / Month",
          liveTime: "Every Saturday 7:30 AM - 1:30 PM",
          thumbnailIcon: "fa-atom",
          category: "theory"
        },
        {
          id: "crs-phy-2028-theory",
          title: "2028 A/L Physics Theory Masterclass",
          title_si: "2028 අ.පො.ස. උසස් පෙළ භෞතික විද්‍යාව සිද්ධාන්ත",
          teacherId: "tch-physics",
          teacherName: "Amalsha Wanniarachchi",
          examYear: "2028 A/L",
          stream: "Physical Science",
          stream_si: "භෞතික විද්‍යා අංශය",
          fee: "LKR 3,500 / Month",
          liveTime: "Every Sunday 7:30 AM - 1:30 PM",
          thumbnailIcon: "fa-atom",
          category: "theory"
        }
      ];

      if (window.SUPABASE_HELPER) {
        window.SUPABASE_HELPER.setSharedData("edupeak_courses_db", defaultCourses);
      }
      localStorage.setItem("edupeak_courses_db", JSON.stringify(defaultCourses));
    });

    console.log("✅ All Lesson & Quiz Cascade Deletion tests passed successfully!");
  } finally {
    await browser.close();
    server.close();
  }
})();
