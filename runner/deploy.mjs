/* deploy.mjs — keep Render in step with main without manual deploys.

   Render's own deploy-on-push isn't firing for this repo, so the runner does it:
   after every run's push, the dashboard is redeployed if it isn't on the newest
   commit (its build is what turns the repo into the dashboard's data), and each
   runner cron job is redeployed if runner/ changed since the commit it runs.
   Needs RENDER_API_KEY (the dashboard copies it to the runner jobs). */
import { spawnSync } from 'node:child_process';

const API = 'https://api.render.com/v1';
const DASH = process.env.DASHBOARD_SERVICE || 'probate-dashboard';
const CRONS = (process.env.RUNNER_SERVICES || 'probate-slice-a,probate-slice-b,probate-slice-c,probate-fast-desk').split(',').map((s) => s.trim());

const call = async (key, method, p, body) => {
  const r = await fetch(API + p, { method, signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`Render ${method} ${p.split('?')[0]}: ${r.status}`);
  return r.json().catch(() => null);
};

export async function syncDeploys(cwd) {
  const key = process.env.RENDER_API_KEY;
  if (!key) return ['auto-deploy skipped: no RENDER_API_KEY on this job yet'];
  const log = [];
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).stdout.trim();
  const HERMES = process.env.HERMES_SERVICE || 'probate-hermes';
  const names = [DASH, ...CRONS, HERMES];
  const list = await call(key, 'GET', `/services?${names.map((n) => 'name=' + encodeURIComponent(n)).join('&')}&limit=50`);
  for (const { service: s } of list || []) {
    if (!names.includes(s.name)) continue;
    try {
      const d = ((await call(key, 'GET', `/services/${s.id}/deploys?limit=1`)) || [])[0];
      const dep = d && d.deploy;
      const at = dep && dep.commit && dep.commit.id;
      if (dep && /progress|created|pending/.test(dep.status || '')) { log.push(`${s.name}: deploy already running`); continue; }
      let need;
      if (s.name === DASH) {
        // With the database connected the site reads its data live, so it only needs a deploy when its code changed.
        // Without it, the site's data comes from its build, so every new commit needs a deploy.
        const code = at ? spawnSync('git', ['diff', '--name-only', at, head, '--', 'web/', 'dashboard/', 'scripts/build_dashboard_data.py', 'scripts/qa_checks.py'], { cwd, encoding: 'utf8' }) : { status: 1 };
        need = !process.env.DATABASE_URL ? at !== head : (!at || code.status !== 0 || !!code.stdout.trim());
      }
      else if (s.name === HERMES) {
        // Hermes's image is built from hermes/; its workspace pulls the repo itself.
        const diff = at ? spawnSync('git', ['diff', '--name-only', at, head, '--', 'hermes/'], { cwd, encoding: 'utf8' }) : { status: 1 };
        need = !at || diff.status !== 0 || !!diff.stdout.trim();
      }
      else {
        const diff = at ? spawnSync('git', ['diff', '--name-only', at, head, '--', 'runner/'], { cwd, encoding: 'utf8' }) : { status: 1 };
        need = !at || diff.status !== 0 || !!diff.stdout.trim();
      }
      if (s.name === DASH) log.push(...await ensureDomains(key, s.id));
      if (!need) { log.push(`${s.name}: up to date`); continue; }
      await call(key, 'POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' });
      log.push(`${s.name}: deploy started (${head.slice(0, 7)})`);
    } catch (e) { log.push(`${s.name}: ${e.message}`); }
  }
  return log;
}

/* The dashboard's custom domains (owner decision 2026-11-27): www.<domain> and the bare domain serve the public company
   page, app.<domain> the dashboard (web/server.js decides by host). Added once, then re-checked each run until Render
   reports them verified (that needs the DNS records at the domain's DNS host; Render issues the certificates). */
const SITE_DOMAIN = (process.env.SITE_DOMAIN || 'emporium-investments.com').toLowerCase();
async function ensureDomains(key, id) {
  const want = [`www.${SITE_DOMAIN}`, SITE_DOMAIN, `app.${SITE_DOMAIN}`];
  const out = [];
  try {
    const have = Object.fromEntries(((await call(key, 'GET', `/services/${id}/custom-domains?limit=50`)) || [])
      .map((x) => x.customDomain || x).map((d) => [String(d.name).toLowerCase(), d]));
    for (const name of want) {
      let d = have[name];
      if (!d) {
        try { d = await call(key, 'POST', `/services/${id}/custom-domains`, { name }); d = (Array.isArray(d) ? d[0] : d) || {}; d = d.customDomain || d; out.push(`domain ${name}: added`); }
        catch (e) { out.push(`domain ${name}: ${e.message}`); continue; }
      }
      if (d && d.verificationStatus && d.verificationStatus !== 'verified') {
        await call(key, 'POST', `/services/${id}/custom-domains/${encodeURIComponent(d.id || name)}/verify`).catch(() => null);
        out.push(`domain ${name}: ${d.verificationStatus} (waiting for its DNS record)`);
      }
    }
  } catch (e) { out.push(`domains: ${e.message}`); }
  return out;
}
