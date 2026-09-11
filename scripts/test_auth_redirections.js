const fs = require('fs');

console.log("=== VERIFYING AUTH GATES & REDIRECTION ARCHITECTURE ===");

// 1. admin.html
const adminHtml = fs.readFileSync('admin.html', 'utf8');
const adminHasGate = adminHtml.includes('id="adminLoginGate"');
const adminNoHeadLoop = !adminHtml.includes('localStorage.getItem("edupeak_auth_session")') ||
                        !adminHtml.includes('window.location.replace("index.html")');
const adminConditionalRedirect = adminHtml.includes("h === 'edupeak.lk' || h === 'www.edupeak.lk'");
console.log("1. admin.html has login gate for admin domain:", adminHasGate);
console.log("   admin.html does not unconditionally loop to index.html:", adminNoHeadLoop);
console.log("   admin.html only redirects away if accessed on main domain:", adminConditionalRedirect);

// 2. teacher-portal.html
const teacherHtml = fs.readFileSync('teacher-portal.html', 'utf8');
const teacherHasGate = teacherHtml.includes('id="teacherLoginGate"');
const teacherNoHeadLoop = !teacherHtml.includes('localStorage.getItem("edupeak_auth_session")') ||
                          !teacherHtml.includes('window.location.replace("index.html")');
const teacherConditionalRedirect = teacherHtml.includes("h === 'edupeak.lk' || h === 'www.edupeak.lk'");
console.log("2. teacher-portal.html has login gate for teacher domain:", teacherHasGate);
console.log("   teacher-portal.html does not unconditionally loop to index.html:", teacherNoHeadLoop);
console.log("   teacher-portal.html only redirects away if accessed on main domain:", teacherConditionalRedirect);

// 3. student-dashboard.html redirects to login.html
const dashHtml = fs.readFileSync('student-dashboard.html', 'utf8');
const dashRedirectsToLogin = dashHtml.includes('window.location.replace("login.html?redirect=student-dashboard.html")');
console.log("3. student-dashboard.html redirects unauthenticated users to login.html:", dashRedirectsToLogin);

// 4. profile.html redirects to login.html
const profHtml = fs.readFileSync('profile.html', 'utf8');
const profRedirectsToLogin = profHtml.includes('window.location.replace("login.html?redirect=profile.html")');
console.log("4. profile.html redirects unauthenticated users to login.html:", profRedirectsToLogin);

// 5. js/admin.js handles admin domain without infinite loop
const adminJs = fs.readFileSync('js/admin.js', 'utf8');
const adminJsSafe = adminJs.includes("adminLoginGate") &&
                    adminJs.includes("h === 'edupeak.lk' || h === 'www.edupeak.lk'");
console.log("5. js/admin.js shows adminLoginGate instead of redirecting on admin domain:", adminJsSafe);

// 6. js/teacher.js handles teacher domain without infinite loop
const teacherJs = fs.readFileSync('js/teacher.js', 'utf8');
const teacherJsSafe = teacherJs.includes("teacherLoginGate") &&
                      teacherJs.includes("h === 'edupeak.lk' || h === 'www.edupeak.lk'");
console.log("6. js/teacher.js shows teacherLoginGate instead of redirecting on teacher domain:", teacherJsSafe);

const allPass = adminHasGate && adminNoHeadLoop && adminConditionalRedirect &&
                teacherHasGate && teacherNoHeadLoop && teacherConditionalRedirect &&
                dashRedirectsToLogin && profRedirectsToLogin &&
                adminJsSafe && teacherJsSafe;

console.log("\nALL AUTH GATE & REDIRECTION CHECKS PASSED:", allPass);
process.exit(allPass ? 0 : 1);
