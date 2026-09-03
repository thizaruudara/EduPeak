const fs = require('fs');

const cssFiles = [
  'css/style.css',
  'css/lms.css',
  'css/admin.css',
  'css/auth-pages.css',
  'css/teacher.css'
];

let hasError = false;

cssFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  let openBraces = 0;
  let lineNum = 1;
  let inComment = false;
  
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') lineNum++;
    
    if (!inComment && content[i] === '/' && content[i+1] === '*') {
      inComment = true;
      i++;
      continue;
    }
    if (inComment && content[i] === '*' && content[i+1] === '/') {
      inComment = false;
      i++;
      continue;
    }
    if (inComment) continue;
    
    if (content[i] === '{') openBraces++;
    if (content[i] === '}') {
      openBraces--;
      if (openBraces < 0) {
        console.error(`❌ ${file} - Extra closing brace '}' around line ${lineNum}`);
        hasError = true;
      }
    }
  }
  
  if (openBraces !== 0) {
    console.error(`❌ ${file} - Unbalanced braces! ${openBraces} unclosed '{' remaining`);
    hasError = true;
  } else {
    console.log(`✅ ${file} - All braces perfectly balanced!`);
  }
});

if (!hasError) {
  console.log('\n🎉 ALL CSS FILES ARE 100% BALANCED AND VALID!');
}
