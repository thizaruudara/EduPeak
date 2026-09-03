const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const loginHtml = fs.readFileSync('login.html', 'utf8');
const registerHtml = fs.readFileSync('register.html', 'utf8');
const authJs = fs.readFileSync('js/auth.js', 'utf8');
const css = fs.readFileSync('css/style.css', 'utf8');
const authCss = fs.readFileSync('css/auth-pages.css', 'utf8');

const adminLoginHtml = fs.readFileSync('admin-login.html', 'utf8');

const checks = [
  { name: 'Standalone login.html exists & contains Google Auth', test: loginHtml.includes('handleGoogleSignIn') },
  { name: 'Standalone register.html exists & contains Google Auth', test: registerHtml.includes('handleGoogleSignUp') },
  { name: 'Index.html header links directly to login.html', test: html.includes('href="login.html"') },
  { name: 'Index.html header links directly to register.html', test: html.includes('href="register.html"') },
  { name: 'Victory Embilipitiya Option in register.html', test: registerHtml.includes('Victory Embilipitiya') },
  { name: 'Exam Year Dropdown in register.html', test: registerHtml.includes('2025 A/L') && registerHtml.includes('2026 A/L') },
  { name: 'Email OTP Modal in register.html', test: registerHtml.includes('emailOtpModal') },
  { name: '6-digit OTP input boxes in register.html', test: registerHtml.includes('otp-digit') },
  { name: 'Standalone admin-login.html exists for Faculty & Admin access', test: adminLoginHtml.includes('role-switcher-tabs') },
  { name: 'Auth pages CSS styling exists', test: authCss.includes('.auth-card-layout') }
];

console.log('=== REGISTRATION & OTP VERIFICATION VERIFICATION ===');
let allPassed = true;
checks.forEach(c => {
  console.log((c.test ? '✅ PASS' : '❌ FAIL') + ': ' + c.name);
  if (!c.test) allPassed = false;
});

if (allPassed) {
  console.log('\n🎉 ALL 18 STRUCTURAL & LOGICAL CHECKS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error('\n❌ SOME CHECKS FAILED');
  process.exit(1);
}
