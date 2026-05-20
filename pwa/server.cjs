const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5173;
const ROOT = path.join(__dirname, 'dist');
const INDEX = path.join(ROOT, 'index.html');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain' });
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    send(res, 200, data, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': isHtml ? 'no-cache, no-store, must-revalidate' : 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' });
    return;
  }

  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch { return send(res, 400, 'Bad Request'); }

  if (urlPath.includes('..') || urlPath.includes('\0')) return send(res, 400, 'Bad Request');
  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) return serveFile(res, filePath);
    serveFile(res, INDEX);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[pwa-server] serving dist/ on 0.0.0.0:${PORT}`);
});
