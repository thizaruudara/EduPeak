const fs = require('fs');

console.log("=== VERIFYING SILENT REDIRECTS & RESTRICTION GATES ===");

// 1. admin.html head guard
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const adminHeadGuard = adminHtml.includes('localStorage.getItem("edupeak_auth_session")') &&
                       adminHtml.includes('user.role !== "admin"') &&
                       adminHtml.includes('window.location.replace("index.html")');
console.log("1. admin.html early head guard installed:", adminHeadGuard);
const adminGateRemoved = !adminHtml.includes('class="admin-login-gate" id="adminLoginGate"');
console.log("   admin.html login gate removed:", adminGateRemoved);

// 2. teacher-portal.html head guard
const teacherHtml = fs.readFileSync('teacher-portal.html', 'utf8');
const teacherHeadGuard = teacherHtml.includes('localStorage.getItem("edupeak_auth_session")') &&
                         teacherHtml.includes('user.role !== "teacher" && user.role !== "admin"') &&
                         teacherHtml.includes('window.location.replace("index.html")');
console.log("2. teacher-portal.html early head guard installed:", teacherHeadGuard);
const teacherGateRemoved = !teacherHtml.includes('class="teacher-login-gate" id="teacherLoginGate"');
console.log("   teacher-portal.html login gate removed:", teacherGateRemoved);

// 3. student-dashboard.html head guard & no dummy student
const dashHtml = fs.readFileSync('student-dashboard.html', 'utf8');
const dashHeadGuard = dashHtml.includes('localStorage.getItem("edupeak_auth_session")') &&
                      dashHtml.includes('window.location.replace("index.html")');
const dashNoDummy = !dashHtml.includes('id: "EP-2027-001"');
console.log("3. student-dashboard.html early head guard installed:", dashHeadGuard);
console.log("   student-dashboard.html dummy student session removed:", dashNoDummy);

// 4. profile.html head guard & no dummy student
const profHtml = fs.readFileSync('profile.html', 'utf8');
const profHeadGuard = profHtml.includes('localStorage.getItem("edupeak_auth_session")') &&
                      profHtml.includes('window.location.replace("index.html")');
const profNoDummy = !profHtml.includes('id: "EP-2027-001"');
console.log("4. profile.html early head guard installed:", profHeadGuard);
console.log("   profile.html dummy student session removed:", profNoDummy);

// 5. js/admin.js silent auto-open
const adminJs = fs.readFileSync('js/admin.js', 'utf8');
const adminNoAutoLogin = !adminJs.includes('window.AUTH_SYSTEM.createSession(adminAcc)');
const adminNoToast = !adminJs.includes('Admin access required. Please sign in as an Administrator.');
console.log("5. js/admin.js auto-login removed:", adminNoAutoLogin);
console.log("   js/admin.js 'Admin access required' toast removed:", adminNoToast);

// 6. js/teacher.js no fallback session
const teacherJs = fs.readFileSync('js/teacher.js', 'utf8');
const teacherNoFallback = !teacherJs.includes('Default fallback session for instructor view');
console.log("6. js/teacher.js instructor fallback session removed:", teacherNoFallback);

// 7. js/app.js & js/lms.js silent parameter handling
const appJs = fs.readFileSync('js/app.js', 'utf8');
const lmsJs = fs.readFileSync('js/lms.js', 'utf8');
const appJsSilent = appJs.includes('if (!currentUser || currentUser.role !== "admin")') &&
                    appJs.includes('sessionStorage.removeItem("edupeak_admin_open")');
const lmsJsSilent = !lmsJs.includes('Please sign in to access your EduPeak LMS account.');
console.log("7. js/app.js silent param cleanup:", appJsSilent);
console.log("   js/lms.js 'Please sign in' toast removed:", lmsJsSilent);

const allPass = adminHeadGuard && adminGateRemoved &&
                teacherHeadGuard && teacherGateRemoved &&
                dashHeadGuard && dashNoDummy &&
                profHeadGuard && profNoDummy &&
                adminNoAutoLogin && adminNoToast &&
                teacherNoFallback &&
                appJsSilent && lmsJsSilent;

console.log("\nALL AUTH ROUTE CHECKS PASSED:", allPass);
process.exit(allPass ? 0 : 1);
