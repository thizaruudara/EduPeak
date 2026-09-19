const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.apk': 'application/vnd.android.package-archive'
};

const { generateAgoraRtcToken, AGORA_APP_ID } = require('./scripts/generate_agora_token');

const server = http.createServer((req, res) => {
  // CORS Headers for API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Endpoint: /api/agora/token?channel=...&uid=...&role=...
  if (req.url.startsWith('/api/agora/token')) {
    try {
      const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const channel = urlObj.searchParams.get('channel') || 'edupeak_physics_live';
      const uid = urlObj.searchParams.get('uid') || '0';
      const role = urlObj.searchParams.get('role') || 'publisher';
      const days = parseInt(urlObj.searchParams.get('days') || '30', 10);
      const tokenData = generateAgoraRtcToken({ channel, uid, role, expireDays: days });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(tokenData));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  let reqPath = decodeURI(req.url.split('?')[0].split('#')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  let filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  function serveFile(targetPath) {
    fs.stat(targetPath, (err, stats) => {
      if (err) {
        if (!path.extname(targetPath)) {
          const htmlAlternative = targetPath + '.html';
          if (fs.existsSync(htmlAlternative)) {
            return serveFile(htmlAlternative);
          }
        }
        res.statusCode = 404;
        res.end('Not Found: ' + reqPath);
        return;
      }

      if (stats.isDirectory()) {
        targetPath = path.join(targetPath, 'index.html');
      }

      const ext = path.extname(targetPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      if (ext === '.apk') {
        const filename = path.basename(targetPath) || 'EduPeak_v1.0.0.apk';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': stats.size
        });
        fs.createReadStream(targetPath).pipe(res);
        return;
      }

      fs.readFile(targetPath, (err, content) => {
        if (err) {
          res.statusCode = 500;
          res.end('Error loading ' + reqPath);
          return;
        }

        const headers = { 'Content-Type': contentType };
        res.writeHead(200, headers);
        res.end(content);
      });
    });
  }

  serveFile(filePath);
});

server.listen(PORT, () => {
  console.log(`EduPeak Server running on http://localhost:${PORT}`);
});
