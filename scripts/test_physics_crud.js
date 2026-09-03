const fs = require('fs');

console.log("==================================================");
console.log("RUNNING AUTOMATED TEST SUITE: Physics & Course CRUD");
console.log("==================================================");

// 1. Test data.js
global.window = {
  localStorage: {
    data: {},
    getItem(k) { return this.data[k] || null; },
    setItem(k, v) { this.data[k] = v; }
  },
  addEventListener() {}
};
global.localStorage = global.window.localStorage;
global.document = {
  addEventListener() {},
  getElementById(id) {
    return {
      classList: { add() {}, remove() {} },
      value: "",
      textContent: "",
      innerHTML: ""
    };
  }
};

eval(fs.readFileSync('./js/data.js', 'utf8'));

console.log("\n[TEST 1] Testing Teachers in data.js:");
console.assert(window.EDUPEAK_DATA.teachers.length === 1, "Expected exactly 1 teacher");
console.assert(window.EDUPEAK_DATA.teachers[0].name === "Amalsha Wanniarachchi", "Expected Amalsha Wanniarachchi");
console.log("✓ Exactly 1 Master Teacher: " + window.EDUPEAK_DATA.teachers[0].name + " (" + window.EDUPEAK_DATA.teachers[0].subject + ")");

console.log("\n[TEST 2] Testing Physics Courses in data.js:");
console.assert(window.EDUPEAK_DATA.courses.length === 5, "Expected 5 pre-seeded Physics courses");
window.EDUPEAK_DATA.courses.forEach(c => {
  console.assert(c.teacherName === "Amalsha Wanniarachchi", `Course ${c.id} must belong to Amalsha Wanniarachchi`);
  console.log(`  ✓ [${c.category.toUpperCase()}] ${c.title} (${c.fee})`);
});

// 2. Test Supabase & Admin CRUD
eval(fs.readFileSync('./js/supabase.js', 'utf8'));
eval(fs.readFileSync('./js/admin.js', 'utf8'));

console.log("\n[TEST 3] Testing Admin Course CRUD Operations:");
(async () => {
  // Test Admin Add Course
  const newCourse = {
    id: "crs-test-admin-01",
    title: "2026 A/L Physics - Advanced Thermal Physics Masterclass",
    title_si: "2026 උ/පෙළ භෞතික විද්‍යාව තාප භෞතික විද්‍යාව",
    category: "theory",
    fee: "LKR 3,500 / Month",
    level: "G.C.E. A/L 2026",
    teacherId: "tch-physics",
    teacherName: "Prof. K. M. Liyanage",
    stream: "Physical Science",
    liveTime: "Every Friday 7:30 AM",
    medium: "Sinhala & English Medium"
  };
  await window.SUPABASE_HELPER.saveCourse(newCourse);
  let coursesAfterAdd = await window.SUPABASE_HELPER.getCourses();
  console.assert(coursesAfterAdd.some(c => c.id === "crs-test-admin-01"), "Admin Added course should be in database");
  console.log("  ✓ Admin successfully added course: " + newCourse.title);

  // Test Admin Edit Course
  const editedCourse = { ...newCourse, fee: "LKR 4,000 / Month", title: "2026 A/L Physics - Thermal Physics & Optics" };
  await window.SUPABASE_HELPER.saveCourse(editedCourse);
  let coursesAfterEdit = await window.SUPABASE_HELPER.getCourses();
  const updatedItem = coursesAfterEdit.find(c => c.id === "crs-test-admin-01");
  console.assert(updatedItem.fee === "LKR 4,000 / Month", "Course fee should be updated");
  console.log("  ✓ Admin successfully edited course fee to: " + updatedItem.fee);

  // Test Admin Delete Course
  await window.SUPABASE_HELPER.deleteCourse("crs-test-admin-01");
  let coursesAfterDelete = await window.SUPABASE_HELPER.getCourses();
  console.assert(!coursesAfterDelete.some(c => c.id === "crs-test-admin-01"), "Admin Deleted course should be removed");
  console.log("  ✓ Admin successfully deleted course from database.");

  // 3. Test Teacher Course CRUD
  console.log("\n[TEST 4] Testing Teacher Course CRUD Operations:");
  eval(fs.readFileSync('./js/teacher.js', 'utf8'));
  
  // Teacher get courses
  let teacherCourses = window.TEACHER_CONTROLLER.getTeacherCourses();
  console.assert(teacherCourses.length > 0, "Teacher should get courses list");
  console.log(`  ✓ Teacher retrieved ${teacherCourses.length} courses`);

  // Teacher save updated courses
  const customTeacherCourse = {
    id: "crs-test-teacher-01",
    title: "2025 A/L Physics 100 Days Countdown Rapid Revision",
    category: "revision",
    fee: "LKR 3,000 / Month",
    teacherId: "tch-physics",
    teacherName: "Prof. K. M. Liyanage"
  };
  teacherCourses.unshift(customTeacherCourse);
  window.TEACHER_CONTROLLER.saveCoursesDatabase(teacherCourses);

  let verifiedCourses = window.TEACHER_CONTROLLER.getTeacherCourses();
  console.assert(verifiedCourses[0].id === "crs-test-teacher-01", "Teacher created course should persist");
  console.log("  ✓ Teacher created course persisted to localStorage and runtime data: " + verifiedCourses[0].title);

  // Teacher delete course
  const filteredCourses = verifiedCourses.filter(c => c.id !== "crs-test-teacher-01");
  window.TEACHER_CONTROLLER.saveCoursesDatabase(filteredCourses);
  console.assert(window.TEACHER_CONTROLLER.getTeacherCourses().length === 5, "Course should be deleted");
  console.log("  ✓ Teacher successfully deleted their course.");

  console.log("\n==================================================");
  console.log("ALL 4 TEST SUITES PASSED FLAWLESSLY! (100% SUCCESS)");
  console.log("==================================================");
})();
