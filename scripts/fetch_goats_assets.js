const https = require('https');
const fs = require('fs');

function fetchFile(url, dest) {
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      fs.writeFileSync(dest, data);
      console.log('Saved', dest, data.length, 'bytes');
    });
  });
}

fetchFile('https://goats.com.pl/wp-content/themes/goats/assets/build/js/index.js', 'scripts/goats_index.js');
