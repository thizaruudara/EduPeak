const { chromium } = require('playwright-core');
const path = require('path');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\56cf55bd-d563-4fd7-a54f-6ca56f007007';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1100 });
  
  // Set student user session in localStorage before loading checkout.html
  await page.goto('http://localhost:5050/student-dashboard.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const studentUser = {
      id: "EP-2027-001",
      name: "Kasun Jayasundara",
      nic: "200512345678",
      email: "student@edupeak.lk",
      phone: "0771234567",
      examYear: "2027 A/L",
      stream: "Physical Science",
      school: "President's College Embilipitiya",
      district: "Ratnapura",
      address: "Victory College, Embilipitiya Pallegama, Sri Lanka",
      role: "student"
    };
    localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
  });

  await page.goto('http://localhost:5050/checkout.html?course=crs-phy-2028-theory', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Check the batch mismatch checkbox
  await page.check('#confirmDifferentBatchCheckbox');

  // Fill order notes
  await page.fill('#orderNotesInput', 'Please send English medium handouts');

  // Click Order & Enroll through WhatsApp button
  await page.click('#btnOrderWhatsApp');
  await page.waitForTimeout(600);

  // Verify modal is active
  const modalActive = await page.evaluate(() => {
    const modal = document.getElementById('checkoutSuccessModal');
    return modal && modal.classList.contains('active');
  });

  const lastUrl = await page.evaluate(() => window.lastGeneratedWaUrl || '');
  console.log('Modal active:', modalActive);
  console.log('Generated WhatsApp URL:', decodeURIComponent(lastUrl));

  const screenshotPath = path.join(ARTIFACTS_DIR, 'checkout_whatsapp_modal.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
})();
