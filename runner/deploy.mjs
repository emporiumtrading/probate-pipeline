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
      if (!need) { log.push(`${s.name}: up to date`); continue; }
      await call(key, 'POST', `/services/${s.id}/deploys`, { clearCache: 'do_not_clear' });
      log.push(`${s.name}: deploy started (${head.slice(0, 7)})`);
    } catch (e) { log.push(`${s.name}: ${e.message}`); }
  }
  return log;
}
