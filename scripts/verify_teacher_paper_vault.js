/**
 * Headless Automated Verification for Teacher Portal Paper Vault Integration
 */

const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log("================================================================================");
  console.log("🧪 VERIFYING TEACHER PORTAL PAPER VAULT (PDFs) INTEGRATION");
  console.log("================================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Static HTML & CSS Validation
  const teacherHtml = fs.readFileSync(path.join(__dirname, '..', 'teacher-portal.html'), 'utf8');
  const teacherJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'teacher.js'), 'utf8');
  const teacherCss = fs.readFileSync(path.join(__dirname, '..', 'css', 'teacher.css'), 'utf8');

  console.log("\n[1] Checking HTML Structure for Teacher Studio Paper Vault...");
  assert(teacherHtml.includes('id="metricTotalPapers"'), "teacher-portal.html contains #metricTotalPapers metric stat card");
  assert(teacherHtml.includes('data-tab="papers"'), "teacher-portal.html contains data-tab='papers' navigation button");
  assert(teacherHtml.includes('id="teacherTab_papers"'), "teacher-portal.html contains #teacherTab_papers tab section");
  assert(teacherHtml.includes('id="teacherPapersTableBody"'), "teacher-portal.html contains #teacherPapersTableBody table element");
  assert(teacherHtml.includes('id="teacherPaperDrawerModal"'), "teacher-portal.html contains #teacherPaperDrawerModal Add/Edit modal");
  assert(teacherHtml.includes('id="teacherPdfViewerModal"'), "teacher-portal.html contains #teacherPdfViewerModal PDF viewer modal");
  assert(teacherHtml.includes('id="teacherPaperSearchInput"'), "teacher-portal.html contains #teacherPaperSearchInput search box");
  assert(teacherHtml.includes('id="teacherPaperCategoryFilter"'), "teacher-portal.html contains #teacherPaperCategoryFilter dropdown");
  assert(teacherHtml.includes('id="teacherPaperUnitFilter"'), "teacher-portal.html contains #teacherPaperUnitFilter dropdown");

  console.log("\n[2] Checking CSS Stylesheet for PDF Badges & Cards...");
  assert(teacherCss.includes('.pdf-cloud-badge'), "teacher.css defines .pdf-cloud-badge rules");
  assert(teacherCss.includes('.pdf-cloud-badge.gdrive'), "teacher.css defines .pdf-cloud-badge.gdrive rules");

  console.log("\n[3] Checking JS Controller Methods in teacher.js...");
  assert(teacherJs.includes('papers: "edupeak_papers_db"'), "TEACHER_CONTROLLER storageKeys contains papers key");
  assert(teacherJs.includes('if (tabId === "papers") this.renderPapers();'), "TEACHER_CONTROLLER.switchTab handles 'papers' tab");
  assert(teacherJs.includes('getPapers()'), "TEACHER_CONTROLLER defines getPapers()");
  assert(teacherJs.includes('renderPapers()'), "TEACHER_CONTROLLER defines renderPapers()");
  assert(teacherJs.includes('openAddPaperModal()'), "TEACHER_CONTROLLER defines openAddPaperModal()");
  assert(teacherJs.includes('openEditPaperModal('), "TEACHER_CONTROLLER defines openEditPaperModal()");
  assert(teacherJs.includes('handleSavePaperSubmit('), "TEACHER_CONTROLLER defines handleSavePaperSubmit()");
  assert(teacherJs.includes('deletePaper('), "TEACHER_CONTROLLER defines deletePaper()");
  assert(teacherJs.includes('previewPaper('), "TEACHER_CONTROLLER defines previewPaper()");

  // 4. Mock Browser DOM & Environment Execution
  console.log("\n[4] Running Simulated Cross-Portal CRUD & Sync Tests...");

  // Setup localStorage mock
  const storage = {};
  global.localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
  };
  global.document = {
    cookie: '',
    getElementById: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {}
  };
  global.window = {
    localStorage: global.localStorage,
    document: global.document,
    addEventListener: () => {},
    location: { href: '' }
  };

  // Load supabase helper
  const supabaseCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'supabase.js'), 'utf8');
  eval(supabaseCode);

  assert(typeof global.window.SUPABASE_HELPER === 'object', "SUPABASE_HELPER is loaded into window");

  // Fetch initial default papers
  const initialPapers = await global.window.SUPABASE_HELPER.getPapers();
  assert(Array.isArray(initialPapers) && initialPapers.length > 0, `Initial papers loaded: ${initialPapers.length} papers`);

  // Teacher adds a new paper
  const newPaperFromTeacher = {
    id: "pap-teacher-2027-test",
    title: "2027 A/L Physics Mechanics Model Paper by Amalsha Wanniarachchi",
    title_si: "2027 උසස් පෙළ භෞතික විද්‍යාව යාන්ත්‍ර විද්‍යාව ආදර්ශ ප්‍රශ්න පත්‍රය",
    type: "model",
    year: 2027,
    unit: "mechanics",
    unitName: "01. Mechanics & Dynamics",
    size: "3.9 MB",
    url: "https://drive.google.com/file/d/1_SAMPLE_AMALSHA_2027_MECHANICS_TEST/view"
  };

  await global.window.SUPABASE_HELPER.savePaper(newPaperFromTeacher);

  const papersAfterAdd = await global.window.SUPABASE_HELPER.getPapers();
  const added = papersAfterAdd.find(p => p.id === "pap-teacher-2027-test");
  assert(!!added, "Teacher uploaded paper is successfully stored in shared vault");
  assert(added.title.includes("2027 A/L Physics Mechanics Model"), "Title matches uploaded paper");

  // Teacher edits the paper
  added.title = "2027 A/L Physics Mechanics Model Paper (Updated Marking Scheme)";
  added.size = "4.1 MB";
  await global.window.SUPABASE_HELPER.savePaper(added);

  const papersAfterEdit = await global.window.SUPABASE_HELPER.getPapers();
  const edited = papersAfterEdit.find(p => p.id === "pap-teacher-2027-test");
  assert(edited && edited.title.includes("(Updated Marking Scheme)") && edited.size === "4.1 MB", "Teacher edit is saved and reflected in shared vault");

  // Teacher deletes the paper
  await global.window.SUPABASE_HELPER.deletePaper("pap-teacher-2027-test");
  const papersAfterDelete = await global.window.SUPABASE_HELPER.getPapers();
  const deleted = papersAfterDelete.find(p => p.id === "pap-teacher-2027-test");
  assert(!deleted, "Teacher deletion removes the paper completely from shared vault");

  console.log("\n================================================================================");
  console.log(`🏁 VERIFICATION SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
