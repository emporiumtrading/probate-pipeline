/* server.js — zero-dependency web server for the probate dashboard on Render.
   Serves dashboard/ as a static site (with the dash/claude runtime shim injected
   into index.html), the built datasets under /data, and a small doc-store API
   (/api/doc, /api/col) that replaces the artifact's db backend.

   Everything except /healthz sits behind HTTP basic auth:
     DASHBOARD_USER     (default "owner")
     DASHBOARD_PASSWORD (if unset, a random one is generated and printed at boot)

   Doc persistence: see store.js (GitHub `dashboard-store` branch, or local file). */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store');

const ROOT = path.join(__dirname, '..');
const DASH = path.join(ROOT, 'dashboard');
const DATA = path.join(__dirname, 'data');
const PORT = +(process.env.PORT || 3000);
const USER = process.env.DASHBOARD_USER || 'owner';
const PASS = process.env.DASHBOARD_PASSWORD || crypto.randomBytes(9).toString('base64url');
if (!process.env.DASHBOARD_PASSWORD) console.log(`*** DASHBOARD_PASSWORD not set — generated: ${PASS} ***`);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

const authed = (req) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const [u, p] = Buffer.from(h.slice(6), 'base64').toString().split(':');
  const ok = u === USER && p === PASS;
  return ok && crypto.timingSafeEqual(Buffer.from(u + ':' + p), Buffer.from(USER + ':' + PASS));
};

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
};

const sendFile = (res, file) => {
  fs.readFile(file, (e, buf) => {
    if (e) return send(res, e.code === 'ENOENT' ? 404 : 500, e.code === 'ENOENT' ? 'not found' : 'error');
    send(res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream');
  });
};

// Serve a file only if it resolves inside `dir` (blocks ../ traversal).
const safe = (res, dir, rel) => {
  const f = path.join(dir, rel);
  if (!f.startsWith(dir + path.sep) && f !== dir) return send(res, 403, 'forbidden');
  sendFile(res, f);
};

const page = () => {
  const html = fs.readFileSync(path.join(DASH, 'index.html'), 'utf8');
  const head = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Probate Pipeline</title><link rel="stylesheet" href="/theme.css">' +
    `<script>window.__PP_USER=${JSON.stringify(USER)};</script></head><body>`;
  const injected = html.replace('<script src="app.js">',
    '<script src="/vendor/d3.min.js"></script><script src="/dash-runtime.js"></script><script src="app.js">');
  return head + injected + '</body></html>';
};

const readBody = (req) => new Promise((resolve, reject) => {
  let b = '';
  req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch (e) { reject(e); } });
  req.on('error', reject);
});

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = decodeURIComponent(u.pathname);

  if (p === '/healthz') return send(res, 200, 'ok');
  if (!authed(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="probate-dashboard"' });
    return res.end('auth required');
  }

  try {
    if (p === '/' || p === '/index.html') return send(res, 200, page(), MIME['.html']);
    if (p === '/dash-runtime.js' || p === '/theme.css') return safe(res, __dirname, p.slice(1));
    if (p.startsWith('/vendor/')) return safe(res, __dirname, p.slice(1));
    if (p.startsWith('/data/')) return safe(res, DATA, p.slice(6));

    if (p.startsWith('/api/col/') && req.method === 'GET') {
      return send(res, 200, JSON.stringify(store.listCol(p.slice(9))), MIME['.json']);
    }
    if (p === '/api/doc' && req.method === 'GET') {
      const d = store.getDoc(u.searchParams.get('path') || '');
      return d === null ? send(res, 404, 'not found') : send(res, 200, JSON.stringify(d), MIME['.json']);
    }
    if (p === '/api/doc' && req.method === 'PUT') {
      const body = await readBody(req);
      if (!body.path || typeof body.data !== 'object' || body.data === null) return send(res, 400, 'bad body');
      await store.setDoc(body.path, body.data);
      return send(res, 200, '{}', MIME['.json']);
    }
    if (p === '/api/doc') return send(res, 405, 'method not allowed');

    // Everything else: dashboard assets (app.js, charts.js, ...).
    if (req.method === 'GET') return safe(res, DASH, p.slice(1));
    send(res, 405, 'method not allowed');
  } catch (e) {
    console.error('request failed:', p, e);
    send(res, 500, 'server error');
  }
});

store.init()
  .then(() => server.listen(PORT, () => console.log(`probate-dashboard on :${PORT}`)))
  .catch((e) => { console.error('store init failed:', e); process.exit(1); });
