const fs = require('fs');
const html = fs.readFileSync('scripts/goats_raw.html', 'utf8');

const regex = /<link[^>]*href="([^"]+)"[^>]*>/g;
let m;
while ((m = regex.exec(html)) !== null) {
  if (m[1].includes('.css')) {
    console.log(m[1]);
  }
}
