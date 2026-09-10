const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

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

async function runLiveClassTests() {
  console.log('🚀 === STARTING LIVE CLASSROOM & MULTI-BROADCAST HUB TEST SUITE ===');
  const { server, port } = await startServer();
  const executablePath = findChromePath();
  if (!executablePath) {
    console.error('❌ Chrome or Edge executable not found.');
    server.close();
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  let testsPassed = 0;
  let totalTests = 0;

  function assertTest(condition, description) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ PASS [${totalTests}]: ${description}`);
      testsPassed++;
    } else {
      console.error(`  ❌ FAIL [${totalTests}]: ${description}`);
    }
  }

  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('  [BROWSER LOG]:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('  [BROWSER ERROR]:', err.message));
  page.on('response', resp => {
    if (resp.status() >= 400) {
      console.log(`  [HTTP ${resp.status()}]:`, resp.url());
    }
  });
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  try {
    // ---------------------------------------------------------
    // TEST 1: Page Load & Initial Multi-Live State
    // ---------------------------------------------------------
    console.log('\n--- 1. Testing Live Class Hub Initial Load & Multi-Stream Rendering ---');
    // Seed test schedules for multi-stream verification in the test browser context
    await page.addInitScript(() => {
      if (window.top !== window) return;
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
          },
          {
            id: "sched-test-2",
            topic: "2026 A/L Physics - Past Paper Speed Analysis",
            topic_si: "පසුගිය විභාග ප්‍රශ්න විවරණය",
            subject: "Physics",
            examYear: "2026 A/L",
            teacherId: "TCH-PHYSICS-2",
            teacherName: "Prof. K. M. Liyanage",
            status: "scheduled",
            scheduleDate: "2026-09-11",
            scheduleStartTime: "09:00",
            scheduleEndTime: "12:00",
            rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
            viewersCount: 0
          }
        ];
        localStorage.setItem("edupeak_schedules_db", JSON.stringify(mockSchedules));
      }
    });

    await page.goto(`http://127.0.0.1:${port}/live-class.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const pageTitle = await page.title();
    assertTest(pageTitle.includes('Live Interactive Classroom'), 'Page title is correct');

    const streamCardsCount = await page.locator('.stream-card').count();
    assertTest(streamCardsCount >= 2, `Seeded multi-live stream cards rendered (found ${streamCardsCount})`);

    const topLiveBadge = await page.locator('#topLiveStatusText').innerText();
    assertTest(topLiveBadge.includes('BROADCAST'), `Top live pulse badge active: "${topLiveBadge}"`);

    // ---------------------------------------------------------
    // TEST 2: Multi-Live Stream Switching
    // ---------------------------------------------------------
    console.log('\n--- 2. Testing Multi-Live Stream Switching ---');
    const firstTopic = await page.locator('#infoTopicTitle').innerText();
    console.log(`  Initial Active Topic: "${firstTopic}"`);

    // Click the second stream card in the multi-live grid
    const secondCard = page.locator('.stream-card').nth(1);
    await secondCard.click();
    await page.waitForTimeout(600);

    const secondTopic = await page.locator('#infoTopicTitle').innerText();
    console.log(`  Switched Active Topic: "${secondTopic}"`);
    assertTest(secondTopic !== '' && secondTopic !== firstTopic, `Successfully switched stream to: "${secondTopic}"`);

    // ---------------------------------------------------------
    // TEST 3: Batch and Status Filters
    // ---------------------------------------------------------
    console.log('\n--- 3. Testing Stream Filter Pills ---');
    await page.locator('.live-filter-btn:has-text("Live Now")').click();
    await page.waitForTimeout(400);
    const liveFilterCount = await page.locator('.stream-card').count();
    assertTest(liveFilterCount >= 1, `Live Now filter shows active broadcasts (found ${liveFilterCount})`);

    await page.locator('.live-filter-btn:has-text("All")').click();
    await page.waitForTimeout(400);
    const allCount = await page.locator('.stream-card').count();
    assertTest(allCount >= streamCardsCount, `All filter restores full list (found ${allCount})`);

    // ---------------------------------------------------------
    // TEST 4: Schedule Creation as Teacher Amalsha (Creator)
    // ---------------------------------------------------------
    console.log('\n--- 4. Testing Live Schedule Creation (Teacher Amalsha) ---');
    // Set authenticated user as Teacher Amalsha
    await page.evaluate(() => {
      const teacherUser = {
        id: 'tch-amalsha',
        name: 'Amalsha Wanniarachchi',
        email: 'amalsha@edupeak.lk',
        role: 'teacher',
        subject: 'G.C.E. A/L Physics',
        branch: 'Victory Embilipitiya'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(teacherUser));
      LIVE_APP.initUser();
      LIVE_APP.renderControlDeck(LIVE_APP.activeSession);
    });

    const scheduleBtnVisible = await page.locator('#btnOpenScheduleModal').isVisible();
    assertTest(scheduleBtnVisible, 'Schedule button is visible for authorized teacher');

    await page.locator('#btnOpenScheduleModal').click();
    await page.waitForTimeout(400);

    const modalVisible = await page.locator('#scheduleLiveModal').evaluate(el => el.classList.contains('active'));
    assertTest(modalVisible, 'Schedule creation modal opened');

    // Fill form
    const newTopicName = '2028 A/L Physics Foundation Masterclass & Motion Analysis';
    await page.fill('#formTopic', newTopicName);
    await page.selectOption('#formExamYear', '2028 A/L');
    await page.fill('#formDate', '2026-09-12');
    await page.fill('#formStreamUrl', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.selectOption('#formStatus', 'scheduled');
    await page.fill('#formStartTime', '09:00');
    await page.fill('#formEndTime', '12:00');

    // Submit form
    await page.locator('#btnSubmitSchedule').click();
    await page.waitForTimeout(1000);

    const activeTopicAfterCreation = await page.locator('#infoTopicTitle').innerText();
    assertTest(activeTopicAfterCreation.includes('2028 A/L'), `New broadcast schedule created & loaded: "${activeTopicAfterCreation}"`);

    // ---------------------------------------------------------
    // TEST 5: Go Live Now (Teacher Creator Action)
    // ---------------------------------------------------------
    console.log('\n--- 5. Testing "Go Live Now" Stream Activation ---');
    const startBtn = page.locator('.btn-live-start');
    const isStartVisible = await startBtn.isVisible();
    assertTest(isStartVisible, '🔴 Go Live Now button is visible on scheduled broadcast for creator teacher');

    await startBtn.click();
    await page.waitForTimeout(1000);

    const statusPillText = await page.locator('#infoStatusPill').innerText();
    assertTest(statusPillText.includes('LIVE NOW'), `Broadcast status transitioned to: "${statusPillText}"`);

    const endBtnVisible = await page.locator('.btn-live-end').isVisible();
    assertTest(endBtnVisible, '⏹️ End Broadcast button is now visible after going live');

    // ---------------------------------------------------------
    // TEST 6: End Broadcast (Teacher Creator Action)
    // ---------------------------------------------------------
    console.log('\n--- 6. Testing "End Broadcast" Conclude Action ---');
    await page.locator('.btn-live-end').click();
    await page.waitForTimeout(1000);

    const endedStatusText = await page.locator('#infoStatusPill').innerText();
    assertTest(endedStatusText.includes('CONCLUDED'), `Broadcast successfully concluded: "${endedStatusText}"`);

    const endedOverlayVisible = await page.locator('#liveEndedScreen').isVisible();
    assertTest(endedOverlayVisible, 'Live Concluded Standby overlay displayed');

    // ---------------------------------------------------------
    // TEST 7: Role-Based Ownership & Access Control (Teacher B Non-Creator)
    // ---------------------------------------------------------
    console.log('\n--- 7. Testing Permission Lock for Non-Creator Teacher (Teacher B) ---');
    // Switch auth to Teacher B (Prof. Liyanage)
    await page.evaluate(() => {
      const otherTeacher = {
        id: 'TCH-PHYSICS-2',
        name: 'Prof. K. M. Liyanage',
        email: 'liyanage@edupeak.lk',
        role: 'teacher'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(otherTeacher));
      LIVE_APP.initUser();
      LIVE_APP.renderControlDeck(LIVE_APP.activeSession);
    });
    await page.waitForTimeout(400);

    const deckVisibleForOtherTeacher = await page.locator('#liveControlDeck').isVisible();
    assertTest(!deckVisibleForOtherTeacher, 'Control Deck is HIDDEN for non-creator teacher on Amalsha’s stream');

    const readOnlyNoticeVisible = await page.locator('#readOnlyStreamNotice').isVisible();
    assertTest(readOnlyNoticeVisible, 'Read-only locked notice is DISPLAYED for non-creator teacher');

    // ---------------------------------------------------------
    // TEST 8: Role-Based Permissions (Super Admin)
    // ---------------------------------------------------------
    console.log('\n--- 8. Testing Super Admin Full Access ---');
    await page.evaluate(() => {
      const adminUser = {
        id: 'ADM-SUPER',
        name: 'System Administrator',
        email: 'admin@edupeak.lk',
        role: 'admin'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(adminUser));
      LIVE_APP.initUser();
      LIVE_APP.renderControlDeck(LIVE_APP.activeSession);
    });
    await page.waitForTimeout(400);

    const deckVisibleForAdmin = await page.locator('#liveControlDeck').isVisible();
    assertTest(deckVisibleForAdmin, 'Control Deck is FULLY VISIBLE for Super Administrator on any stream');

    // ---------------------------------------------------------
    // TEST 9: Student Experience & Real-Time Live Chat
    // ---------------------------------------------------------
    console.log('\n--- 9. Testing Student Experience, DRM Watermark & Live Chat ---');
    await page.evaluate(() => {
      const studentUser = {
        id: 'EP-2027-001',
        name: 'Kasun Jayasundara',
        email: 'student@edupeak.lk',
        role: 'student',
        nic: '200512345678',
        batch: '2027 A/L'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(studentUser));
      LIVE_APP.initUser();
      LIVE_APP.renderControlDeck(LIVE_APP.activeSession);
      LIVE_APP.initWatermarkDrift();
    });
    await page.waitForTimeout(400);

    const deckVisibleForStudent = await page.locator('#liveControlDeck').isVisible();
    assertTest(!deckVisibleForStudent, 'Control Deck is HIDDEN for students');

    const watermarkText = await page.locator('#liveDrmWatermark').innerText();
    assertTest(watermarkText.includes('200512345678') && watermarkText.includes('Kasun Jayasundara'), `DRM Anti-Piracy watermark active with student info: "${watermarkText}"`);

    // Test sending chat message
    const chatMsg = 'Sir, can you please explain the circular motion question in 2024 Paper?';
    await page.fill('#chatInputMessage', chatMsg);
    await page.locator('#liveChatForm button[type="submit"]').click();
    await page.waitForTimeout(600);

    const lastChatMessage = await page.locator('.chat-message-bubble').last().innerText();
    assertTest(lastChatMessage.includes('circular motion'), `Live chat message sent & rendered in stream room`);

    // ---------------------------------------------------------
    // TEST 10: Cross-Platform Navigation Links
    // ---------------------------------------------------------
    console.log('\n--- 10. Testing Navigation Cross-Links to Live Class ---');
    // Check index.html
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
    const indexLiveLink = await page.locator('a[href="live-class.html"]').count();
    assertTest(indexLiveLink >= 1, `index.html contains link to live-class.html (found ${indexLiveLink})`);

    // Check courses.html
    await page.goto(`http://127.0.0.1:${port}/courses.html`, { waitUntil: 'domcontentloaded' });
    const coursesLiveLink = await page.locator('a[href="live-class.html"]').count();
    assertTest(coursesLiveLink >= 1, `courses.html contains link to live-class.html (found ${coursesLiveLink})`);

    // Check student-dashboard.html
    await page.goto(`http://127.0.0.1:${port}/student-dashboard.html`, { waitUntil: 'domcontentloaded' });
    const studentDashLiveLink = await page.locator('a[href="live-class.html"]').count();
    assertTest(studentDashLiveLink >= 1, `student-dashboard.html contains link to live-class.html (found ${studentDashLiveLink})`);

    // Check teacher-portal.html
    await page.goto(`http://127.0.0.1:${port}/teacher-portal.html`, { waitUntil: 'domcontentloaded' });
    const teacherLiveLink = await page.locator('a[href="live-class.html"]').count();
    assertTest(teacherLiveLink >= 1, `teacher-portal.html contains link to live-class.html (found ${teacherLiveLink})`);

    // Check admin.html
    await page.goto(`http://127.0.0.1:${port}/admin.html`, { waitUntil: 'domcontentloaded' });
    const adminLiveLink = await page.locator('a[href="live-class.html"]').count();
    assertTest(adminLiveLink >= 1, `admin.html contains link to live-class.html (found ${adminLiveLink})`);

  } catch (err) {
    console.error('❌ Error executing tests:', err);
    assertTest(false, `Test encountered exception: ${err.message}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n======================================================`);
  console.log(`TEST SUMMARY: ${testsPassed} / ${totalTests} TESTS PASSED (${Math.round((testsPassed / totalTests) * 100)}%)`);
  console.log(`======================================================\n`);

  if (testsPassed === totalTests) {
    console.log('🎉 ALL LIVE CLASSROOM & MULTI-BROADCAST TESTS PASSED PERFECTLY!');
    process.exit(0);
  } else {
    console.error('❌ Some tests failed.');
    process.exit(1);
  }
}

runLiveClassTests();
