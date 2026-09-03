const fs = require('fs');
const js = fs.readFileSync('scripts/motion_js.js', 'utf8');

const regex = /"assets\/[^"]+\.js"/g;
let m;
const files = [];
while ((m = regex.exec(js)) !== null) {
  files.push(m[0].replace(/"/g, ''));
}
console.log('Total asset js files:', files.length);

// Let's filter files that might be related to scroll text
const https = require('https');

files.forEach(f => {
  const url = 'https://examples.motion.dev/' + f;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      if (body.includes('scroll') && (body.includes('line') || body.includes('ticker') || body.includes('direction'))) {
        console.log('Found candidate:', f, 'size:', body.length);
        if (body.includes('velocity') || body.includes('translate') || body.includes('scroll-text')) {
          console.log('--- SAMPLE OF ' + f + ' ---');
          console.log(body.substring(0, 1000));
          fs.writeFileSync('scripts/' + f.replace(/[\/\\]/g, '_'), body);
        }
      }
    });
  });
});
