const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

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

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(__dirname, '..', reqPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✓ PASS [${total}]: ${testName}`);
  } else {
    console.error(`  ✗ FAIL [${total}]: ${testName}`);
    process.exitCode = 1;
  }
}

async function run() {
  const port = 13398;
  await new Promise(resolve => server.listen(port, resolve));
  console.log(`Static server listening on port ${port}`);

  const executablePath = findChromePath();
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  // Create shared context so localStorage and BroadcastChannel communicate across tabs
  const context = await browser.newContext();
  await context.addInitScript(() => {
    if (!localStorage.getItem("edupeak_schedules_db")) {
      const mockSchedules = [
        {
          id: "sched-test-1",
          topic: "2027 A/L Physics - Mechanics & Circular Motion Masterclass",
          topic_si: "යාන්ත්‍ර විද්‍යාව සහ වෘත්ත චලිතය",
          subject: "Physics",
          examYear: "2027 A/L",
          teacherId: "tch-amalsha",
          teacherName: "Amalsha Wanniarachchi",
          status: "live",
          scheduleDate: "2026-09-10",
          scheduleStartTime: "08:30",
          scheduleEndTime: "12:30",
          rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
          viewersCount: 342,
          pinnedNotice: "Welcome to Live Masterclass! Keep your Physics notes ready."
        }
      ];
      localStorage.setItem("edupeak_schedules_db", JSON.stringify(mockSchedules));
    }
  });

  try {
    const studentPage = await context.newPage();
    const teacherPage = await context.newPage();

    console.log('\n--- 1. Set up Student & Teacher Browser Tabs ---');
    // Set up Student User
    await studentPage.goto(`http://127.0.0.1:${port}/live-class.html`, { waitUntil: 'domcontentloaded' });
    await studentPage.evaluate(() => {
      localStorage.setItem('edupeak_active_session', JSON.stringify({
        id: 'EP-STU-001',
        name: 'Kasun Jayasundara',
        email: 'kasun@edupeak.lk',
        role: 'student',
        nic: '200512345678'
      }));
      LIVE_APP.initUser();
    });

    // Set up Teacher User
    await teacherPage.goto(`http://127.0.0.1:${port}/live-class.html`, { waitUntil: 'domcontentloaded' });
    await teacherPage.evaluate(() => {
      localStorage.setItem('edupeak_active_session', JSON.stringify({
        id: 'TCH-AMALSHA-01',
        name: 'Amalsha Wanniarachchi',
        email: 'amalsha@edupeak.lk',
        role: 'teacher'
      }));
      LIVE_APP.initUser();
    });

    await studentPage.waitForTimeout(600);
    await teacherPage.waitForTimeout(600);

    const studentStream = await studentPage.evaluate(() => LIVE_APP.activeSessionId);
    const teacherStream = await teacherPage.evaluate(() => LIVE_APP.activeSessionId);
    assert(Boolean(studentStream && studentStream === teacherStream), `Both tabs loaded same active stream session: ${studentStream}`);

    // -------------------------------------------------------------
    console.log('\n--- 2. Student Sends Message in Tab 1 -> Verified Real-Time in Tab 2 ---');
    // -------------------------------------------------------------
    const studentMsg = 'Sir, is circular acceleration always directed towards the center?';
    await studentPage.fill('#chatInputMessage', studentMsg);
    await studentPage.locator('#liveChatForm button[type="submit"]').click();

    // Give 500ms for BroadcastChannel / Storage real-time event
    await teacherPage.waitForTimeout(500);

    const teacherSeenMsg = await teacherPage.locator('.chat-messages-container').innerText();
    assert(teacherSeenMsg.includes('Kasun Jayasundara') && teacherSeenMsg.includes('circular acceleration'),
      'Teacher Tab received student chat message in REAL TIME without reloading');

    // -------------------------------------------------------------
    console.log('\n--- 3. Teacher Replies in Tab 2 -> Verified Real-Time in Tab 1 ---');
    // -------------------------------------------------------------
    const teacherReply = 'Yes Kasun! The centripetal acceleration is strictly directed along the radius toward the center of circular curvature.';
    await teacherPage.fill('#chatInputMessage', teacherReply);
    await teacherPage.locator('#liveChatForm button[type="submit"]').click();

    // Give 500ms for real-time propagation
    await studentPage.waitForTimeout(500);

    const studentSeenReply = await studentPage.locator('.chat-messages-container').innerText();
    assert(studentSeenReply.includes('Amalsha Wanniarachchi') && studentSeenReply.includes('centripetal acceleration'),
      'Student Tab received lecturer reply in REAL TIME without reloading');

    // -------------------------------------------------------------
    console.log('\n--- 4. Verify Chat Persistence Across Site Reload (Student Tab) ---');
    // -------------------------------------------------------------
    console.log('  Reloading Student tab (F5)...');
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await studentPage.waitForTimeout(1000);

    const studentStreamAfterReload = await studentPage.evaluate(() => LIVE_APP.activeSessionId);
    assert(studentStreamAfterReload === studentStream, `Student stayed on same stream session (${studentStreamAfterReload}) after reload`);

    const studentChatAfterReload = await studentPage.locator('.chat-messages-container').innerText();
    assert(studentChatAfterReload.includes('Kasun Jayasundara') && studentChatAfterReload.includes('circular acceleration'),
      'Student message PERSISTED after site reload');
    assert(studentChatAfterReload.includes('Amalsha Wanniarachchi') && studentChatAfterReload.includes('centripetal acceleration'),
      'Teacher reply PERSISTED after site reload');

    // -------------------------------------------------------------
    console.log('\n--- 5. Verify Chat Persistence Across Site Reload (Teacher Tab) ---');
    // -------------------------------------------------------------
    console.log('  Reloading Teacher tab (F5)...');
    await teacherPage.reload({ waitUntil: 'domcontentloaded' });
    await teacherPage.waitForTimeout(1000);

    const teacherStreamAfterReload = await teacherPage.evaluate(() => LIVE_APP.activeSessionId);
    assert(teacherStreamAfterReload === teacherStream, `Teacher stayed on same stream session (${teacherStreamAfterReload}) after reload`);

    const teacherChatAfterReload = await teacherPage.locator('.chat-messages-container').innerText();
    assert(teacherChatAfterReload.includes('Kasun Jayasundara') && teacherChatAfterReload.includes('circular acceleration'),
      'Teacher tab displays persisted student message after reload');
    assert(teacherChatAfterReload.includes('Amalsha Wanniarachchi') && teacherChatAfterReload.includes('centripetal acceleration'),
      'Teacher tab displays persisted teacher reply after reload');

    // -------------------------------------------------------------
    console.log('\n--- 6. Verify Self vs Other Badging ---');
    // -------------------------------------------------------------
    const studentBadges = await studentPage.locator('.chat-role-badge').allInnerTexts();
    const hasStudentOrYouBadge = studentBadges.some(b => b.toUpperCase().includes('STUDENT') || b.toUpperCase().includes('YOU'));
    const hasLecturerBadge = studentBadges.some(b => b.toUpperCase().includes('LECTURER'));
    assert(hasStudentOrYouBadge && hasLecturerBadge, 'Role badges correctly distinguish Student and Lecturer');

  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log(`======================================================`);
  if (passed === total) {
    console.log(`🎉 ALL REAL-TIME CHAT & RELOAD PERSISTENCE TESTS PASSED!`);
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Test execution failed:', err);
  server.close();
  process.exit(1);
});
