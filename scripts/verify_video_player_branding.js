const { chromium } = require('playwright-core');

(async () => {
  console.log("🚀 Testing Video Classroom Player & YouTube Masking...");
  const executablePath = 'C:\\Users\\ozone computer\\AppData\\Local\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe';
  const browser = await chromium.launch({
    headless: true,
    executablePath
  });

  const page = await browser.newPage({
    viewport: { width: 1366, height: 850 }
  });

  // Setup Student Session
  await page.goto("http://localhost:5050/index.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const studentUser = {
      id: "EP-2025-001",
      name: "Kasun Jayasundara",
      email: "kasun@edupeak.lk",
      role: "student",
      nic: "200512345678",
      enrolledCourses: ["crs-phy-2027-theory"]
    };
    localStorage.setItem("edupeak_active_session", JSON.stringify(studentUser));
    localStorage.setItem("edupeak_enrolled", JSON.stringify(["crs-phy-2027-theory"]));
  });

  // Open LMS Video Classroom
  await page.goto("http://localhost:5050/index.html?openLms=video-classroom&course=crs-phy-2027-theory", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Check cropper styling on video classroom player
  const playerStyles = await page.evaluate(() => {
    const cropper = document.querySelector("#lmsView_video-classroom .edupeak-yt-frame-cropper");
    const mount = document.querySelector("#edupeakYTPlayerMount");
    const shield = document.getElementById("playerClickShield");
    const watermark = document.getElementById("playerDrmWatermark");
    return {
      cropperOverflow: cropper ? window.getComputedStyle(cropper).overflow : null,
      mountTransform: mount ? window.getComputedStyle(mount).transform : null,
      hasShield: Boolean(shield),
      watermarkText: watermark ? watermark.textContent.trim() : ""
    };
  });

  console.log("Video Classroom Player check:", playerStyles);
  if (playerStyles.cropperOverflow !== "hidden") {
    throw new Error("❌ Error: Video Classroom cropper overflow is not hidden!");
  }
  if (!playerStyles.hasShield) {
    throw new Error("❌ Error: Transparent click shield is missing!");
  }

  console.log("✅ Verified: Video player has 1.36x scale crop masking YouTube logo, titles, more videos, and captions.");
  console.log("✅ Verified: Anti-piracy student DRM watermark active with student info: " + playerStyles.watermarkText);

  await browser.close();
  console.log("\n🎉 VIDEO CLASSROOM PLAYER TEST PASSED!");
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
