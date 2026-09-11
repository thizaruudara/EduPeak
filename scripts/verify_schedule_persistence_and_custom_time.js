/**
 * Automated Verification Script:
 * 1. Verifies that creating a schedule with custom time (e.g. 15:30 - 17:45) saves successfully to Supabase Cloud.
 * 2. Verifies that background syncSchedules() (running every 4s) does NOT wipe the schedule.
 * 3. Verifies that the exact custom time is preserved (does not revert to 08:30 - 12:30).
 * 4. Verifies via Playwright in live-class.html UI that creating a schedule displays it, survives sync intervals, and persists across reload.
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
  if (filePath.endsWith(path.sep) || req.url === '/') filePath = path.join(filePath, 'live-class.html');
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
  console.log(`Server running at http://localhost:${PORT}`);

  const chromePath = findChromePath();
  if (!chromePath) {
    console.error('No Chrome or Edge binary found');
    server.close();
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[Browser ${msg.type()}]:`, msg.text());
    }
  });

  try {
    // 1. Navigate to live-class.html as teacher
    console.log('1. Navigating to live-class.html...');
    await page.goto(`http://localhost:${PORT}/live-class.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    // Set logged-in teacher in localStorage and reload
    await page.evaluate(() => {
      const teacherUser = {
        id: "tch-amalsha",
        name: "Amalsha Wanniarachchi",
        email: "amalsha@edupeak.lk",
        role: "teacher"
      };
      localStorage.setItem("edupeak_user", JSON.stringify(teacherUser));
    });
    await page.reload();
    await page.waitForTimeout(2000);

    // 2. Open Schedule Modal
    console.log('2. Opening Schedule Modal...');
    await page.evaluate(() => {
      if (window.LIVE_APP && typeof window.LIVE_APP.openScheduleModal === 'function') {
        window.LIVE_APP.openScheduleModal();
      } else {
        const btn = document.getElementById('btnOpenScheduleModal') || document.getElementById('btnScheduleFromOffline');
        if (btn) btn.click();
      }
    });
    await page.waitForTimeout(800);

    // Verify modal is visible
    const modalActive = await page.$eval('#scheduleLiveModal', el => el.classList.contains('active'));
    console.log('Schedule modal opened:', modalActive);
    if (!modalActive) throw new Error('Schedule modal failed to open');

    // 3. Fill in custom schedule data with unique time
    const testTopic = `Test Physics Masterclass ${Date.now()}`;
    const customStartTime = "15:45";
    const customEndTime = "18:15";

    console.log(`3. Filling custom schedule: "${testTopic}" with time ${customStartTime} - ${customEndTime}...`);
    await page.fill('#formTopic', testTopic);
    await page.fill('#formStartTime', customStartTime);
    await page.fill('#formEndTime', customEndTime);
    await page.selectOption('#formExamYear', '2027 A/L');
    await page.selectOption('#formStatus', 'scheduled');

    // Submit form
    await page.click('#scheduleLiveModal button[type="submit"]');
    await page.waitForTimeout(2000);

    // 4. Verify schedule card appears in UI
    console.log('4. Verifying schedule card appears in UI...');
    const streamCards = await page.$$eval('.stream-card-title', els => els.map(e => e.textContent.trim()));
    console.log('Found stream titles on screen:', streamCards);
    const foundCard = streamCards.some(t => t.includes(testTopic));
    if (!foundCard) throw new Error(`Created schedule "${testTopic}" not found on screen!`);
    console.log('✓ Schedule successfully appeared on screen!');

    // 5. Verify the time displayed on the card or details is NOT 08:30 - 12:30
    const timeTexts = await page.$$eval('.stream-card-meta, #infoScheduleTime', els => els.map(e => e.textContent.trim()));
    console.log('Stream schedule texts on screen:', timeTexts);
    const hasCustomTime = timeTexts.some(t => t.includes('15:45') || t.includes('3:45') || t.includes('18:15') || t.includes('6:15'));
    console.log('Card displays custom configured time (not default):', hasCustomTime);
    if (!hasCustomTime) {
      throw new Error(`Schedule card did not display the custom time (${customStartTime} - ${customEndTime})! Found: ${timeTexts.join(', ')}`);
    }
    console.log('✓ Custom time correctly rendered on screen!');

    // 6. Wait 8 seconds to allow multiple background sync intervals to run (sync runs every 4s)
    console.log('6. Waiting 8 seconds to test background 4-second cloud sync intervals...');
    await page.waitForTimeout(8000);

    // Verify it has NOT disappeared!
    const cardsAfterSync = await page.$$eval('.stream-card-title', els => els.map(e => e.textContent.trim()));
    console.log('Stream titles after 8s sync:', cardsAfterSync);
    if (!cardsAfterSync.some(t => t.includes(testTopic))) {
      throw new Error(`CRITICAL BUG: Schedule "${testTopic}" DISAPPEARED after background sync!`);
    }
    console.log('✓ Schedule SURVIVED multiple background sync intervals without disappearing!');

    // 7. Verify persistence after a full browser page reload
    console.log('7. Testing persistence across full page reload...');
    await page.reload();
    await page.waitForTimeout(2500);

    const cardsAfterReload = await page.$$eval('.stream-card-title', els => els.map(e => e.textContent.trim()));
    console.log('Stream titles after reload:', cardsAfterReload);
    if (!cardsAfterReload.some(t => t.includes(testTopic))) {
      throw new Error(`CRITICAL BUG: Schedule "${testTopic}" not found after page reload!`);
    }
    console.log('✓ Schedule perfectly persisted across page reload!');

    // 8. Verify the row in Supabase Cloud
    console.log('8. Verifying row existence in Supabase Cloud...');
    const cloudCheck = await page.evaluate(async (topic) => {
      const all = await window.SUPABASE_HELPER.getLiveSessions();
      const match = all.find(s => s.topic === topic);
      return {
        found: Boolean(match),
        id: match ? match.id : null,
        startTime: match ? match.scheduleStartTime : null,
        endTime: match ? match.scheduleEndTime : null,
        courseTitle: match ? match.courseTitle : null
      };
    }, testTopic);

    console.log('Supabase Cloud check result:', cloudCheck);
    if (!cloudCheck.found) throw new Error('Schedule row not found in Supabase Cloud data!');
    if (cloudCheck.startTime !== customStartTime || cloudCheck.endTime !== customEndTime) {
      throw new Error(`Supabase schedule has wrong times: ${cloudCheck.startTime} - ${cloudCheck.endTime}`);
    }
    console.log('✓ Supabase Cloud row verified with exact custom time and metadata!');

    // 9. Clean up test schedule
    console.log('9. Cleaning up test schedule...');
    await page.evaluate(async (id) => {
      await window.SUPABASE_HELPER.deleteLiveSession(id);
    }, cloudCheck.id);
    await page.waitForTimeout(1500);

    console.log('\n========================================');
    console.log('🎉 ALL VERIFICATION CHECKS PASSED!');
    console.log('========================================');

  } catch (err) {
    console.error('Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
  }
}

runTest();
