const fs = require('fs');
const { JSDOM } = require('jsdom');

console.log("--- Testing Live Classroom Standby, Scheduled, and Live Broadcast States ---");

const html = fs.readFileSync('index.html', 'utf8');
const lmsJs = fs.readFileSync('js/lms.js', 'utf8');

const dom = new JSDOM(html, {
  runScripts: "outside-only",
  url: "https://edupeak.lk"
});

const { window } = dom;
const { document, localStorage } = window;

// Attach mock globals
window.SUPABASE_HELPER = {
  getSharedData: (key) => null,
  setSharedData: () => {}
};

window.EDUPEAK_LIVE_PLAYER = {
  loadStream: (url) => { window._loadedUrl = url; },
  setWatermarkEnabled: (val) => { window._watermark = val; }
};

// Evaluate lms.js
window.eval(lmsJs);

// Scenario 1: Standby State (No live stream scheduled)
console.log("\n[Scenario 1: No Live Broadcast Scheduled]");
localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
  topic: "No Live Broadcast Scheduled",
  provider: "youtube",
  rawUrl: "",
  embedUrl: "about:blank",
  status: "ended",
  scheduleTime: "",
  updatedAt: new Date().toISOString()
}));

window.syncLiveStreamWithTeacher();

const standbyWrapper = document.getElementById("edupeakLiveStandbyWrapper");
const playerWrapper = document.getElementById("edupeakLivePlayerWrapper");
const zoomBtn = document.getElementById("lmsLiveZoomBtn");
const topicEl = document.getElementById("lmsLiveTopicTitle");
const badgeEl = document.getElementById("lmsLiveBadgePill");

if (standbyWrapper.style.display === "flex" && playerWrapper.style.display === "none") {
  console.log("✅ PASS: Standby Card is visible (flex) and Video Player is hidden (none)");
} else {
  console.error("❌ FAIL: Standby Card display state incorrect", standbyWrapper.style.display, playerWrapper.style.display);
  process.exit(1);
}

if (zoomBtn.style.display === "none") {
  console.log("✅ PASS: Zoom Button is hidden during standby");
} else {
  console.error("❌ FAIL: Zoom button should be hidden");
  process.exit(1);
}

if (topicEl.textContent.includes("No Live Broadcast Scheduled")) {
  console.log("✅ PASS: Topic title shows 'No Live Broadcast Scheduled'");
} else {
  console.error("❌ FAIL: Topic title incorrect:", topicEl.textContent);
  process.exit(1);
}

// Scenario 2: Scheduled Class State
console.log("\n[Scenario 2: Scheduled Broadcast]");
localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
  topic: "2027 A/L Physics - Mechanics Speed Masterclass",
  provider: "youtube",
  rawUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  status: "scheduled",
  scheduleTime: "Tomorrow at 8:00 AM",
  teacherName: "Amalsha Wanniarachchi",
  updatedAt: new Date().toISOString()
}));

window.syncLiveStreamWithTeacher();

if (standbyWrapper.style.display === "flex" && playerWrapper.style.display === "none") {
  console.log("✅ PASS: Standby Card shows schedule info and video player remains hidden until live");
} else {
  console.error("❌ FAIL: Scheduled display state incorrect");
  process.exit(1);
}

const standbyDesc = document.getElementById("liveStandbyDesc");
if (standbyDesc.textContent.includes("Tomorrow at 8:00 AM")) {
  console.log("✅ PASS: Standby card displays scheduled time: 'Tomorrow at 8:00 AM'");
} else {
  console.error("❌ FAIL: Scheduled time missing in standby card:", standbyDesc.textContent);
  process.exit(1);
}

// Scenario 3: Live Broadcast State
console.log("\n[Scenario 3: Actively Live Broadcast]");
localStorage.setItem("edupeak_live_stream_config", JSON.stringify({
  topic: "2027 A/L Physics - Live Now",
  provider: "zoom",
  rawUrl: "https://zoom.us/j/123456789",
  zoomUrl: "https://zoom.us/j/123456789",
  embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
  status: "live",
  watermarkEnabled: true,
  updatedAt: new Date().toISOString()
}));

window.syncLiveStreamWithTeacher();

if (playerWrapper.style.display === "block" && standbyWrapper.style.display === "none") {
  console.log("✅ PASS: Active video player is visible and standby card is hidden");
} else {
  console.error("❌ FAIL: Live player display state incorrect");
  process.exit(1);
}

if (zoomBtn.style.display === "inline-flex" && zoomBtn.href === "https://zoom.us/j/123456789") {
  console.log("✅ PASS: Zoom launch button is visible with correct Zoom room URL");
} else {
  console.error("❌ FAIL: Zoom button not shown or incorrect href:", zoomBtn.style.display, zoomBtn.href);
  process.exit(1);
}

console.log("\n🎉 ALL LIVE STREAM STATE SCENARIOS PASSED WITH FLYING COLORS!");
