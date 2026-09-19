const { chromium } = require('playwright-core');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 420, height: 900 },
    deviceScaleFactor: 2
  });

  const filePath = 'file:///' + path.resolve(__dirname, 'render_app_ui.html').replace(/\\/g, '/');
  await page.goto(filePath, { waitUntil: 'networkidle' });
  await new Promise(r => setTimeout(r, 1000));

  const appScreen = await page.$('#appScreenContainer');
  if (appScreen) {
    const outPath = path.resolve(__dirname, '..', 'assets', 'img', 'edupeak_app_ui_screen.png');
    await appScreen.screenshot({ path: outPath });
    console.log('App UI image generated successfully at:', outPath);
  } else {
    console.error('Error: #appScreenContainer not found');
  }

  await browser.close();
})();
