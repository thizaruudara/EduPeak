const fs = require('fs');

const files = [
  'js/data.js',
  'js/translations.js',
  'js/supabase.js',
  'js/auth.js',
  'js/lms.js',
  'js/admin.js',
  'js/teacher.js',
  'js/custom-player.js',
  'js/app.js'
];

let allOk = true;

files.forEach(f => {
  try {
    const code = fs.readFileSync(f, 'utf8');
    new Function(code);
    console.log('✅ ' + f + ' passed syntax validation');
  } catch (e) {
    allOk = false;
    console.error('❌ ' + f + ' error: ' + e.message);
  }
});

if (allOk) {
  console.log('\n🎉 ALL JAVASCRIPT FILES ARE SYNTACTICALLY SOUND & READY!');
}
