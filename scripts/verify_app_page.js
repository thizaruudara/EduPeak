const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  
  // 1. Home page unified app & peakbot section
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'commit' });
  await page.waitForSelector('#peakbot', { timeout: 15000 });
  await page.evaluate(() => {
    const p = document.getElementById('sitePreloader');
    if (p) p.remove();
    if (document.documentElement) document.documentElement.classList.remove('is-preloading');
    if (document.body) document.body.classList.remove('is-preloading');
  });
  const unifiedSection = await page.$('#peakbot');
  if (unifiedSection) {
    await unifiedSection.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 600));
    await unifiedSection.screenshot({ path: 'test-screenshots/home_page_unified_section.png' });
    console.log('Unified home section screenshot captured');

    // Switch to bot tab
    const botTabBtn = await page.$('#tabBtnBot');
    if (botTabBtn) {
      await botTabBtn.click();
      await new Promise(r => setTimeout(r, 600));
      await unifiedSection.screenshot({ path: 'test-screenshots/home_page_unified_bot_tab.png' });
      console.log('Unified home section Bot tab screenshot captured');
    }
  }

  // 2. Dedicated App page hero
  await page.goto('http://localhost:3000/app.html', { waitUntil: 'commit' });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'test-screenshots/app_page_hero_updated.png', fullPage: false });
  console.log('App page hero updated screenshot captured');

  // 3. Features grid & Card 7
  await page.evaluate(() => window.scrollTo(0, 1600));
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: 'test-screenshots/app_page_features_updated.png', fullPage: false });
  console.log('App page features updated screenshot captured');

  const card7 = await page.$('.feature-card-wide');
  if (card7) {
    await card7.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'test-screenshots/app_page_card7.png', fullPage: false });
    console.log('Card 7 screenshot captured');
  }

  // 4. Mobile viewport verification
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'commit' });
  await new Promise(r => setTimeout(r, 2500));
  await page.evaluate(() => {
    const p = document.getElementById('sitePreloader');
    if (p) p.remove();
    if (document.documentElement) document.documentElement.classList.remove('is-preloading');
    if (document.body) document.body.classList.remove('is-preloading');
  });
  const mAppSection = await page.$('#peakbot');
  if (mAppSection) {
    await mAppSection.scrollIntoViewIfNeeded();
    await new Promise(r => setTimeout(r, 500));
    await mAppSection.screenshot({ path: 'test-screenshots/home_page_app_mobile.png' });
    console.log('Mobile home app section screenshot captured');
  }

  await page.goto('http://localhost:3000/app.html', { waitUntil: 'commit' });
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: 'test-screenshots/app_page_mobile.png', fullPage: false });
  console.log('Mobile app page screenshot captured');

  await browser.close();
})();
