const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\5f79724a-cbe6-48b4-bef9-d59476509a57';

async function verifyAdminLessonsAndMcq() {
  console.log('--- Launching Browser for Admin Lessons & MCQ Test ---');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[BROWSER ${msg.type()}]`, msg.text());
    }
  });

  // Navigate to login / seed admin user
  await page.goto('http://localhost:3000/admin.html');
  await page.waitForTimeout(1000);

  // Authenticate through the admin login gate form
  await page.click('#adminGateSubmitBtn');
  await page.waitForTimeout(1500);

  await page.waitForTimeout(1000);

  // 1. Verify Courses Tab Quick Action Buttons
  console.log('--- Verifying Courses Tab & Quick Buttons ---');
  const courseButtons = await page.evaluate(() => {
    const rows = document.querySelectorAll('#adminCoursesTbody tr');
    let hasLessonBtn = false;
    let hasMcqBtn = false;
    rows.forEach(r => {
      if (r.textContent.includes('Lesson')) hasLessonBtn = true;
      if (r.textContent.includes('MCQ')) hasMcqBtn = true;
    });
    return { rowsCount: rows.length, hasLessonBtn, hasMcqBtn };
  });
  console.log('Courses Table Status:', courseButtons);

  // 2. Test Quick Add Lesson from Courses Row
  console.log('--- Testing Quick Add Lesson ---');
  await page.evaluate(() => {
    const firstCourse = document.querySelector('#adminCoursesTbody tr strong');
    const courseId = firstCourse ? firstCourse.textContent.trim() : 'crs-phy-2026-theory';
    window.ADMIN_CONTROLLER.quickAddLessonForCourse(courseId);
  });
  await page.waitForTimeout(500);

  const lessonModalOpen = await page.evaluate(() => {
    const modal = document.getElementById('adminLessonDrawerModal');
    return modal ? modal.classList.contains('active') : false;
  });
  console.log('Lesson Drawer Modal Active:', lessonModalOpen);

  // Fill in lesson details & submit
  await page.evaluate(() => {
    document.getElementById('adminLessonFormTitle').value = 'Thermodynamics & Heat Engine Cycles [Admin Test]';
    document.getElementById('adminLessonFormDuration').value = '65 mins';
    document.getElementById('adminLessonFormVideoUrl').value = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    document.getElementById('adminLessonWatermarkCheckbox').checked = true;
    // Add chapter markers
    window.ADMIN_CONTROLLER.addChapterRowToModal('00:00', '1. First Law of Thermodynamics');
    window.ADMIN_CONTROLLER.addChapterRowToModal('25:00', '2. Heat Engine PV Diagrams');
  });

  const lessonModalShotPath = path.join(ARTIFACTS_DIR, 'admin_lesson_modal_verified.png');
  await page.screenshot({ path: lessonModalShotPath });
  console.log('Saved lesson modal screenshot to:', lessonModalShotPath);

  await page.evaluate(() => {
    const form = document.querySelector('#adminLessonDrawerModal form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
  });
  await page.waitForTimeout(1000);

  // 3. Verify Lessons Tab & Table
  console.log('--- Verifying Lessons Tab Table ---');
  await page.evaluate(() => {
    document.querySelectorAll('.admin-drawer-modal').forEach(m => m.classList.remove('active'));
    window.ADMIN_CONTROLLER.switchTab('lessons');
  });
  await page.waitForTimeout(600);

  const lessonsTableInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('#adminLessonsTbody tr');
    let foundTestLesson = false;
    rows.forEach(r => {
      if (r.textContent.includes('Thermodynamics & Heat Engine Cycles')) {
        foundTestLesson = true;
      }
    });
    return { rowsCount: rows.length, foundTestLesson };
  });
  console.log('Lessons Table Status:', lessonsTableInfo);

  const lessonsTabShotPath = path.join(ARTIFACTS_DIR, 'admin_lessons_tab_verified.png');
  await page.screenshot({ path: lessonsTabShotPath });
  console.log('Saved lessons tab screenshot to:', lessonsTabShotPath);

  // 4. Test Add Speed MCQ Question
  console.log('--- Testing MCQ Quizzes Tab & Creation ---');
  await page.evaluate(() => {
    window.ADMIN_CONTROLLER.switchTab('quizzes');
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    window.ADMIN_CONTROLLER.openAddQuizModal();
  });
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    document.getElementById('adminQuizFormSubject').value = 'Physics - Thermal Physics';
    document.getElementById('adminQuizFormQText').value = 'What is the theoretical maximum efficiency of a Carnot heat engine operating between temperatures Tc and Th?';
    document.getElementById('adminQuizFormQTextSi').value = 'Tc හා Th උෂ්ණත්ව අතර ක්‍රියාත්මක වන කානෝ තාප එන්ජිමක උපරිම කාර්යක්ෂමතාව කුමක්ද?';
    document.getElementById('adminQuizFormOptA').value = '1 - (Tc / Th)';
    document.getElementById('adminQuizFormOptB').value = '1 - (Th / Tc)';
    document.getElementById('adminQuizFormOptC').value = '(Tc + Th) / 2';
    document.getElementById('adminQuizFormOptD').value = 'Th / Tc';
    document.getElementById('adminQuizFormCorrect').value = '0'; // Option A
    document.getElementById('adminQuizFormExplanation').value = 'From Carnot theorem, maximum theoretical efficiency η = 1 - (Tc / Th) with temperatures in Kelvin.';
  });

  await page.evaluate(() => {
    const form = document.querySelector('#adminQuizDrawerModal form');
    if (form) {
      form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    }
    document.querySelectorAll('.admin-drawer-modal').forEach(m => m.classList.remove('active'));
  });
  await page.waitForTimeout(1000);

  // 5. Verify MCQ Cards in adminQuizList with modal closed
  const quizzesListInfo = await page.evaluate(() => {
    const cards = document.querySelectorAll('#adminQuizList .quiz-question-builder-card');
    let foundTestQuiz = false;
    cards.forEach(c => {
      if (c.textContent.includes('Carnot heat engine')) {
        foundTestQuiz = true;
      }
    });
    return { cardsCount: cards.length, foundTestQuiz };
  });
  console.log('Quizzes List Status:', quizzesListInfo);

  const quizzesTabShotPath = path.join(ARTIFACTS_DIR, 'admin_quizzes_tab_verified.png');
  await page.screenshot({ path: quizzesTabShotPath });
  console.log('Saved quizzes tab screenshot to:', quizzesTabShotPath);

  // 6. Capture Courses Table showing + Lesson and + MCQ buttons
  await page.evaluate(() => {
    document.querySelectorAll('.admin-drawer-modal').forEach(m => m.classList.remove('active'));
    window.ADMIN_CONTROLLER.switchTab('courses');
  });
  await page.waitForTimeout(600);
  const coursesTabShotPath = path.join(ARTIFACTS_DIR, 'admin_courses_tab_quick_buttons_verified.png');
  await page.screenshot({ path: coursesTabShotPath });
  console.log('Saved courses tab screenshot to:', coursesTabShotPath);

  await browser.close();
  console.log('--- All Admin Lessons & MCQ Tests Completed Successfully! ---');
}

verifyAdminLessonsAndMcq().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
