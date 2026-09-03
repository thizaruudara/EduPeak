const fs = require('fs');
const html = fs.readFileSync('scripts/goats_raw.html', 'utf8');

// Find the preloader block
const preloaderMatch = html.match(/<div class="preloader"[\s\S]*?<\/div>\s*<\/div>/i);
if (preloaderMatch) {
  console.log('--- PRELOADER HTML ---');
  console.log(preloaderMatch[0]);
} else {
  const startIdx = html.indexOf('class="preloader"');
  if (startIdx !== -1) {
    console.log(html.substring(startIdx - 20, startIdx + 800));
  }
}

// Find any CSS links or inline styles
const cssMatches = html.match(/href="([^"]+\.css[^"]*)"/g);
console.log('CSS links:', cssMatches);

// Find any JS links
const jsMatches = html.match(/src="([^"]+\.js[^"]*)"/g);
console.log('JS links:', jsMatches);
