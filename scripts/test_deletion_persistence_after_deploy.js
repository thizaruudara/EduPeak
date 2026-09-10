/**
 * test_deletion_persistence_after_deploy.js
 * Verifies that deleted courses and paper vault files NEVER resurrect
 * after page reload, redeploy, or clean cache initialization.
 */

const fs = require("fs");
const path = require("path");
const assert = require("assert");

// Setup minimal browser-like environment
const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};

global.document = {
  addEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
  cookie: ""
};

global.window = {
  localStorage: global.localStorage,
  document: global.document,
  addEventListener: () => {},
  showToast: () => {}
};

// 1. Load data.js to get default EDUPEAK_DATA
const dataJsPath = path.join(__dirname, "../js/data.js");
const dataCode = fs.readFileSync(dataJsPath, "utf-8");
eval(dataCode);

console.log("Initial default courses count in EDUPEAK_DATA:", window.EDUPEAK_DATA.courses.length);
assert(window.EDUPEAK_DATA.courses.length >= 5, "Should have default courses in EDUPEAK_DATA");

// 2. Load supabase.js
const supabaseJsPath = path.join(__dirname, "../js/supabase.js");
const supabaseCode = fs.readFileSync(supabaseJsPath, "utf-8");
eval(supabaseCode);

assert(window.SUPABASE_HELPER, "SUPABASE_HELPER must be defined");
assert(typeof window.SUPABASE_HELPER.getDeletedCourses === "function", "getDeletedCourses should exist");
assert(typeof window.SUPABASE_HELPER.addDeletedCourse === "function", "addDeletedCourse should exist");
assert(typeof window.SUPABASE_HELPER.getDeletedPapers === "function", "getDeletedPapers should exist");
assert(typeof window.SUPABASE_HELPER.addDeletedPaper === "function", "addDeletedPaper should exist");

// 3. Load lms.js
const lmsJsPath = path.join(__dirname, "../js/lms.js");
const lmsCode = fs.readFileSync(lmsJsPath, "utf-8");
eval(lmsCode);

// 4. Test Course Deletion & Persistence
console.log("\n--- Testing Course Deletion & Persistence ---");
const targetCourseId = "crs-phy-2027-theory";

// Verify initial getLMSCourses contains the target course
let courses = window.getLMSCourses();
assert(courses.some(c => c.id === targetCourseId), "Initial courses must contain crs-phy-2027-theory");

// Delete course via SUPABASE_HELPER
window.SUPABASE_HELPER.deleteCourse(targetCourseId);

// Verify course is immediately excluded from getLMSCourses
courses = window.getLMSCourses();
assert(!courses.some(c => c.id === targetCourseId), "Target course must not exist after delete");
console.log("✓ Course successfully deleted from active catalog.");

// SIMULATE REDEPLOY: localStorage courses cache cleared, page reloads data.js and supabase.js
console.log("Simulating new deploy / cache clear...");
const deletedTombstones = localStorage.getItem("edupeak_deleted_courses");
delete localStorageStore["edupeak_courses_db"];
delete localStorageStore["edupeak_custom_courses"];

// Re-eval data.js (simulates new fresh bundle load)
eval(dataCode);
assert(window.EDUPEAK_DATA.courses.some(c => c.id === targetCourseId), "Raw data bundle contains default course");

// Now check if getLMSCourses filters it out based on tombstone
courses = window.getLMSCourses();
assert(!courses.some(c => c.id === targetCourseId), "FAIL: Deleted course resurrected after redeploy!");
console.log("✓ Deleted course stayed permanently deleted across simulated redeploy!");

// 5. Test Paper Vault Deletion & Persistence
console.log("\n--- Testing Paper Vault Deletion & Persistence ---");
(async () => {
  let papers = await window.SUPABASE_HELPER.getPapers();
  console.log("Initial papers count:", papers.length);
  assert(papers.length > 0, "Initial papers should not be empty");

  const targetPaperId = papers[0].id;
  console.log("Deleting paper:", targetPaperId);

  await window.SUPABASE_HELPER.deletePaper(targetPaperId);

  papers = await window.SUPABASE_HELPER.getPapers();
  assert(!papers.some(p => p.id === targetPaperId), "Target paper must be excluded after deletion");
  console.log("✓ Paper successfully deleted from Paper Vault.");

  // SIMULATE REDEPLOY: Clear paper db cache
  console.log("Simulating paper redeploy / cache reset...");
  delete localStorageStore["edupeak_papers_db"];

  papers = await window.SUPABASE_HELPER.getPapers();
  assert(!papers.some(p => p.id === targetPaperId), "FAIL: Deleted paper resurrected after redeploy!");
  console.log("✓ Deleted paper stayed permanently deleted across simulated redeploy!");

  console.log("\n=========================================");
  console.log("ALL DELETION PERSISTENCE TESTS PASSED! 100%");
  console.log("=========================================\n");
})();
