/**
 * Verification Test: Early Manual Live Start by Teacher & Instant Student Transition
 * Validates that when a teacher starts a scheduled live stream manually before the scheduled time:
 * 1. Student's browser immediately transitions from countdown standby to live video player.
 * 2. Standby countdown timer is cancelled and removed.
 * 3. Live status badges, pills, and indicators update to "LIVE NOW".
 * 4. Verification across multiple tabs/windows via BroadcastChannel & LocalStorage events.
 * 5. Page reload on student side preserves active "live" stream state.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = 8097;

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

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startServer() {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url, `http://localhost:${PORT}`);
    let reqPath = parsed.pathname === '/' ? '/index.html' : parsed.pathname;
    const filePath = path.join(ROOT_DIR, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.log('SERVER 404:', reqPath);
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`✅ PASS: ${message}`);
}

async function runTest() {
  console.log('🚀 Starting Early Manual Live Start & Student Auto-Transition Test...');
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({ executablePath, headless: true });

  try {
    const context = await browser.newContext();

    // Setup initial test schedule: Scheduled for later tonight
    const testSessionId = 'sched-early-test-' + Date.now();
    const scheduledStartTime = '23:45';
    const initialSchedule = {
      id: testSessionId,
      topic: '2027 A/L Quantum Mechanics Masterclass',
      topic_si: '2027 ක්වොන්ටම් යාන්ත්‍ර විද්‍යාව',
      courseId: 'crs-phy-2027',
      courseTitle: '2027 A/L Physics Theory',
      subject: 'Physics',
      examYear: '2027 A/L',
      teacherId: 'tch-amalsha',
      teacherName: 'Amalsha Wanniarachchi',
      scheduleDate: new Date().toISOString().split('T')[0],
      scheduleStartTime: scheduledStartTime,
      scheduleEndTime: '03:00',
      scheduleTime: 'Tonight • 11:45 PM - 03:00 AM',
      provider: 'youtube',
      rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ?enablejsapi=1&rel=0',
      status: 'scheduled',
      watermarkEnabled: true,
      updatedAt: new Date().toISOString()
    };

    // TAB 1: Student Tab
    const studentPage = await context.newPage();
    studentPage.on('console', msg => console.log('STUDENT CONSOLE:', msg.text()));
    studentPage.on('pageerror', err => console.log('STUDENT ERROR:', err));
    await studentPage.addInitScript((sched) => {
      const studentUser = {
        id: 'std-kavindu',
        name: 'Kavindu Perera',
        role: 'student',
        nic: '200588991122'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(studentUser));
      localStorage.setItem('edupeak_current_user', JSON.stringify(studentUser));
      let db = [];
      try { db = JSON.parse(localStorage.getItem('edupeak_schedules_db') || '[]'); } catch(e){}
      if (!db.some(s => s.id === sched.id)) {
        db.unshift(sched);
        localStorage.setItem('edupeak_schedules_db', JSON.stringify(db));
      }
      localStorage.setItem('edupeak_last_active_stream', sched.id);
    }, initialSchedule);

    await studentPage.goto(`http://localhost:${PORT}/live-class.html?stream=${testSessionId}`);
    await studentPage.waitForTimeout(1000);

    // Verify Student sees standby screen with countdown timer
    const standbyDisplayBefore = await studentPage.locator('#liveStandbyScreen').evaluate(el => getComputedStyle(el).display);
    assert(standbyDisplayBefore === 'flex', 'Student initially sees liveStandbyScreen (display: flex)');

    const playerDisplayBefore = await studentPage.locator('#edupeakLivePlayerWrapper').evaluate(el => getComputedStyle(el).display);
    assert(playerDisplayBefore === 'none', 'Player is initially hidden on standby (display: none)');

    const countdownHours = await studentPage.locator('#cdHours').textContent();
    assert(countdownHours.length > 0, `Countdown timer is actively running with hours: "${countdownHours}"`);

    const statusPillBefore = await studentPage.locator('#infoStatusPill').textContent();
    assert(statusPillBefore.includes('SCHEDULED'), `Status pill initially displays SCHEDULED: "${statusPillBefore.trim()}"`);

    console.log('⏳ Student is currently waiting on the scheduled countdown standby screen...');

    // TAB 2: Teacher Tab (Teacher logs in and starts the live early/manually)
    const teacherPage = await context.newPage();
    teacherPage.on('console', msg => console.log('TEACHER CONSOLE:', msg.text()));
    teacherPage.on('pageerror', err => console.log('TEACHER ERROR:', err));
    await teacherPage.addInitScript((sched) => {
      const teacherUser = {
        id: 'tch-amalsha',
        name: 'Amalsha Wanniarachchi',
        role: 'teacher'
      };
      localStorage.setItem('edupeak_active_session', JSON.stringify(teacherUser));
      localStorage.setItem('edupeak_current_user', JSON.stringify(teacherUser));
      let db = [];
      try { db = JSON.parse(localStorage.getItem('edupeak_schedules_db') || '[]'); } catch(e){}
      if (!db.some(s => s.id === sched.id)) {
        db.unshift(sched);
        localStorage.setItem('edupeak_schedules_db', JSON.stringify(db));
      }
      localStorage.setItem('edupeak_last_active_stream', sched.id);
    }, initialSchedule);

    await teacherPage.goto(`http://localhost:${PORT}/live-class.html?stream=${testSessionId}`);
    await teacherPage.waitForTimeout(1000);

    console.log('🔴 Teacher starts live via LIVE_APP.handleStartStream...');
    const handleResult = await teacherPage.evaluate(async (id) => {
      try {
        console.log('Invoking handleStartStream for id:', id);
        await LIVE_APP.handleStartStream(id);
        const stored = JSON.parse(localStorage.getItem('edupeak_schedules_db') || '[]');
        return { success: true, storedSession: stored.find(s => s.id === id), activeSession: LIVE_APP.activeSession };
      } catch (err) {
        return { success: false, error: err.message, stack: err.stack };
      }
    }, testSessionId);
    console.log('handleStartStream result:', JSON.stringify(handleResult));

    // Now check TAB 1 (Student Tab): Should automatically transition to LIVE without refresh!
    console.log('👀 Checking student tab for automatic real-time transition...');
    await studentPage.waitForTimeout(2500);
    const studentSessionAfter = await studentPage.evaluate(() => LIVE_APP.activeSession);
    console.log('Student activeSession after teacher click:', studentSessionAfter?.status);

    const standbyDisplayAfter = await studentPage.locator('#liveStandbyScreen').evaluate(el => getComputedStyle(el).display);
    assert(standbyDisplayAfter === 'none', 'Student standby screen is now hidden (display: none)');

    const playerDisplayAfter = await studentPage.locator('#edupeakLivePlayerWrapper').evaluate(el => getComputedStyle(el).display);
    assert(playerDisplayAfter === 'block', 'Student custom video player is now ACTIVE & VISIBLE (display: block)');

    const statusPillAfter = await studentPage.locator('#infoStatusPill').textContent();
    assert(statusPillAfter.includes('LIVE NOW'), `Student status pill automatically updated to LIVE NOW: "${statusPillAfter.trim()}"`);

    // Check student DRM watermark has student's name and NIC (not teacher)
    const watermarkText = await studentPage.locator('#liveDrmWatermark').textContent();
    assert(watermarkText.includes('Kavindu Perera'), `Student watermark displays student name: "${watermarkText}"`);
    assert(watermarkText.includes('200588991122'), `Student watermark displays student NIC: "${watermarkText}"`);

    // TAB 1 RELOAD TEST: Ensure state persists on reload
    console.log('🔄 Reloading student page to verify persistence...');
    await studentPage.reload();
    await studentPage.waitForTimeout(1000);

    const standbyOnReload = await studentPage.locator('#liveStandbyScreen').evaluate(el => getComputedStyle(el).display);
    assert(standbyOnReload === 'none', 'After reload, student standby screen remains hidden');

    const playerOnReload = await studentPage.locator('#edupeakLivePlayerWrapper').evaluate(el => getComputedStyle(el).display);
    assert(playerOnReload === 'block', 'After reload, custom live player remains visible & loaded');

    const statusPillOnReload = await studentPage.locator('#infoStatusPill').textContent();
    assert(statusPillOnReload.includes('LIVE NOW'), `After reload, status pill remains LIVE NOW: "${statusPillOnReload.trim()}"`);

    console.log('🎉 ALL EARLY LIVE START & STUDENT TRANSITION TESTS PASSED 100%!');
  } finally {
    try {
      const sUrl = 'https://hkonbtrxmsxisggcxpww.supabase.co';
      const sKey = 'sb_publishable__8XHrx1z8XIXWXRLvKE-ng_Ap2p1Ev0';
      await fetch(`${sUrl}/rest/v1/broadcast_schedules?id=eq.${testSessionId}`, {
        method: 'DELETE',
        headers: { apikey: sKey, Authorization: `Bearer ${sKey}` }
      });
    } catch(e) {}
    await browser.close();
    server.close();
  }
}

runTest().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
