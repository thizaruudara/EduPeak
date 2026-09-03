const https = require('https');
const fs = require('fs');

const options = {
  hostname: 'goats.com.pl',
  port: 443,
  path: '/',
  method: 'GET',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
};

const req = https.request(options, res => {
  console.log('Status Code:', res.statusCode);
  if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
    console.log('Redirect to:', res.headers.location);
  }
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    fs.writeFileSync('scripts/goats_raw.html', body);
    console.log('Body length:', body.length);
    console.log('Title:', body.match(/<title>(.*?)<\/title>/i)?.[1]);
    
    // Look for loader / preloader classes or ids or scripts
    const matches = body.match(/class="[^"]*(loader|preload|intro|curtain|splash|screen)[^"]*"/gi);
    console.log('Loader classes in HTML:', matches);
  });
});

req.on('error', e => console.error(e));
req.end();
