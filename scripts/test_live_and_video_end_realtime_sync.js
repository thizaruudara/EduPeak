/**
 * End-to-End Test: Live Stream & Video Ended Auto-Conclusion and Cross-Tab Real-time Sync
 */
const { chromium } = require('playwright-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

const PORT = 8092;
const BASE_URL = `http://localhost:${PORT}`;

function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(__dirname, '..', reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found: ' + reqPath);
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`Test server running at ${BASE_URL}`);
      resolve(server);
    });
  });
}

(async () => {
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();

  try {
    const testSessionId = 'sched-stream-test-' + Date.now();
    const testStream = {
      id: testSessionId,
      scheduleId: testSessionId,
      topic: 'Physics Masterclass Live Ending Test',
      provider: 'youtube',
      rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      status: 'live',
      startedAt: new Date(Date.now() - 60000).toISOString(),
      scheduleDate: '2026-09-11',
      scheduleStartTime: '09:00',
      scheduleEndTime: '11:00',
      scheduleTime: 'Today • 09:00 AM - 11:00 AM',
      teacherName: 'Dr. K. Perera',
      subject: 'Physics',
      examYear: '2026 A/L',
      watermarkEnabled: true,
      chatEnabled: true,
      viewersCount: 1
    };

    console.log('\n--- 1. Testing Teacher Ending Live Broadcast in Real-Time ---');
    // Tab 1: Student viewing the live stream
    const studentPage = await context.newPage();
    await studentPage.goto(`${BASE_URL}/live-class.html?stream=${testSessionId}`, { waitUntil: 'domcontentloaded' });

    await studentPage.evaluate((stream) => {
      localStorage.setItem('edupeak_schedules_db', JSON.stringify([stream]));
      localStorage.setItem('edupeak_live_stream_config', JSON.stringify(stream));
      localStorage.setItem('edupeak_session_started_' + stream.id, stream.startedAt);
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'std-test-1',
        name: 'Kasun Bandara',
        email: 'kasun@test.com',
        role: 'student',
        nic: '200512345678'
      }));
    }, testStream);

    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    const initialStatus = await studentPage.evaluate(() => {
      const livePlayer = document.getElementById('edupeakLivePlayerWrapper');
      const endedScreen = document.getElementById('liveEndedScreen');
      return {
        sessionStatus: window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : null,
        playerVisible: livePlayer && livePlayer.style.display !== 'none',
        endedScreenVisible: endedScreen && endedScreen.style.display !== 'none'
      };
    });

    console.log('Student tab before teacher ends stream:', initialStatus);
    if (initialStatus.sessionStatus !== 'live' || !initialStatus.playerVisible) {
      throw new Error(`FAIL: Expected live stream to be active initially (got status: ${initialStatus.sessionStatus})`);
    }
    console.log('✓ PASS: Student is actively watching live stream with player visible!');

    // Tab 2: Teacher Portal
    const teacherPage = await context.newPage();
    await teacherPage.goto(`${BASE_URL}/teacher-portal.html`, { waitUntil: 'domcontentloaded' });
    await teacherPage.evaluate((stream) => {
      localStorage.setItem('edupeak_auth_user', JSON.stringify({
        id: 'tch-amalsha',
        name: 'Dr. K. Perera',
        email: 'teacher@test.com',
        role: 'teacher'
      }));
    }, testStream);
    await teacherPage.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Teacher triggers endLiveBroadcast from Teacher Portal...');
    const teacherEndResult = await teacherPage.evaluate((streamId) => {
      const hasController = Boolean(window.TEACHER_CONTROLLER);
      const allScheds = window.TEACHER_CONTROLLER ? window.TEACHER_CONTROLLER.getAllScheduledBroadcasts() : [];
      const targetSched = allScheds.find(s => s.id === streamId);
      if (window.TEACHER_CONTROLLER && typeof window.TEACHER_CONTROLLER.endLiveBroadcast === 'function') {
        window.TEACHER_CONTROLLER.endLiveBroadcast(streamId);
      }
      const schedsAfter = window.TEACHER_CONTROLLER ? window.TEACHER_CONTROLLER.getAllScheduledBroadcasts() : [];
      const targetAfter = schedsAfter.find(s => s.id === streamId);
      return {
        hasController,
        foundBefore: Boolean(targetSched),
        statusAfter: targetAfter ? targetAfter.status : null,
        schedsCount: allScheds.length
      };
    }, testSessionId);
    console.log('Teacher controller execution debug:', teacherEndResult);

    // Give student tab a moment to react via BroadcastChannel or liveStatusWatcher
    await new Promise(r => setTimeout(r, 1200));

    const studentStatusAfterTeacherEnd = await studentPage.evaluate(() => {
      const livePlayer = document.getElementById('edupeakLivePlayerWrapper');
      const endedScreen = document.getElementById('liveEndedScreen');
      return {
        sessionStatus: window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : null,
        playerVisible: livePlayer && livePlayer.style.display !== 'none',
        endedScreenVisible: endedScreen && endedScreen.style.display !== 'none'
      };
    });

    console.log('Student tab after teacher ends live stream:', studentStatusAfterTeacherEnd);
    if (studentStatusAfterTeacherEnd.sessionStatus !== 'ended') {
      throw new Error(`FAIL: Student session status should be 'ended', got '${studentStatusAfterTeacherEnd.sessionStatus}'`);
    }
    if (studentStatusAfterTeacherEnd.playerVisible) {
      throw new Error('FAIL: Player wrapper should be hidden after stream ends');
    }
    if (!studentStatusAfterTeacherEnd.endedScreenVisible) {
      throw new Error('FAIL: Ended screen should be visible to student');
    }
    console.log('✓ PASS: Student screen automatically switched to ended screen when teacher ended the broadcast!');

    console.log('\n--- 2. Testing Reload Persistence After Live Ending ---');
    await studentPage.reload({ waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));

    const studentStatusAfterReload = await studentPage.evaluate(() => {
      const livePlayer = document.getElementById('edupeakLivePlayerWrapper');
      const endedScreen = document.getElementById('liveEndedScreen');
      return {
        sessionStatus: window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : null,
        playerVisible: livePlayer && livePlayer.style.display !== 'none',
        endedScreenVisible: endedScreen && endedScreen.style.display !== 'none'
      };
    });

    console.log('Student tab after reload:', studentStatusAfterReload);
    if (studentStatusAfterReload.sessionStatus !== 'ended' || !studentStatusAfterReload.endedScreenVisible) {
      throw new Error('FAIL: Reload resurrected live stream or failed to show ended screen');
    }
    console.log('✓ PASS: Ended broadcast remains ended on page reload without resurrecting!');

    console.log('\n--- 3. Testing Video Ended Auto-Conclusion in Custom Player ---');
    // Start a new test live stream where video ends
    const testVideoSessionId = 'sched-vid-end-' + Date.now();
    const testVideoSession = {
      ...testStream,
      id: testVideoSessionId,
      scheduleId: testVideoSessionId,
      topic: 'Pre-recorded Video Broadcast Auto-End Test',
      status: 'live'
    };

    await studentPage.evaluate((stream) => {
      let scheds = JSON.parse(localStorage.getItem('edupeak_schedules_db') || '[]');
      scheds.unshift(stream);
      localStorage.setItem('edupeak_schedules_db', JSON.stringify(scheds));
      localStorage.setItem('edupeak_live_stream_config', JSON.stringify(stream));
      localStorage.setItem('edupeak_last_active_stream', stream.id);
    }, testVideoSession);

    await studentPage.goto(`${BASE_URL}/live-class.html?stream=${testVideoSessionId}`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1200));

    console.log('Simulating video completion (triggerLiveEnded)...');
    await studentPage.evaluate(() => {
      if (window.EDUPEAK_LIVE_PLAYER && typeof window.EDUPEAK_LIVE_PLAYER.triggerLiveEnded === 'function') {
        window.EDUPEAK_LIVE_PLAYER.triggerLiveEnded();
      }
    });

    await new Promise(r => setTimeout(r, 600));

    const statusAfterVideoEnd = await studentPage.evaluate(() => {
      const livePlayer = document.getElementById('edupeakLivePlayerWrapper');
      const endedScreen = document.getElementById('liveEndedScreen');
      return {
        sessionStatus: window.LIVE_APP && window.LIVE_APP.activeSession ? window.LIVE_APP.activeSession.status : null,
        playerVisible: livePlayer && livePlayer.style.display !== 'none',
        endedScreenVisible: endedScreen && endedScreen.style.display !== 'none'
      };
    });

    console.log('Status after video completed:', statusAfterVideoEnd);
    if (statusAfterVideoEnd.sessionStatus !== 'ended' || !statusAfterVideoEnd.endedScreenVisible) {
      throw new Error('FAIL: Video completion failed to trigger stream conclusion');
    }
    console.log('✓ PASS: Video completion instantly triggered stream conclusion and ended screen!');

    console.log('\n======================================================');
    console.log('🎉 ALL LIVE & VIDEO ENDED AUTO-CONCLUSION TESTS PASSED 100%!');
    console.log('======================================================');

  } finally {
    await browser.close();
    server.close();
  }
})();
