/* server.js — zero-dependency web server for the probate dashboard on Render.
   Serves dashboard/ as a static site (with the dash/claude runtime shim injected
   into index.html), the built datasets under /data, and a small doc-store API
   (/api/doc, /api/col) that replaces the artifact's db backend.

   Everything except /healthz and the landing page sits behind an admin login (signed session cookie):
     DASHBOARD_USER     (default "owner")
     DASHBOARD_PASSWORD (if unset, a random one is generated and printed at boot)

   Doc persistence: see store.js (GitHub `dashboard-store` branch, or local file). */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const ai = require('./ai');
const { Readable } = require('stream');

// Hermes (the orchestrator, service probate-hermes): the dashboard's chat is proxied to its
// OpenAI-compatible API so its key never reaches the browser.
const HERMES_URL = (process.env.HERMES_URL || '').replace(/\/+$/, '');
const HERMES_KEY = process.env.HERMES_API_KEY || '';
const preflight = require('./preflight');
const db = require('./db');

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

/* Sessions: signed cookie (HMAC-SHA256), 12-hour lifetime, HttpOnly + Secure + SameSite=Strict.
   Failed logins are rate-limited per IP (5 per 15 minutes). */
const SECRET = crypto.createHash('sha256').update('ei-session|' + (process.env.SESSION_SECRET || PASS)).digest();
const COOKIE = 'ei_session';
const TTL = 12 * 3600 * 1000;
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('base64url');
const makeToken = () => { const v = Buffer.from(JSON.stringify({ u: USER, exp: Date.now() + TTL })).toString('base64url'); return v + '.' + sign(v); };
const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]).map(([k, ...v]) => [k, v.join('=')]));
const authed = (req) => {
  const tok = cookies(req)[COOKIE] || '';
  const [v, s] = tok.split('.');
  if (!v || !s) return false;
  const want = sign(v);
  if (want.length !== s.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(s))) return false;
  try { const d = JSON.parse(Buffer.from(v, 'base64url').toString()); return d.u === USER && d.exp > Date.now(); } catch { return false; }
};
const eq = (a, b) => { const x = crypto.createHash('sha256').update(String(a)).digest(); const y = crypto.createHash('sha256').update(String(b)).digest(); return crypto.timingSafeEqual(x, y); };
const fails = new Map();
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const limited = (ip) => { const f = (fails.get(ip) || []).filter((t) => t > Date.now() - 15 * 60000); fails.set(ip, f); return f.length >= 5; };
const readForm = (req) => new Promise((resolve) => {
  let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e4) req.destroy(); });
  req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(b))));
});
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Strict-Transport-Security': 'max-age=31536000' };
const landing = (msg) => fs.readFileSync(path.join(__dirname, 'landing.html'), 'utf8')
  .replace('<!--MSG-->', msg ? `<p class="err" role="alert">${msg}</p>` : '');

