const http = require('http');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PORT = 5096;
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
      if (reqPath === '/' || reqPath === '') reqPath = '/admin.html';

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

async function run() {
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERR:', err));

  try {
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForLoadState('networkidle');

    // Bypass login by setting active admin session in localStorage
    await page.evaluate(() => {
      localStorage.setItem('edupeak_current_user', JSON.stringify({
        id: 'usr_admin_test',
        fullName: 'Admin Test',
        email: 'thisarunew@gmail.com',
        role: 'admin'
      }));
    });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Clean up any test courses from previous runs
    await page.evaluate(async () => {
      const all = await window.SUPABASE_HELPER.getCourses();
      for (const c of all) {
        if (c.title === '2027 Advanced Mechanics Special') {
          await window.SUPABASE_HELPER.deleteCourse(c.id);
        }
      }
    });
    await page.waitForTimeout(400);

    console.log('1. Opening Add Course Modal...');
    await page.evaluate(() => {
      ADMIN_CONTROLLER.openAddCourseModal();
    });
    await page.waitForTimeout(300);

    const isModalActive = await page.locator('#adminCourseDrawerModal').evaluate(el => el.classList.contains('active'));
    console.log('Add Course Modal active:', isModalActive);
    if (!isModalActive) throw new Error('Modal failed to open');

    // Check defaults
    const feeVal = await page.inputValue('#courseFormFee');
    const medVal = await page.inputValue('#courseFormMedium');
    const dayVal = await page.inputValue('#courseFormScheduleDay');
    console.log('Defaults verified:', { feeVal, medVal, dayVal });

    if (feeVal !== 'LKR 3,500 / Month') throw new Error('Default fee not LKR 3,500 / Month');
    if (medVal !== 'Sinhala & English Medium') throw new Error('Default medium not Sinhala & English Medium');
    if (dayVal !== 'Every Saturday') throw new Error('Default day not Every Saturday');

    // Test toggling custom fee
    console.log('2. Testing Custom Fee Selection...');
    await page.selectOption('#courseFormFee', 'custom');
    let isFeeCustomVisible = await page.isVisible('#courseFormFeeCustom');
    console.log('Fee custom input visible:', isFeeCustomVisible);
    if (!isFeeCustomVisible) throw new Error('Fee custom input should be visible');
    await page.fill('#courseFormFeeCustom', 'LKR 4,200 / Month');

    // Test toggling custom day
    console.log('3. Testing Custom Day Selection...');
    await page.selectOption('#courseFormScheduleDay', 'custom');
    let isDayCustomVisible = await page.isVisible('#courseFormScheduleDayCustom');
    console.log('Day custom input visible:', isDayCustomVisible);
    if (!isDayCustomVisible) throw new Error('Day custom input should be visible');
    await page.fill('#courseFormScheduleDayCustom', 'Every Poya Day & Wednesday');

    // Test toggling custom medium
    console.log('4. Testing Custom Medium Selection...');
    await page.selectOption('#courseFormMedium', 'custom');
    let isMedCustomVisible = await page.isVisible('#courseFormMediumCustom');
    console.log('Medium custom input visible:', isMedCustomVisible);
    if (!isMedCustomVisible) throw new Error('Medium custom input should be visible');
    await page.fill('#courseFormMediumCustom', 'English Medium Specialized');

    // Fill title
    await page.fill('#courseFormTitle', '2027 Advanced Mechanics Special');

    // Save Course
    console.log('5. Submitting Course Form...');
    await page.evaluate(async () => {
      await ADMIN_CONTROLLER.handleSaveCourseSubmit(new Event('submit'));
    });
    await page.waitForTimeout(500);

    // Check existing courses structure
    const courses = await page.evaluate(async () => {
      return await window.SUPABASE_HELPER.getCourses();
    });
    console.log('Sample course from Supabase:', courses[0]);
    const saved = courses.find(c => c.title === '2027 Advanced Mechanics Special');
    console.log('Saved Course verified:', saved ? {
      title: saved.title,
      fee: saved.fee,
      medium: saved.medium,
      liveTime: saved.liveTime
    } : null);

    if (!saved) throw new Error('Saved course not found in database');
    if (saved.fee !== 'LKR 4,200 / Month') throw new Error(`Expected custom fee LKR 4,200 / Month, got ${saved.fee}`);
    if (saved.medium !== 'English Medium Specialized') throw new Error(`Expected custom medium English Medium Specialized, got ${saved.medium}`);
    if (!saved.liveTime.includes('Every Poya Day & Wednesday')) throw new Error(`Expected custom day in liveTime, got ${saved.liveTime}`);

    console.log('6. Testing Edit Modal on newly created course with custom values...');
    await page.evaluate((id) => {
      ADMIN_CONTROLLER.openEditCourseModal(id);
    }, saved.id);
    await page.waitForTimeout(300);

    const editFeeVal = await page.inputValue('#courseFormFee');
    const editFeeCustomVal = await page.inputValue('#courseFormFeeCustom');
    const editDayVal = await page.inputValue('#courseFormScheduleDay');
    const editDayCustomVal = await page.inputValue('#courseFormScheduleDayCustom');
    const editMedVal = await page.inputValue('#courseFormMedium');
    const editMedCustomVal = await page.inputValue('#courseFormMediumCustom');

    console.log('Edit Modal Populated State:', {
      editFeeVal,
      editFeeCustomVal,
      editDayVal,
      editDayCustomVal,
      editMedVal,
      editMedCustomVal
    });

    if (editFeeVal !== 'custom' || editFeeCustomVal !== 'LKR 4,200 / Month') {
      throw new Error('Edit modal did not correctly restore custom fee');
    }
    if (editDayVal !== 'custom' || editDayCustomVal !== 'Every Poya Day & Wednesday') {
      throw new Error('Edit modal did not correctly restore custom day');
    }
    if (editMedVal !== 'custom' || editMedCustomVal !== 'English Medium Specialized') {
      throw new Error('Edit modal did not correctly restore custom medium');
    }

    console.log('7. Testing switching back from custom to standard preset dropdown options...');
    await page.selectOption('#courseFormFee', 'LKR 3,000 / Month');
    await page.evaluate(() => ADMIN_CONTROLLER.toggleCourseFeeCustom('LKR 3,000 / Month'));
    await page.selectOption('#courseFormScheduleDay', 'Every Sunday');
    await page.evaluate(() => ADMIN_CONTROLLER.toggleCourseScheduleDayCustom('Every Sunday'));
    await page.selectOption('#courseFormMedium', 'Sinhala Medium (සිංහල මාධ්‍ය)');
    await page.evaluate(() => ADMIN_CONTROLLER.toggleCourseMediumCustom('Sinhala Medium (සිංහල මාධ්‍ය)'));

    isFeeCustomVisible = await page.isVisible('#courseFormFeeCustom');
    isDayCustomVisible = await page.isVisible('#courseFormScheduleDayCustom');
    isMedCustomVisible = await page.isVisible('#courseFormMediumCustom');

    if (isFeeCustomVisible || isDayCustomVisible || isMedCustomVisible) {
      throw new Error('Custom inputs should be hidden when selecting standard dropdown option');
    }

    // Save edited course
    await page.evaluate(async () => {
      await ADMIN_CONTROLLER.handleSaveCourseSubmit(new Event('submit'));
    });
    await page.waitForTimeout(500);

    const updatedCourses = await page.evaluate(async () => {
      return await window.SUPABASE_HELPER.getCourses();
    });
    const updated = updatedCourses.find(c => c.id === saved.id);
    console.log('Updated Course verified:', {
      fee: updated.fee,
      medium: updated.medium,
      liveTime: updated.liveTime
    });

    if (updated.fee !== 'LKR 3,000 / Month') throw new Error('Updated fee incorrect');
    if (updated.medium !== 'Sinhala Medium (සිංහල මාධ්‍ය)') throw new Error('Updated medium incorrect');
    if (!updated.liveTime.includes('Every Sunday')) throw new Error('Updated liveTime day incorrect');

    console.log('✅ ALL COURSE DROPDOWNS, SELECTION MENUS & CUSTOM DAY / FEE / MEDIUM VERIFIED 100%!');

    // Cleanup test course
    await page.evaluate((id) => {
      ADMIN_CONTROLLER.deleteCourse(id);
    }, saved.id);

  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
    server.close();
    process.exit(process.exitCode || 0);
  }
}

run();
