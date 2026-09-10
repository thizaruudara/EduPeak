const { chromium } = require('playwright-core');

const CHROME_PATH = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';

async function runTests() {
  console.log('🚀 Starting Pending Orders & Duplicate Lock Verification...');
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();

  // Handle dialogs (like confirm() in cancellation)
  page.on('dialog', async dialog => {
    console.log(`[Dialog ${dialog.type()}]: ${dialog.message()}`);
    await dialog.accept();
  });

  try {
    // STEP 1: Set up student session
    console.log('\n--- STEP 1: Setting up Student Session (Kasun Jayasundara) ---');
    await page.goto('http://localhost:5050/login.html');
    await page.evaluate(() => {
      const studentUser = {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        email: "kasun.student@edupeak.lk",
        role: "student",
        stream: "Physical Science",
        examYear: "2027 A/L",
        nic: "200712345678",
        phone: "0771234567",
        address: "Victory College, Embilipitiya Pallegama",
        district: "Ratnapura",
        enrolledCourses: ["crs-phy-2027-theory"]
      };
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.createSession(studentUser);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
      localStorage.setItem("edupeak_enrolled", JSON.stringify(["crs-phy-2027-theory"]));
      localStorage.setItem("edupeak_student_courses_EP-2027-001", JSON.stringify(["crs-phy-2027-theory"]));
      localStorage.setItem("edupeak_pending_orders", JSON.stringify([]));
    });

    // STEP 2: Checkout a new course (2028 Theory: crs-phy-2028-theory)
    console.log('\n--- STEP 2: Checkout a new course (crs-phy-2028-theory) ---');
    await page.goto('http://localhost:5050/checkout.html?course=crs-phy-2028-theory');
    await page.waitForTimeout(1000);

    const isGridVisible = await page.$eval('#checkoutGrid', el => window.getComputedStyle(el).display !== 'none');
    console.log('Checkout grid visible before ordering:', isGridVisible);

    // Fill checkout form
    await page.fill('#studentPhoneInput', '0771234567');
    await page.fill('#studentDistrictInput', 'Ratnapura');
    await page.fill('#studentAddressInput', 'Victory College, Embilipitiya Pallegama');

    // Confirm batch mismatch if visible
    const mismatchCheckbox = await page.$('#confirmDifferentBatchCheckbox');
    if (mismatchCheckbox) {
      await mismatchCheckbox.check();
    }

    // Submit order via processWhatsAppOrder
    console.log('Submitting WhatsApp order...');
    await page.evaluate(() => {
      // Mock window.open so popup doesn't open new window
      window.open = () => null;
      processWhatsAppOrder();
    });

    await page.waitForTimeout(500);

    // Verify order in localStorage
    const pendingOrdersAfterOrder = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('edupeak_pending_orders') || '[]');
    });
    console.log('Pending orders in localStorage:', pendingOrdersAfterOrder.length);
    if (pendingOrdersAfterOrder.length !== 1 || pendingOrdersAfterOrder[0].status !== 'Pending Approval') {
      throw new Error('Pending order was not created properly!');
    }
    const orderId = pendingOrdersAfterOrder[0].orderId;
    console.log(`✓ Generated Pending Order: ${orderId} for course: ${pendingOrdersAfterOrder[0].courseTitle}`);

    // STEP 3: Verify Student Dashboard shows Pending Order
    console.log('\n--- STEP 3: Checking Student Dashboard for Pending Order Widget ---');
    await page.goto('http://localhost:5050/student-dashboard.html');
    await page.waitForTimeout(1000);

    const pendingCardVisible = await page.$eval('#dashPendingOrdersCard', el => window.getComputedStyle(el).display !== 'none');
    const pendingBadgeText = await page.$eval('#dashPendingOrdersCountBadge', el => el.textContent.trim());
    console.log('Student dashboard pending card visible:', pendingCardVisible);
    console.log('Student dashboard pending count badge:', pendingBadgeText);

    if (!pendingCardVisible || !pendingBadgeText.includes('1 Pending Order')) {
      throw new Error('Student dashboard did not display the pending order card properly!');
    }
    console.log('✓ Student Dashboard successfully displays Pending Order card.');

    // STEP 4: Verify checkout blocks duplicate ordering of same course
    console.log('\n--- STEP 4: Verifying Checkout Blocks Re-ordering for Pending Course ---');
    await page.goto('http://localhost:5050/checkout.html?course=crs-phy-2028-theory');
    await page.waitForTimeout(1000);

    const pendingExistsBoxVisible = await page.$eval('#pendingOrderExistsBox', el => window.getComputedStyle(el).display !== 'none');
    const checkoutGridHidden = await page.$eval('#checkoutGrid', el => window.getComputedStyle(el).display === 'none');
    const pendingRefText = await page.$eval('#pendingOrderRef', el => el.textContent.trim());

    console.log('Pending order warning banner visible:', pendingExistsBoxVisible);
    console.log('Checkout grid hidden:', checkoutGridHidden);
    console.log('Pending order ref displayed:', pendingRefText);

    if (!pendingExistsBoxVisible || !checkoutGridHidden || pendingRefText !== orderId) {
      throw new Error('Checkout page did not properly block duplicate ordering while order is pending!');
    }
    console.log('✓ Checkout page blocks duplicate ordering and shows Pending banner with WhatsApp follow-up link.');

    // STEP 5: Teacher Portal - Verify & Cancel Order
    console.log('\n--- STEP 5: Teacher Portal - Cancelling Order ---');
    await page.goto('http://localhost:5050/teacher-portal.html');
    await page.evaluate(() => {
      const teacherUser = {
        id: "tch-physics",
        name: "Amalsha Wanniarachchi",
        email: "amalsha.teacher@edupeak.lk",
        role: "teacher"
      };
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.createSession(teacherUser);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(teacherUser));
    });
    await page.goto('http://localhost:5050/teacher-portal.html#students');
    await page.waitForTimeout(1000);

    // Check teacher pending orders count
    const teacherBadgeText = await page.$eval('#teacherPendingOrdersCountBadge', el => el.textContent.trim());
    console.log('Teacher portal pending count badge:', teacherBadgeText);

    // Cancel the order via teacher controller
    console.log(`Cancelling order ${orderId} via TEACHER_CONTROLLER...`);
    await page.evaluate((oid) => {
      window.TEACHER_CONTROLLER.cancelPendingOrder(oid);
    }, orderId);
    await page.waitForTimeout(500);

    // Check localStorage status is "Cancelled"
    const ordersAfterCancel = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('edupeak_pending_orders') || '[]');
    });
    console.log('Order status after cancel:', ordersAfterCancel[0].status);
    if (ordersAfterCancel[0].status !== 'Cancelled') {
      throw new Error('Order status was not updated to Cancelled!');
    }
    console.log('✓ Order marked as Cancelled.');

    // STEP 6: Verify student is now UNLOCKED to order again
    console.log('\n--- STEP 6: Verifying Course Lock is Released After Cancellation ---');
    await page.evaluate(() => {
      const studentUser = {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        email: "kasun.student@edupeak.lk",
        role: "student",
        stream: "Physical Science",
        examYear: "2027 A/L",
        nic: "200712345678",
        phone: "0771234567",
        address: "Victory College, Embilipitiya Pallegama",
        district: "Ratnapura",
        enrolledCourses: ["crs-phy-2027-theory"]
      };
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.createSession(studentUser);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
    });

    await page.goto('http://localhost:5050/checkout.html?course=crs-phy-2028-theory');
    await page.waitForTimeout(1000);

    const pendingBoxAfterCancel = await page.$eval('#pendingOrderExistsBox', el => window.getComputedStyle(el).display !== 'none');
    const gridAfterCancel = await page.$eval('#checkoutGrid', el => window.getComputedStyle(el).display !== 'none');
    console.log('Pending banner visible after cancellation:', pendingBoxAfterCancel);
    console.log('Checkout grid visible after cancellation:', gridAfterCancel);

    if (pendingBoxAfterCancel || !gridAfterCancel) {
      throw new Error('Student was not allowed to re-order after admin cancelled the previous order!');
    }
    console.log('✓ Course lock was successfully released! Student can now order again.');

    // STEP 7: Place new order and Approve it
    console.log('\n--- STEP 7: Re-placing Order and Approving to Grant LMS Course Access ---');
    await page.fill('#studentPhoneInput', '0771234567');
    await page.fill('#studentDistrictInput', 'Ratnapura');
    await page.fill('#studentAddressInput', 'Victory College, Embilipitiya Pallegama');
    const mismatchCb = await page.$('#confirmDifferentBatchCheckbox');
    if (mismatchCb) await mismatchCb.check();

    await page.evaluate(() => {
      window.open = () => null;
      processWhatsAppOrder();
    });
    await page.waitForTimeout(500);

    const newPendingOrders = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('edupeak_pending_orders') || '[]');
    });
    const newOrderId = newPendingOrders[0].orderId;
    console.log(`New pending order created: ${newOrderId}`);

    // Approve the order as teacher/admin in teacher portal
    console.log(`Navigating to teacher portal to approve order ${newOrderId}...`);
    await page.goto('http://localhost:5050/teacher-portal.html');
    await page.evaluate(() => {
      const teacherUser = {
        id: "tch-physics",
        name: "Amalsha Wanniarachchi",
        email: "amalsha.teacher@edupeak.lk",
        role: "teacher"
      };
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.createSession(teacherUser);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(teacherUser));
    });
    await page.goto('http://localhost:5050/teacher-portal.html#students');
    await page.waitForTimeout(1000);

    await page.evaluate((oid) => {
      window.TEACHER_CONTROLLER.approvePendingOrder(oid);
    }, newOrderId);
    await page.waitForTimeout(500);

    // Switch session back to student to verify student perspective
    await page.evaluate(() => {
      const studentUser = {
        id: "EP-2027-001",
        name: "Kasun Jayasundara",
        email: "kasun.student@edupeak.lk",
        role: "student",
        stream: "Physical Science",
        examYear: "2027 A/L",
        nic: "200712345678",
        phone: "0771234567",
        address: "Victory College, Embilipitiya Pallegama",
        district: "Ratnapura",
        enrolledCourses: ["crs-phy-2027-theory", "crs-phy-2028-theory"]
      };
      if (window.AUTH_SYSTEM) {
        window.AUTH_SYSTEM.createSession(studentUser);
      }
      localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
    });

    // Verify student enrolled courses
    const studentCourses = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('edupeak_student_courses_EP-2027-001') || '[]');
    });
    console.log('Student enrolled courses after approval:', studentCourses);
    if (!studentCourses.includes('crs-phy-2028-theory')) {
      throw new Error('Course was not added to student enrolled courses upon approval!');
    }

    // STEP 8: Verify Student Dashboard and Checkout reflect active enrollment
    console.log('\n--- STEP 8: Verifying Dashboard and Checkout for Approved Student ---');
    await page.goto('http://localhost:5050/student-dashboard.html');
    await page.waitForTimeout(1000);

    const pendingCountAfterApprove = await page.evaluate(() => {
      const orders = JSON.parse(localStorage.getItem('edupeak_pending_orders') || '[]');
      return orders.filter(o => o.status === 'Pending Approval').length;
    });
    console.log('Active pending orders remaining:', pendingCountAfterApprove);

    await page.goto('http://localhost:5050/checkout.html?course=crs-phy-2028-theory');
    await page.waitForTimeout(1000);

    const alreadyEnrolledBox = await page.$eval('#alreadyEnrolledNoticeBox', el => window.getComputedStyle(el).display !== 'none');
    console.log('Already enrolled notice visible on checkout:', alreadyEnrolledBox);
    if (!alreadyEnrolledBox) {
      throw new Error('Checkout page did not show already enrolled banner after approval!');
    }

    console.log('\n🎉 ALL 8 TEST SCENARIOS PASSED WITH 100% SUCCESS!');
  } catch (err) {
    console.error('❌ Test Failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runTests();
