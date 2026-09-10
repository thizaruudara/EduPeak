const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log("=== RUNNING INSTITUTE TOGGLE -> EDIT -> RELOAD TEST ===");

// 1. Setup mock browser environment
const localStorageMock = (function() {
  let store = {};
  return {
    getItem: (k) => store[k] !== undefined ? store[k] : null,
    setItem: (k, v) => { store[k] = v.toString(); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    get store() { return store; }
  };
})();

global.localStorage = localStorageMock;

// Mock DOM elements
const domElements = {
  adminInstitutesTbody: { innerHTML: "" },
  adminInstituteDrawerModal: { classList: { add: () => {}, remove: () => {} } },
  instModalTitle: { innerHTML: "" },
  instFormId: { value: "" },
  instFormName: { value: "" },
  instFormNameSi: { value: "" },
  instFormStatus: { value: "active" },
  instFormType: { value: "Physical Campus & Smart Auditorium" },
  instFormBadge: { value: "Physical Campus Hub" },
  instFormIcon: { value: "🏫" },
  instFormLocation: { value: "Victory College" },
  instFormPhone: { value: "+94 76 068 7578" },
  instFormEmail: { value: "test@edupeak.lk" },
  instFormMapUrl: { value: "https://maps.google.com" },
  instFormFacilities: { value: "Auditorium\nWi-Fi" }
};

global.window = {
  localStorage: localStorageMock,
  sessionStorage: localStorageMock,
  document: {
    addEventListener: () => {},
    getElementById: (id) => domElements[id] || null,
    querySelectorAll: (sel) => []
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  dispatchEvent: () => true,
  showToast: (msg, type) => { console.log(`[Toast ${type}] ${msg}`); }
};
global.document = window.document;

// 2. Load script files
eval(fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/institutes.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8'));
eval(fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8'));

async function testScenario() {
  console.log("Step 1: Check initial status of inst-embilipitiya");
  let insts = window.EDUPEAK_INSTITUTES.getAll();
  let emb = insts.find(i => i.id === "inst-embilipitiya");
  assert(emb, "inst-embilipitiya must exist");
  assert.strictEqual(emb.status, "active", "inst-embilipitiya should start active");
  console.log("✔ inst-embilipitiya is initially active");

  console.log("\nStep 2: User clicks status button to toggle to Coming Soon");
  await window.ADMIN_CONTROLLER.toggleInstituteStatus("inst-embilipitiya");
  insts = window.EDUPEAK_INSTITUTES.getAll();
  emb = insts.find(i => i.id === "inst-embilipitiya");
  assert.strictEqual(emb.status, "coming_soon", "inst-embilipitiya must now be coming_soon");
  assert.strictEqual(emb.badge, "Coming Soon", "inst-embilipitiya badge must be Coming Soon");
  console.log("✔ inst-embilipitiya successfully toggled to coming_soon");

  console.log("\nStep 3: User opens Edit modal");
  window.ADMIN_CONTROLLER.openEditInstituteModal("inst-embilipitiya");
  assert.strictEqual(domElements.instFormStatus.value, "coming_soon", "Modal status dropdown should reflect coming_soon");
  assert.strictEqual(domElements.instFormBadge.value, "Coming Soon", "Modal badge should reflect Coming Soon");
  console.log("✔ Edit modal opened and populated with coming_soon");

  console.log("\nStep 4: User changes status dropdown back to 'active' and submits form");
  domElements.instFormStatus.value = "active";
  window.ADMIN_CONTROLLER.handleStatusDropdownChange("active");
  assert.strictEqual(domElements.instFormBadge.value, "Physical Campus Hub", "Badge should auto-switch to Physical Campus Hub");

  // Submit form
  await window.ADMIN_CONTROLLER.handleSaveInstituteSubmit({ preventDefault: () => {} });

  insts = window.EDUPEAK_INSTITUTES.getAll();
  emb = insts.find(i => i.id === "inst-embilipitiya");
  assert.strictEqual(emb.status, "active", "inst-embilipitiya must be active after saving from edit modal");
  assert.strictEqual(emb.badge, "Physical Campus Hub", "inst-embilipitiya badge must be Physical Campus Hub");
  console.log("✔ Edit form successfully saved branch as active");

  console.log("\nStep 5: Simulate Page Reload");
  // On reload, EDUPEAK_INSTITUTES.getAll() and SUPABASE_HELPER.getInstitutes() are called
  const reloadedInsts = await window.SUPABASE_HELPER.getInstitutes();
  const reloadedEmb = reloadedInsts.find(i => i.id === "inst-embilipitiya");
  assert(reloadedEmb, "inst-embilipitiya must exist after reload");
  assert.strictEqual(reloadedEmb.status, "active", "inst-embilipitiya MUST REMAIN active after reload");
  assert.strictEqual(reloadedEmb.badge, "Physical Campus Hub", "Badge must remain Physical Campus Hub after reload");
  console.log("✔ SUCCESS: Status was properly saved and persisted across reload!");

  console.log("\n=== ALL TEST CHECKS PASSED PERFECTLY ===");
}

testScenario().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
