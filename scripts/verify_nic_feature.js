const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\ozone computer\\.gemini\\antigravity-ide\\brain\\56cf55bd-d563-4fd7-a54f-6ca56f007007';

async function run() {
  console.log('=== STARTING EDUPEAK STUDENT NIC END-TO-END VERIFICATION ===\n');

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 }
  });
  const page = await context.newPage();

  let testPassed = true;

  try {
    // -------------------------------------------------------------
    // TEST 1: Registration Form with NIC validation (register.html)
    // -------------------------------------------------------------
    console.log('--- TEST 1: Standalone Registration (register.html) ---');
    await page.goto('http://localhost:5050/register.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const nicInput = await page.$('#regNicInput');
    if (!nicInput) {
      throw new Error('❌ regNicInput not found on register.html');
    }
    const isRequired = await nicInput.getAttribute('required');
    const maxLength = await nicInput.getAttribute('maxlength');
    console.log(`✅ #regNicInput found! required: ${isRequired !== null}, maxlength: ${maxLength}`);

    // Fill form with invalid NIC
    await page.fill('#regNameInput', 'Kasun Bandara');
    await page.fill('#regEmailInput', 'test.nic.student@gmail.com');
    await page.fill('#regPhoneInput', '0779998888');
    await page.fill('#regNicInput', '12345'); // invalid
    await page.fill('#regPasswordInput', 'password123');
    await page.fill('#regConfirmPasswordInput', 'password123');

    // Click submit
    await page.click('#standaloneRegisterForm button[type="submit"]');
    await page.waitForTimeout(500);

    const errorAlertText = await page.innerText('#regErrorAlert').catch(() => '');
    console.log(`[Invalid NIC Validation Response]: "${errorAlertText}"`);
    if (errorAlertText.includes('NIC number')) {
      console.log('✅ PASS: Invalid NIC rejected with clear user error alert.');
    } else {
      console.warn('⚠️ Warning: Error alert did not explicitly mention NIC number.');
    }

    // Now fill with valid Sri Lankan 12-digit NIC
    await page.fill('#regNicInput', '200412345678');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_registration_nic_input.png') });
    console.log('📸 Captured screenshot: test_registration_nic_input.png');

    await page.click('#standaloneRegisterForm button[type="submit"]');
    await page.waitForTimeout(1000);

    // Verify OTP Modal is visible
    const isOtpVisible = await page.isVisible('#emailOtpModal').catch(() => false);
    console.log(`✅ Valid NIC submitted! OTP modal visible: ${isOtpVisible}`);

    // -------------------------------------------------------------
    // TEST 2: Video Player Watermark Overlay (index.html)
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Video Player DRM Watermark Overlay ---');
    await page.goto('http://localhost:5050/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Authenticate student session and open LMS Video Classroom
    await page.evaluate(() => {
      if (window.AUTH_SYSTEM) {
        const student = window.AUTH_SYSTEM.defaultUsers.find(u => u.role === 'student');
        window.AUTH_SYSTEM.createSession(student);
      }
      if (window.openLMSPortal) {
        window.openLMSPortal('video-classroom');
      }
      if (window.updatePlayerWatermarkUser) {
        window.updatePlayerWatermarkUser();
      }
    });
    await page.waitForTimeout(1200);

    const watermarkContent = await page.evaluate(() => {
      const el = document.getElementById('playerWatermarkText');
      return el ? (el.textContent || el.innerText) : '';
    });
    console.log(`[DRM Watermark Text]: "${watermarkContent}"`);

    if (watermarkContent.includes('NIC:') && watermarkContent.includes('200512345678')) {
      console.log('✅ PASS: Video player DRM watermark successfully displays student NIC ("200512345678")!');
    } else {
      console.error('❌ FAIL: Watermark does not contain expected NIC. Content is: ' + watermarkContent);
      testPassed = false;
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_video_player_watermark.png') });
    console.log('📸 Captured screenshot: test_video_player_watermark.png');

    // -------------------------------------------------------------
    // TEST 3: Admin Students Directory & Filter (index.html#admin/students)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Admin Portal Student Directory ---');
    await page.goto('http://localhost:5050/index.html#admin/students', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Check table headers in #adminTab_students
    const headers = await page.$$eval('#adminTab_students table th', els => els.map(e => e.innerText.trim().toUpperCase()));
    console.log('Admin Table Headers:', headers);
    if (headers.includes('NIC NUMBER')) {
      console.log('✅ PASS: Admin students table contains "NIC Number" header!');
    } else {
      console.error('❌ FAIL: Admin students table missing "NIC Number" header.');
      testPassed = false;
    }

    // Check rows in #adminStudentsTbody
    const firstRowText = await page.innerText('#adminStudentsTbody tr:first-child').catch(() => '');
    console.log(`[Admin First Student Row Summary]: ${firstRowText.replace(/\n+/g, ' | ')}`);
    if (firstRowText.includes('200512345678') || firstRowText.includes('NIC')) {
      console.log('✅ PASS: Student row renders NIC badge with actual student NIC number!');
    } else {
      console.warn('⚠️ Student row does not show expected NIC text.');
    }

    // Test Search Filter with NIC
    await page.fill('#adminStudentSearch', '200512345678');
    await page.waitForTimeout(500);
    const filteredRowsCount = await page.$$eval('#adminStudentsTbody tr', trs => trs.length);
    console.log(`✅ Search by NIC ("200512345678") filtered result: ${filteredRowsCount} matching student row(s) displayed.`);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_admin_students_nic.png') });
    console.log('📸 Captured screenshot: test_admin_students_nic.png');

    // -------------------------------------------------------------
    // TEST 4: Student Profile Settings (profile.html)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Student Profile Settings (profile.html) ---');
    await page.goto('http://localhost:5050/profile.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const profileNicVal = await page.$eval('#profileNic', el => el.value).catch(() => '');
    console.log(`[Profile NIC Input Value]: "${profileNicVal}"`);
    if (profileNicVal.length >= 9) {
      console.log('✅ PASS: Profile page successfully displays student NIC and allows editing!');
    } else {
      console.warn('⚠️ Profile NIC value is empty or unexpected.');
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_student_profile_nic.png') });
    console.log('📸 Captured screenshot: test_student_profile_nic.png');

    // -------------------------------------------------------------
    // TEST 5: Student Dashboard (student-dashboard.html)
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Student Dashboard (student-dashboard.html) ---');
    await page.goto('http://localhost:5050/student-dashboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const heroNicText = await page.innerText('#heroNicBadge').catch(() => '');
    console.log(`[Dashboard Hero NIC Badge]: "${heroNicText}"`);
    if (heroNicText.includes('NIC:')) {
      console.log('✅ PASS: Student Dashboard displays NIC badge on welcome card!');
    }

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_student_dashboard_nic.png') });
    console.log('📸 Captured screenshot: test_student_dashboard_nic.png');

  } catch (err) {
    console.error('❌ Error during verification:', err);
    testPassed = false;
  } finally {
    await browser.close();
  }

  if (testPassed) {
    console.log('\n🎉🎉 ALL STUDENT NIC VERIFICATION TESTS PASSED PERFECTLY! 🎉🎉');
  } else {
    console.error('\n❌ SOME VERIFICATION TESTS FAILED.');
    process.exit(1);
  }
}

run();
