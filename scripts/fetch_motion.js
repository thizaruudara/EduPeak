const https = require('https');
const fs = require('fs');

function fetchURL(url, dest) {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      fs.writeFileSync(dest, data);
      console.log('Saved', dest, data.length, 'bytes');
    });
  });
}

fetchURL('https://examples.motion.dev/assets/index-Cpu3CUE2.js', 'scripts/motion_js.js');
fetchURL('https://examples.motion.dev/assets/index-BuZv3YIA.css', 'scripts/motion_css.css');
