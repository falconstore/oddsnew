// Tiny static file server with SPA fallback. Used pelo deploy autoscale do
// Replit. Zero dependencias externas — usa só http/fs/path do Node stdlib.
//
// Comportamento:
//   - GET /app/*                 → serve pwa/dist/* (PWA Shark Green)
//   - GET /caminho/arquivo.ext   → serve dist/caminho/arquivo.ext (admin)
//   - GET /caminho/              → serve dist/caminho/index.html
//   - 404 (arquivo nao existe)   → serve dist/index.html (SPA fallback admin)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 5000;
const ROOT = path.join(__dirname, 'dist');
const INDEX = path.join(ROOT, 'index.html');
const PWA_ROOT = path.join(__dirname, 'pwa', 'dist');
const PWA_INDEX = path.join(PWA_ROOT, 'index.html');

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
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath, statusOverride) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      return send(res, 500, 'Internal Server Error', { 'Content-Type': 'text/plain' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    const cache = isHtml
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=31536000, immutable';
    send(res, statusOverride ?? 200, data, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cache,
    });
  });
}

// Domínios que devem redirecionar / → /trial automaticamente.
const TRIAL_REDIRECT_HOSTS = new Set([
  'sharkgreen.com.br',
  'www.sharkgreen.com.br',
]);

const server = http.createServer((req, res) => {
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return send(res, 400, 'Bad Request');
  }

  // Bloqueia path traversal
  if (urlPath.includes('..') || urlPath.includes('\0')) {
    return send(res, 400, 'Bad Request');
  }

  // ── PWA: /app e /app/* servidos a partir de pwa/dist/ ────────────────────
  if (urlPath === '/app' || urlPath === '/app/' || urlPath.startsWith('/app/')) {
    // Strip do prefixo /app → caminho dentro de pwa/dist/
    let pwaPath = urlPath === '/app' || urlPath === '/app/'
      ? '/index.html'
      : urlPath.slice(4); // '/app/foo' → '/foo'

    if (pwaPath.endsWith('/')) pwaPath += 'index.html';

    const pwaFile = path.join(PWA_ROOT, pwaPath);
    if (!pwaFile.startsWith(PWA_ROOT)) return send(res, 403, 'Forbidden');

    return fs.stat(pwaFile, (err, stat) => {
      if (!err && stat.isFile()) return serveFile(res, pwaFile);
      // SPA fallback do PWA
      serveFile(res, PWA_INDEX);
    });
  }

  // ── Admin: tudo fora de /app ──────────────────────────────────────────────
  const host = (req.headers['host'] || '').split(':')[0].toLowerCase();
  if (TRIAL_REDIRECT_HOSTS.has(host) && (urlPath === '/' || urlPath === '')) {
    return send(res, 302, '', { Location: '/trial' });
  }

  if (urlPath.endsWith('/')) urlPath += 'index.html';

  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) {
    return send(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      return serveFile(res, filePath);
    }
    serveFile(res, INDEX);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] admin on 0.0.0.0:${PORT} | PWA at /app/ from pwa/dist/`);
});
