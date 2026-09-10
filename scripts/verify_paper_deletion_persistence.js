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

async function testPaperDeletion() {
  const server = await startServer();
  const executablePath = findChromePath();
  const browser = await chromium.launch({
    executablePath,
    headless: true, // 100% background headless execution (No window opened)
  });

  try {
    const page = await browser.newPage();

    // Auto-accept confirm dialogs
    page.on('dialog', async dialog => {
      console.log(`[Dialog Auto-Accepted]: ${dialog.message()}`);
      await dialog.accept();
    });

    // 1. Go to Admin page
    console.log('Navigating to admin.html...');
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForTimeout(600);

    // 2. Sign in as admin
    await page.fill('#adminGateEmail', 'admin@edupeak.lk');
    await page.fill('#adminGatePassword', 'admin123');
    await page.click('#adminGateSubmitBtn');
    await page.waitForTimeout(1000);

    // 3. Switch to Papers Tab
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('papers'));
    await page.waitForTimeout(600);

    const initialCount = await page.locator('#adminPapersTableBody tr').count();
    console.log(`Initial papers count in Admin: ${initialCount}`);

    // 4. Delete papers one by one until 0
    let papers = await page.evaluate(() => window.SUPABASE_HELPER.getPapers());
    console.log(`Papers in database before deletions: ${papers.length}`);

    for (const p of papers) {
      console.log(`Deleting paper: ${p.id} (${p.title})...`);
      await page.evaluate(async (id) => {
        await window.ADMIN_CONTROLLER.deletePaper(id);
      }, p.id);
      await page.waitForTimeout(300);
    }

    // 5. Verify in Admin Table
    const countAfterAllDeleted = await page.locator('#adminPapersTableBody tr').count();
    const emptyNotice = await page.locator('#adminPapersTableBody').textContent();
    console.log(`Rows in Admin table after deleting all: ${countAfterAllDeleted}`);
    console.log(`Table notice text: "${emptyNotice.trim()}"`);

    const dbPapers = await page.evaluate(() => window.SUPABASE_HELPER.getPapers());
    console.log(`Papers in database after deleting all: ${dbPapers.length}`);

    if (dbPapers.length !== 0) {
      throw new Error(`FAILED: Database returned ${dbPapers.length} papers when 0 expected! Defaults were regenerated.`);
    }

    // 6. Reload page to verify persistence across reloads
    console.log('Reloading admin page to test reload persistence...');
    await page.reload();
    await page.waitForTimeout(600);
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('papers'));
    await page.waitForTimeout(600);

    const dbPapersAfterReload = await page.evaluate(() => window.SUPABASE_HELPER.getPapers());
    console.log(`Papers in database after page reload: ${dbPapersAfterReload.length}`);

    if (dbPapersAfterReload.length !== 0) {
      throw new Error(`FAILED: After page reload, database resurrected ${dbPapersAfterReload.length} papers!`);
    }

    // 7. Verify on past-papers.html page as well
    console.log('Navigating to past-papers.html to verify student view...');
    await page.goto(`http://127.0.0.1:${PORT}/past-papers.html`);
    await page.waitForTimeout(600);

    const studentPaperCards = await page.locator('#papersGridContainer .paper-card').count();
    const studentEmptyNotice = await page.locator('#papersGridContainer').textContent();
    console.log(`Paper cards on student past-papers.html: ${studentPaperCards}`);
    console.log(`Student empty notice: "${studentEmptyNotice.trim()}"`);

    if (studentPaperCards !== 0) {
      throw new Error(`FAILED: Student paper vault rendered ${studentPaperCards} cards when 0 expected!`);
    }

    // 8. Add a new paper to verify adding works when database is empty
    console.log('Testing adding a new paper from empty state...');
    await page.goto(`http://127.0.0.1:${PORT}/admin.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => window.ADMIN_CONTROLLER.switchTab('papers'));
    await page.waitForTimeout(600);

    await page.evaluate(async () => {
      const newPaper = {
        id: "pap-new-custom-2026",
        title: "2026 Physics Special Model Paper by Master Lecturer",
        title_si: "2026 භෞතික විද්‍යා විශේෂ ආදර්ශ ප්‍රශ්න පත්‍රය",
        year: 2026,
        type: "model",
        unit: "mechanics",
        unitName: "Mechanics & Thermal",
        size: "3.2 MB",
        url: "assets/docs/model_2026.pdf"
      };
      await window.SUPABASE_HELPER.savePaper(newPaper);
      await window.ADMIN_CONTROLLER.renderPapers();
    });

    const finalCount = await page.locator('#adminPapersTableBody tr').count();
    const finalDb = await page.evaluate(() => window.SUPABASE_HELPER.getPapers());
    console.log(`Papers count after adding 1 new paper: ${finalDb.length} (DOM rows: ${finalCount})`);

    if (finalDb.length !== 1 || finalDb[0].id !== "pap-new-custom-2026") {
      throw new Error(`FAILED: Adding new paper did not produce exactly 1 custom paper!`);
    }

    console.log('\n🎉 ALL PERSISTENCE AND DELETION TESTS PASSED 100%! ZERO GHOST RESURRECTIONS!');
  } finally {
    await browser.close();
    server.close();
  }
}

testPaperDeletion().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
