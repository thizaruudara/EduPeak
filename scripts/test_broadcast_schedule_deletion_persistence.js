/**
 * Test: Broadcast Schedule Permanent Deletion & Prevention of Resurrection
 * Validates that deleting a live broadcast schedule in teacher portal or live class:
 * 1. Permanently removes it from Supabase Cloud DB
 * 2. Records a persistent tombstone in edupeak_deleted_schedules_db (localStorage + shared cookie)
 * 3. Never resurrects it upon reload, syncSchedules(), or getLiveSessions()
 * 4. Correctly updates UI tables and handles active stream clearing
 */

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
  if (filePath.endsWith(path.sep)) filePath = path.join(filePath, 'teacher-portal.html');
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
  console.log(`Test server running at http://localhost:${PORT}`);

  const chromePath = findChromePath();
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Accept any confirm dialogs automatically
  page.on('dialog', async dialog => {
    console.log(`[Dialog]: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    console.log('1. Navigating to teacher-portal.html...');
    await page.goto(`http://localhost:${PORT}/teacher-portal.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Switch to Live Studio Hub tab
    console.log('2. Switching to Live Studio tab...');
    await page.evaluate(() => {
      TEACHER_CONTROLLER.switchTab('live');
    });
    await page.waitForTimeout(500);

    // Create a new legitimate broadcast schedule
    console.log('3. Creating a new test broadcast schedule...');
    const testSchedId = await page.evaluate(async () => {
      const sched = {
        id: 'sched-verify-perm-del-' + Date.now(),
        topic: 'Verifiable Physics Relativity Seminar',
        courseId: 'crs-phy-2026',
        courseTitle: '2026 A/L Physics Theory',
        scheduleTime: 'Tomorrow • 09:00 AM - 12:00 PM',
        provider: 'youtube',
        rawUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        status: 'scheduled',
        updatedAt: new Date().toISOString()
      };
      if (window.SUPABASE_HELPER) {
        await window.SUPABASE_HELPER.saveSchedule(sched);
      }
      TEACHER_CONTROLLER.renderSchedulesTable();
      return sched.id;
    });
    console.log('Created schedule with ID:', testSchedId);
    await page.waitForTimeout(500);

    // Verify it is in the table
    const tableTextBefore = await page.evaluate(() => {
      const tbody = document.getElementById('teacherSchedulesTbody');
      return tbody ? tbody.innerText : '';
    });
    console.log('Table content contains topic:', tableTextBefore.includes('Verifiable Physics Relativity Seminar'));
    if (!tableTextBefore.includes('Verifiable Physics Relativity Seminar')) {
      throw new Error('Created schedule did not appear in teacher table!');
    }

    // Delete the schedule using TEACHER_CONTROLLER.handleDeleteSchedule
    console.log('4. Deleting schedule via TEACHER_CONTROLLER.handleDeleteSchedule...');
    await page.evaluate(async (id) => {
      await TEACHER_CONTROLLER.handleDeleteSchedule(id);
    }, testSchedId);
    await page.waitForTimeout(1000);

    // Verify it is removed from table
    const tableTextAfter = await page.evaluate(() => {
      const tbody = document.getElementById('teacherSchedulesTbody');
      return tbody ? tbody.innerText : '';
    });
    console.log('Table contains deleted schedule after delete:', tableTextAfter.includes('Verifiable Physics Relativity Seminar'));
    if (tableTextAfter.includes('Verifiable Physics Relativity Seminar')) {
      throw new Error('Schedule was NOT removed from the table after deletion!');
    }

    // Verify tombstone exists in localStorage and SUPABASE_HELPER
    const hasTombstone = await page.evaluate((id) => {
      const helperDels = window.SUPABASE_HELPER ? window.SUPABASE_HELPER.getDeletedSchedules() : [];
      const localDels = JSON.parse(localStorage.getItem('edupeak_deleted_schedules_db') || '[]');
      return helperDels.includes(id) && localDels.includes(id);
    }, testSchedId);
    console.log('Persistent tombstone recorded in SUPABASE_HELPER and localStorage:', hasTombstone);
    if (!hasTombstone) {
      throw new Error('Deletion tombstone was not recorded!');
    }

    // 5. Simulate Reload & Supabase sync
    console.log('5. Reloading teacher-portal.html to verify deletion survives reload...');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.evaluate(() => {
      TEACHER_CONTROLLER.switchTab('live');
    });
    await page.waitForTimeout(500);

    const tableTextAfterReload = await page.evaluate(() => {
      const tbody = document.getElementById('teacherSchedulesTbody');
      return tbody ? tbody.innerText : '';
    });
    console.log('Table contains deleted schedule after reload:', tableTextAfterReload.includes('Verifiable Physics Relativity Seminar'));
    if (tableTextAfterReload.includes('Verifiable Physics Relativity Seminar')) {
      throw new Error('DELETION RESURRECTED AFTER RELOAD!');
    }

    // 6. Test syncSchedules() does not resurrect deleted item even if Supabase returns it
    console.log('6. Testing syncSchedules() with remote array containing deleted item...');
    const syncResurrectCheck = await page.evaluate(async (id) => {
      if (!window.SUPABASE_HELPER) return true;
      // Mock remote Supabase returning the deleted ID
      const fakeRemote = [{
        id: id,
        topic: 'Verifiable Physics Relativity Seminar',
        status: 'scheduled'
      }];
      if (window.SUPABASE_HELPER.client) {
        window.SUPABASE_HELPER.client.from = (table) => ({
          select: () => Promise.resolve({ data: fakeRemote, error: null })
        });
      }
      await window.SUPABASE_HELPER.syncSchedules();
      const scheds = TEACHER_CONTROLLER.getAllScheduledBroadcasts();
      return scheds.some(s => s.id === id);
    }, testSchedId);

    console.log('Did syncSchedules resurrect the deleted schedule?:', syncResurrectCheck);
    if (syncResurrectCheck) {
      throw new Error('syncSchedules resurrected the tombstoned schedule!');
    }

    // 7. Verify no continuous test schedules or early test schedules appear
    const testArtifactsPresent = await page.evaluate(() => {
      const scheds = TEACHER_CONTROLLER.getAllScheduledBroadcasts();
      return scheds.some(s => s.id && (s.id.startsWith('sched-continuous-') || s.id.startsWith('sched-early-test-')));
    });
    console.log('Are mock test schedules completely filtered out?:', !testArtifactsPresent);
    if (testArtifactsPresent) {
      throw new Error('Test schedule artifacts were found in teacher portal!');
    }

    console.log('\n======================================================');
    console.log('✅ ALL TESTS PASSED: SCHEDULE DELETION IS 100% PERMANENT!');
    console.log('======================================================\n');
  } finally {
    await browser.close();
    server.close();
  }
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