const send = (res, code, body, type = 'text/plain; charset=utf-8') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SEC_HEADERS });
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
    `<script>window.__PP_USER=${JSON.stringify(USER)};</script></head><body>` +
    '<div class="ei-bar"><span class="ei-brand">Emporium Investments</span><a class="ei-out" href="/logout">Sign out</a></div>';
  const injected = html.replace('<script src="app.js">',
    '<script src="/vendor/d3.min.js"></script><script src="/dash-runtime.js"></script><script src="/ai-settings.js" defer></script><script src="/autonomy-ui.js" defer></script><script src="/ops-ui.js" defer></script><script src="/data-ui.js" defer></script><script src="/hermes-ui.js" defer></script><script src="app.js">');
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
  if (p === '/brand.svg') return safe(res, __dirname, 'brand.svg');
  if (p === '/login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (limited(ip)) return send(res, 429, landing('Too many attempts. Try again in 15 minutes.'), MIME['.html']);
    const f = await readForm(req);
    if (eq(f.username || '', USER) && eq(f.password || '', PASS)) {
      fails.delete(ip);
      res.writeHead(303, { Location: '/', 'Set-Cookie': `${COOKIE}=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL / 1000}`, ...SEC_HEADERS });
      return res.end();
    }
    fails.set(ip, [...(fails.get(ip) || []), Date.now()]);
    console.log('login failed from', ip);
    return send(res, 401, landing('That username and password don\'t match.'), MIME['.html']);
  }
  if (p === '/logout') {
    res.writeHead(303, { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`, ...SEC_HEADERS });
    return res.end();
  }
  if (!authed(req)) {
    if (req.method === 'GET' && (p === '/' || p === '/index.html' || p === '/login')) return send(res, 200, landing(''), MIME['.html']);
    return send(res, 401, 'login required');
  }

  try {
    if (p === '/' || p === '/index.html') return send(res, 200, page(), MIME['.html']);
    if (p === '/dash-runtime.js' || p === '/theme.css' || p === '/ai-settings.js' || p === '/autonomy-ui.js' || p === '/ops-ui.js' || p === '/data-ui.js' || p === '/hermes-ui.js') return safe(res, __dirname, p.slice(1));
    if (p.startsWith('/vendor/')) return safe(res, __dirname, p.slice(1));
    if (p.startsWith('/data/')) {
      // Live from the database (the latest checked run); the files built at deploy are the fallback.
      const name = p.slice(6);
      if (/^[\w.-]+\.(csv|json)$/.test(name)) {
        const row = await db.getData(name);
        if (row) {
          res.setHeader('X-Data-Built', new Date(row.builtAt).toISOString());
          return send(res, 200, row.content, MIME[path.extname(name)] || 'text/plain; charset=utf-8');
        }
      }
      return safe(res, DATA, name);
    }
    // Hermes chat: status, and a streaming proxy to Hermes's /v1/chat/completions.
    if (p === '/api/hermes/status' && req.method === 'GET') {
      if (!HERMES_URL || !HERMES_KEY) return send(res, 200, JSON.stringify({ ok: false, reason: 'Hermes isn\'t connected to the dashboard yet' }), MIME['.json']);
      try {
        const r = await fetch(`${HERMES_URL}/health/detailed`, { headers: { Authorization: `Bearer ${HERMES_KEY}` }, signal: AbortSignal.timeout(20000) });
        const j = await r.json().catch(() => ({}));
        return send(res, 200, JSON.stringify(r.ok ? { ok: true, detail: j } : { ok: false, reason: `Hermes answered ${r.status} (it may still be starting)` }), MIME['.json']);
      } catch (e) { return send(res, 200, JSON.stringify({ ok: false, reason: 'Hermes is starting or asleep; try again in a minute' }), MIME['.json']); }
    }
    if (p === '/api/hermes/chat' && req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, 'json only');
      if (!HERMES_URL || !HERMES_KEY) return send(res, 503, 'Hermes isn\'t connected to the dashboard yet');
      const body = await readBody(req);
      const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-40)
        .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content.slice(0, 20000) }));
      if (!messages.length || messages[messages.length - 1].role !== 'user') return send(res, 400, 'bad body');
      const session = String(body.session || 'owner').replace(/[^\w.-]/g, '').slice(0, 64) || 'owner';
      const ac = new AbortController();
      res.on('close', () => { if (!res.writableEnded) ac.abort(); });
      let up;
      try {
        up = await fetch(`${HERMES_URL}/v1/chat/completions`, { method: 'POST', signal: ac.signal,
          headers: { Authorization: `Bearer ${HERMES_KEY}`, 'Content-Type': 'application/json', 'X-Hermes-Session-Id': `dashboard-${session}` },
          body: JSON.stringify({ model: 'hermes', stream: true, messages }) });
      } catch (e) { return send(res, 502, 'Hermes is starting or unreachable; try again in a minute'); }
      if (!up.ok || !up.body) return send(res, 502, `Hermes answered ${up.status}`);
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...SEC_HEADERS });
      Readable.fromWeb(up.body).on('error', () => res.end()).pipe(res);
      return;
    }

    // Data page: read-only browse of the database (web/db.js → browse).
    if (p.startsWith('/api/dbview/') && req.method === 'GET') {
      const fn = Object.prototype.hasOwnProperty.call(db.browse, p.slice(12)) ? db.browse[p.slice(12)] : null;
      if (!fn) return send(res, 404, 'not found');
      try { return send(res, 200, JSON.stringify(await fn(Object.fromEntries(u.searchParams))), MIME['.json']); }
      catch (e) {
        if (!e.status) console.error('dbview failed:', p, e.message);
        return send(res, e.status || 500, JSON.stringify({ error: e.status ? e.message : 'query failed' }), MIME['.json']);
      }
    }
    if (p === '/api/data-status' && req.method === 'GET') return send(res, 200, JSON.stringify(await db.status()), MIME['.json']);

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

    // Full autonomy switch (see preflight.js): the server re-checks before turning it on.
    if (p === '/api/autonomy' && req.method === 'GET') return send(res, 200, JSON.stringify(await preflight.check(USER)), MIME['.json']);
    if ((p === '/api/autonomy' || p === '/api/autonomy/notify') && req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, 'json only');
      const body = await readBody(req);
      const r = p === '/api/autonomy' ? await preflight.setSwitch(USER, body.on === true) : await preflight.setNotify(USER, body.email);
      console.log(`autonomy ${p.endsWith('notify') ? 'notice email' : (body.on ? 'on' : 'off')}: ${r.ok ? 'ok' : r.error}`);
      return send(res, r.ok ? 200 : 400, JSON.stringify(r), MIME['.json']);
    }

    // AI engine keys: stored only as env vars on the runner cron jobs (see ai.js).
    if (p === '/api/ai' && req.method === 'GET') return send(res, 200, JSON.stringify(await ai.status()), MIME['.json']);
    if (p === '/api/ai/key' && req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, 'json only');
      const body = await readBody(req);
      const r = await ai.setKey(String(body.name || ''), body.value ? String(body.value) : '');
      console.log(`ai key ${body.name} ${body.value ? 'save' : 'remove'}: ${r.ok ? 'ok' : r.error}`);
      return send(res, r.ok ? 200 : 400, JSON.stringify(r), MIME['.json']);
    }

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
