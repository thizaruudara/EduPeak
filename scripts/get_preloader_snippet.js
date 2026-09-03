const fs = require('fs');
const js = fs.readFileSync('scripts/goats_index.js', 'utf8');
const start = js.indexOf('.preloader');
if (start !== -1) {
  const slice = js.substring(start - 200, start + 3500);
  fs.writeFileSync('scripts/preloader_snippet.js', slice);
  console.log('Saved snippet, length:', slice.length);
  console.log(slice.substring(0, 1500));
}
