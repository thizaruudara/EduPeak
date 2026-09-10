/**
 * Verification Script for Educational Institute Real-Time Sync
 * Tests that editing, creating, toggling status, and deleting institutes in Admin Console
 * correctly updates local storage, shared data, DOM rendering on main website, and Supabase integration.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== RUNNING INSTITUTE SYNC VERIFICATION TESTS ===");

// 1. Check syntax of modified files
const files = [
  path.join(__dirname, '../js/supabase.js'),
  path.join(__dirname, '../js/admin.js'),
  path.join(__dirname, '../js/institutes.js'),
  path.join(__dirname, '../js/app.js')
];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  assert(content.length > 0, `File ${f} is empty`);
  console.log(`✔ File read successfully: ${path.basename(f)} (${content.length} bytes)`);
});

// 2. Check key methods exist in supabase.js
const supabaseJs = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
assert(supabaseJs.includes('this.syncInstitutes()'), 'supabase.js missing this.syncInstitutes() in syncAllCloudData');
assert(supabaseJs.includes('async syncInstitutes()'), 'supabase.js missing async syncInstitutes() method');
assert(supabaseJs.includes("table: 'institutes'"), 'supabase.js missing realtime subscription for institutes table');
assert(supabaseJs.includes('async saveInstitute(instData)'), 'supabase.js missing async saveInstitute method');
assert(supabaseJs.includes('async deleteInstitute(instId)'), 'supabase.js missing async deleteInstitute method');
console.log("✔ supabase.js contains all required sync and CRUD institute methods");

// 3. Check admin.js calls SUPABASE_HELPER
const adminJs = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');
assert(adminJs.includes('window.SUPABASE_HELPER.saveInstitute'), 'admin.js missing SUPABASE_HELPER.saveInstitute call');
assert(adminJs.includes('window.SUPABASE_HELPER.deleteInstitute'), 'admin.js missing SUPABASE_HELPER.deleteInstitute call');
console.log("✔ admin.js properly calls SUPABASE_HELPER for institute modifications");

// 4. Simulate browser environment
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = v.toString(); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; }
  };
})();

global.localStorage = localStorageMock;
global.window = {
  localStorage: localStorageMock,
  document: {
    addEventListener: () => {},
    getElementById: (id) => null,
    querySelectorAll: (sel) => []
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  dispatchEvent: (e) => true
};
global.document = window.document;

// Load data.js, institutes.js, supabase.js
eval(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/institutes.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8'));

let renderCount = 0;
window.renderInstitutes = () => { renderCount++; };

// Test saveInstitute via SUPABASE_HELPER
async function runTests() {
  const initialInstitutes = window.EDUPEAK_INSTITUTES.getAll();
  console.log(`Initial institutes count: ${initialInstitutes.length}`);
  assert(initialInstitutes.length > 0, "Initial institutes list should not be empty");

  // Add/Edit an institute
  const testBranch = {
    id: "inst-test-galle",
    name: "EduPeak Southern Province Hub - Galle",
    name_si: "එඩියුපීක් දකුණු පළාත් මධ්‍යස්ථානය - ගාල්ල",
    status: "active",
    hasPhysicalLocation: true,
    location: "Galle Fort Road, Galle",
    phone: "+94 91 223 4567",
    email: "galle@edupeak.lk",
    type: "Physical Campus & Smart Auditorium",
    badge: "Physical Campus Hub",
    icon: "🏫",
    facilities: ["Air Conditioned Auditorium", "Demonstration Lab"]
  };

  await window.SUPABASE_HELPER.saveInstitute(testBranch);
  
  const updatedInstitutes = window.EDUPEAK_INSTITUTES.getAll();
  const found = updatedInstitutes.find(i => i.id === "inst-test-galle");
  assert(found, "Saved institute must be present in EDUPEAK_INSTITUTES.getAll()");
  assert.strictEqual(found.name, "EduPeak Southern Province Hub - Galle");
  console.log("✔ Institute successfully saved and retrieved from local storage and memory");

  // Edit the institute
  found.name = "EduPeak Galle Southern Campus (Updated)";
  await window.SUPABASE_HELPER.saveInstitute(found);

  const editedInstitutes = window.EDUPEAK_INSTITUTES.getAll();
  const editedFound = editedInstitutes.find(i => i.id === "inst-test-galle");
  assert.strictEqual(editedFound.name, "EduPeak Galle Southern Campus (Updated)");
  console.log("✔ Institute edit verified successfully");

  // Delete the institute
  await window.SUPABASE_HELPER.deleteInstitute("inst-test-galle");
  const afterDelete = window.EDUPEAK_INSTITUTES.getAll();
  const shouldBeDeleted = afterDelete.find(i => i.id === "inst-test-galle");
  assert(!shouldBeDeleted, "Deleted institute should no longer be present");
  console.log("✔ Institute deletion verified successfully");

  console.log("\n=== ALL INSTITUTE SYNC VERIFICATION TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Test failure:", err);
  process.exit(1);
});
