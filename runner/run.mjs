/* run.mjs — Render cron entrypoint for the pipeline runners.

   Replaces the claude.ai scheduled sessions with a headless Claude Code run
   against a fresh clone of this repo. Steps:

   1. Clone the pipeline repo (GitHub token auth).
   2. Pull the dashboard doc store (docs.json on the store repo's
      dashboard-store branch) and build the import files the owner_*.py
      scripts expect — replacing the artifact's db_list calls.
   3. Run the slice's prompt file with the first engine that works: Claude
      (`claude -p`, cheap models by default), then NVIDIA, then OpenRouter
      (runner/agent.mjs, same prompt and tools), then scripts/auto_slice.py.
      Order and models come from the dashboard's AI settings. Render rebuilds
      the dashboard on the push.
   4. Backstop `git push` so a slice that forgot still saves.

   Usage: node run.mjs <a|b|c|fast-desk>

   Env: GITHUB_TOKEN (required), PIPELINE_REPO, STORE_REPO, STORE_BRANCH,
        ANTHROPIC_API_KEY / NVIDIA_API_KEY / OPENROUTER_API_KEY (any or none),
        optional CLAUDE_MODEL, NVIDIA_MODEL, OPENROUTER_MODEL, MAX_MINUTES, AGENT_MINUTES. */
'use strict';
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runAgent } from './agent.mjs';
import { syncDeploys } from './deploy.mjs';
import { syncDb } from './dbsync.mjs';

const SLICE = process.argv[2] || 'a';
const PIPELINE_REPO = process.env.PIPELINE_REPO || 'emporiumtrading/probate-pipeline';
const STORE_REPO = process.env.STORE_REPO || 'emporiumtrading/probate-dashboard-store';
const STORE_BRANCH = process.env.STORE_BRANCH || 'dashboard-store';
const TOKEN = process.env.GITHUB_TOKEN;
const WORK = process.env.WORK_DIR || '/tmp/pipeline-work';

if (!TOKEN) { console.error('GITHUB_TOKEN is required'); process.exit(1); }
// Engines are tried in order until one finishes the slice: Claude (cheap models by
// default), then NVIDIA, then OpenRouter's free models (both through runner/agent.mjs,
// which runs the whole slice with tools), then the scripted run (scripts/auto_slice.py),
// which needs no AI at all. The order and the models come from the owner's AI settings
// on the dashboard (store doc .../settings/ai); keys come from this service's env.
const git = (args, opts = {}) => spawnSync('git', args, { cwd: WORK, stdio: 'inherit', ...opts });

const ghApi = async (p) => {
  const res = await fetch(`https://api.github.com${p}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'probate-runner' },
  });
  if (res.status === 404) return null;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GitHub ${p}: ${res.status} ${j.message || ''}`);
  return j;
};

/* ---------- 1. clone ---------- */
fs.rmSync(WORK, { recursive: true, force: true });
let r = spawnSync('git', ['clone', '--quiet', `https://x-access-token:${TOKEN}@github.com/${PIPELINE_REPO}.git`, WORK], { stdio: 'inherit' });
if (r.status !== 0) { console.error('clone failed'); process.exit(1); }
git(['config', 'user.name', 'Pipeline runner']);
git(['config', 'user.email', 'runner@probate-pipeline.local']);

// Commits inside the run identify themselves without touching global config.
const agentEnv = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Pipeline runner', GIT_AUTHOR_EMAIL: 'runner@probate-pipeline.local',
  GIT_COMMITTER_NAME: 'Pipeline runner', GIT_COMMITTER_EMAIL: 'runner@probate-pipeline.local',
};

/* ---------- 2. sync the doc store into import files ---------- */
// store docs.json: {"data/users/<uid>/<collection...>/<docId>": {...fields}}
const storeFile = await ghApi(`/repos/${STORE_REPO}/contents/docs.json?ref=${STORE_BRANCH}`);
const storeDocs = storeFile ? JSON.parse(Buffer.from(storeFile.content, 'base64').toString('utf8')) : {};

const IMP = path.join(WORK, 'store', 'import');
fs.mkdirSync(IMP, { recursive: true });
const importFile = (name, colPath) => {
  const docs = Object.entries(storeDocs)
    .filter(([p]) => p.includes(`/${colPath}/`))
    .map(([p, data]) => ({ id: p.split('/').pop(), data }));
  fs.writeFileSync(path.join(IMP, `${name}.json`), JSON.stringify({ docs }));
  return docs.length;
};
const counts = {
  outreach: importFile('outreach', 'decisions/outreach'), sign: importFile('sign', 'decisions/sign'),
  wire: importFile('wire', 'decisions/wire'), exceptions: importFile('exceptions', 'decisions/exceptions'),
  'setup-areas': importFile('setup-areas', 'setup/areas'),
};
console.log('store import docs:', JSON.stringify(counts));
// The attorney-packet builder needs PyYAML, which the Render jobs' Python doesn't ship: install it once if missing.
if (spawnSync('python3', ['-c', 'import yaml'], { cwd: WORK }).status !== 0) {
  const pip = spawnSync('python3', ['-m', 'pip', 'install', '--user', '--quiet', '--disable-pip-version-check', '--break-system-packages', 'pyyaml'], { cwd: WORK, encoding: 'utf8' });
  console.log(`pyyaml: ${pip.status === 0 ? 'installed' : 'could not install: ' + `${pip.stderr || pip.stdout || ''}`.trim().slice(-200)}`);
}
// Your Setup saves first (owner decision 2026-11-26): the Business identity is written into config.yaml, every
// market's attorney packet is rebuilt from it, and held letter drafts get your details as the sender.
for (const [cmd, label] of [[['scripts/owner_settings.py', 'import', path.join(IMP, 'setup-areas.json')], 'settings'],
  [['scripts/build_attorney_packet.py'], 'packets'], [['scripts/fill_signature.py'], 'drafts']]) {
  const r = spawnSync('python3', cmd, { cwd: WORK, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').filter((l) => !/^wrote /.test(l)).join(' | ');
  console.log(`${label}: ${out.slice(0, 400) || 'ok'}`);
}
// Save what that changed before any engine starts, so the run's workers see it as done, not as stray edits.
spawnSync('git', ['add', '-A', 'config.yaml', 'pipeline/owner-settings.json', 'legal/attorney-packets', 'leads'], { cwd: WORK });
if (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: WORK }).status !== 0) {
  spawnSync('git', ['-c', 'user.name=Pipeline runner', '-c', 'user.email=runner@probate-pipeline.local', 'commit', '-q', '-m', 'Runner: apply your Setup saves (business details, attorney packets, letter signatures)'], { cwd: WORK });
  console.log('setup saves: committed');
}

/* ---------- 3. run the slice ---------- */
// Dynamic: measure the waiting work, pick the starting model from that, climb a
// cheap-to-strong ladder when an attempt fails or its result fails the checks,
// then move to the next engine. The owner's AI settings (dashboard) can switch an
// engine off or cap the strongest Claude model; everything else is automatic.
const aiDoc = Object.entries(storeDocs).find(([p]) => p.endsWith('/settings/ai'));
const AI = (aiDoc && aiDoc[1]) || {};
const FAST = SLICE === 'fast-desk';
const ENGINES_ALL = ['claude', 'nvidia', 'openrouter', 'scripted'];
const order = (Array.isArray(AI.engines) && AI.engines.length ? AI.engines.filter((e) => ENGINES_ALL.includes(e)) : ENGINES_ALL.slice())
  .concat(['scripted']).filter((e, i, a) => a.indexOf(e) === i);

// Full autonomy switch (dashboard → top bar; web/preflight.js checked it before it turned on).
const autoDoc = Object.entries(storeDocs).find(([p]) => p.endsWith('/settings/autonomy'));
const AUTO = (autoDoc && autoDoc[1]) || {};
const FULL = AUTO.full === true;
console.log(`full autonomy: ${FULL ? 'on' : 'off'}`);
// Test the sending/signing services and switch their channels on or off (runner/channels.py).
{ const c = spawnSync('python3', ['runner/channels.py'], { cwd: WORK, env: agentEnv, encoding: 'utf8' }); process.stdout.write(c.stdout || ''); }

const wl = JSON.parse(spawnSync('python3', ['runner/workload.py', SLICE], { cwd: WORK, encoding: 'utf8' }).stdout || '{"level":"light"}');
console.log('workload:', JSON.stringify(wl));

const CLAUDE_LADDER = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
const capAt = CLAUDE_LADDER.indexOf(AI.claudeMax || 'claude-sonnet-5-5');
const LADDERS = {
  claude: CLAUDE_LADDER.slice(0, capAt < 0 ? 2 : capAt + 1),
  // NVIDIA and OpenRouter retire free models often, so their ladders are picked when the engine is
  // first needed (runner/pick_models.py: what the provider offers now, tool-capable, test-called).
  // These lists are only the last resort if the provider's model list can't be read at all.
  nvidia: ['meta/llama-3.3-70b-instruct', 'qwen/qwen3-coder-480b-a35b-instruct', 'deepseek-ai/deepseek-v3.1', 'openai/gpt-oss-120b'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'qwen/qwen3-coder:free', 'deepseek/deepseek-chat-v3.1:free'],
};
const picked = {};
const pickLadder = (eng) => {
  if (picked[eng] || !['nvidia', 'openrouter'].includes(eng)) return;
  picked[eng] = true;
  const prefer = (eng === 'nvidia' ? AI.nvidiaModels : AI.openrouterModels) || [];
  const r = spawnSync('python3', ['runner/pick_models.py', eng, '--n', '4', ...(prefer.length ? ['--prefer', prefer.join(',')] : [])],
    { cwd: WORK, env: engineEnv, encoding: 'utf8', timeout: 180000 });
  const list = (r.stdout || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (list.length) { LADDERS[eng] = list; console.log(`${eng} models picked: ${list.join(', ')}`); }
  else console.log(`${eng}: couldn't pick models (${(r.stderr || 'none usable').trim().slice(0, 200)}); using the last-known list`);
};
const startAt = (eng) => Math.min(wl.level === 'heavy' ? 1 : 0, LADDERS[eng].length - 1);
const budget = { claude: +(process.env.MAX_MINUTES || (FAST ? 40 : 120)), agent: +(process.env.AGENT_MINUTES || (FAST ? 40 : 100)), scripted: FAST ? 10 : 30 };
const hasKey = { claude: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN),
  nvidia: !!process.env.NVIDIA_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY, scripted: true };
// Engines never see the Render key; the backup agents' shells get no AI keys either.
const engineEnv = { ...agentEnv }; delete engineEnv.RENDER_API_KEY; delete engineEnv.DATABASE_URL;   // only the runner itself deploys and writes the database
const shellEnv = { ...engineEnv }; for (const k of ['NVIDIA_API_KEY', 'OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN']) delete shellEnv[k];

const promptPath = path.join(WORK, 'runner', 'prompts', `${SLICE}.md`);
if (!fs.existsSync(promptPath)) { console.error(`no prompt for slice '${SLICE}' (${promptPath})`); process.exit(1); }
const basePrompt = fs.readFileSync(promptPath, 'utf8');
const FULL_NOTE = 'FULL AUTONOMY IS ON. The owner turned it on after every check passed. Follow .claude/skills/probate-wholesale-deal/references/full-autonomy.md for the whole run.\n\n';
const REPAIR = 'Before the job below: self-repair. Follow .claude/skills/probate-wholesale-deal/references/self-repair.md (at most 25 minutes), then do the job.\n\n';
const CLAUDE_BIN = path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules', '.bin', 'claude');

// Run a process, mirror its output, and keep the tail for diagnosis.
const runProc = (cmd, args, env, minutes) => new Promise((resolve) => {
  // stdin closed: `claude -p` reads piped input before it starts, so an open pipe made it wait forever
  // (every Claude attempt sat silent until the time limit killed it, exit 143).
  const child = spawn(cmd, args, { cwd: WORK, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  const take = (d, out) => { out.write(d); tail = (tail + d).slice(-20000); };
  child.stdout.on('data', (d) => take(d, process.stdout)); child.stderr.on('data', (d) => take(d, process.stderr));
  const kill = setTimeout(() => { tail += `\n[timeout after ${minutes}m]`; child.kill('SIGTERM'); }, minutes * 60000);
  child.on('close', (c) => { clearTimeout(kill); resolve({ code: c, tail }); });
});
const ACCOUNT = /credit balance|billing|insufficient|quota|invalid.{0,20}(api.?key|x-api-key)|authentication|unauthori[sz]ed|permission denied|rate.?limit|overloaded|api errors: 40[1-3]|api errors: 429/i;

const undoCommits = (base, author, paths, label) => {
  const shas = spawnSync('git', ['log', '--format=%H', `--author=${author}`, `${base}..HEAD`, '--', ...paths], { cwd: WORK, encoding: 'utf8' }).stdout.trim().split('\n').filter(Boolean);
  if (!shas.length) return '';
  const files = new Set();
  for (const c of shas) {       // newest first, so each reverse patch applies cleanly
    const diff = spawnSync('git', ['diff', `${c}^`, c, '--', ...paths], { cwd: WORK, encoding: 'utf8' }).stdout;
    spawnSync('git', ['diff', '--name-only', `${c}^`, c, '--', ...paths], { cwd: WORK, encoding: 'utf8' }).stdout.trim().split('\n').forEach((f) => f && files.add(f));
    spawnSync('git', ['apply', '-R', '--3way'], { cwd: WORK, input: diff, encoding: 'utf8' });
  }
  git(['add', '-A', '--', ...files]);
  git(['commit', '-q', '-m', `Runner: undo ${label}'s changes to protected files`]);
  return `undid ${label}'s changes to protected files: ${[...files].join(', ')}`;
};
// Hermes (the orchestrator, hermes/) may change code and worker instructions, but never the guardrails.
// Every run audits Hermes's commits since the last audit and undoes any change to these files.
const HERMES_PROTECTED = ['web/ops-api.js', 'web/ai.js', 'web/server.js', 'scripts/qa_checks.py', 'scripts/guardrails.sha256', 'scripts/check_page.py', 'scripts/sign_check.py', 'scripts/reserve.py',
  'runner/run.mjs', 'hermes', '.claude/skills/probate-wholesale-deal/references/self-repair.md', '.claude/skills/probate-wholesale-deal/references/full-autonomy.md'];
{
  const mark = path.join(WORK, 'pipeline', 'hermes-audit.txt');
  const last = fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8').trim() : '';
  const known = last && spawnSync('git', ['cat-file', '-e', `${last}^{commit}`], { cwd: WORK }).status === 0;
  const h = known ? undoCommits(last, 'Hermes', HERMES_PROTECTED, 'Hermes') : '';
  if (h) console.log(h);
  fs.writeFileSync(mark, spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORK, encoding: 'utf8' }).stdout.trim() + '\n');
  git(['add', 'pipeline/hermes-audit.txt']);
  if (spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: WORK }).status !== 0) git(['commit', '-q', '-m', 'Runner: Hermes audit mark']);
}

const startSha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORK, encoding: 'utf8' }).stdout.trim();
const PROTECTED = ['scripts/qa_checks.py', 'scripts/guardrails.sha256', 'scripts/check_page.py', 'scripts/sign_check.py', 'scripts/reserve.py', 'runner', 'render.yaml', 'CLAUDE.md',
  '.claude/skills/probate-wholesale-deal/references/daily-run.md', '.claude/skills/probate-wholesale-deal/agents',
  '.claude/skills/probate-wholesale-deal/references/full-autonomy.md', '.claude/skills/probate-wholesale-deal/references/self-repair.md', 'web'];
const tidy = () => { git(['checkout', '--', '.', ':!store']); git(['clean', '-fdq', '-e', 'store']); };
const commitAs = (label) => {
  git(['add', '-A']);
  const d = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
  if (d.stdout.trim()) git(['commit', '-q', '-m', `Scheduled run ${new Date().toISOString().slice(0, 10)} slice ${SLICE} (${label})`]);
};
// Undo changes this run's own commits made to protected files (other people's commits
// pulled in during the run are left alone). That counts against the attempt.
const guard = () => undoCommits(startSha, 'Pipeline runner', PROTECTED, `slice ${SLICE}`);


// The run's result must build and pass the QA checks (numbers, privacy, compliance, guardrails).
const verify = () => {
  const dir = path.join(WORK, '..', 'verify-data');
  fs.rmSync(dir, { recursive: true, force: true });
  const b = spawnSync('python3', ['scripts/build_dashboard_data.py', dir], { cwd: WORK, encoding: 'utf8' });
  const q = b.status === 0 ? spawnSync('python3', ['scripts/qa_checks.py', dir], { cwd: WORK, encoding: 'utf8' }) : b;
  return { ok: q.status === 0, out: ((q.stdout || '') + (q.stderr || '')).split('\n').filter((l) => /FAIL|Error|QA:/.test(l)).slice(-15).join('\n') };
};
// Failure tails are kept in memory and written once at the end, so the clean-up
// between attempts can't delete them.
const failures = [];
const saveFailure = (label, text) => failures.push([label, String(text || '').slice(-12000)]);
const writeFailures = () => {
  if (!failures.length) return;
  const dir = path.join(WORK, 'pipeline', 'runner-failures');
  fs.mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  failures.forEach(([label, text], i) => fs.writeFileSync(path.join(dir, `${ts}-${SLICE}-${i + 1}-${label.replace(/[^\w.-]+/g, '_')}.log`), text));
  const files = fs.readdirSync(dir).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 40))) fs.rmSync(path.join(dir, f));
};

let code = 1, used = 'none', verified = 'skip', feedback = '';
const notes = [];
engines: for (const eng of order) {
  if (!hasKey[eng]) { notes.push(`${eng}: no key`); continue; }
  if (eng !== 'scripted' && wl.level === 'idle') { notes.push('nothing waiting: no AI needed'); continue; }
  if (eng === 'scripted') {
    console.log(`--- slice ${SLICE} | scripted engine | ${new Date().toISOString()} ---`);
    const r = await runProc('python3', ['scripts/auto_slice.py', SLICE], engineEnv, budget.scripted);
    code = r.code; used = 'scripted'; commitAs('scripted');
    const g = guard(); if (g) notes.push(g);
    const v = verify(); verified = v.ok ? 'pass' : 'fail';
    if (!v.ok) { notes.push('scripted: checks failed'); saveFailure('scripted-verify', v.out); }
    break;
  }
  const deadline = Date.now() + (eng === 'claude' ? budget.claude : budget.agent) * 60000;
  pickLadder(eng);
  for (let i = startAt(eng); i < LADDERS[eng].length; i++) {
    const model = LADDERS[eng][i];
    const minutes = Math.floor((deadline - Date.now()) / 60000);
    if (minutes < 5) { notes.push(`${eng}: out of time`); break; }
    const prompt = (FULL ? FULL_NOTE : '') + (wl.repair ? REPAIR : '') + (feedback ? `The previous attempt's result failed the checks:\n${feedback}\nFix that first, then finish the job.\n\n` : '') + basePrompt;
    console.log(`--- slice ${SLICE} | ${eng} ${model} | ${wl.level} | ${new Date().toISOString()} ---`);
    let ok, why, tail = '';
    if (eng === 'claude') {
      // IS_SANDBOX: the job runs in its own throwaway container; newer Claude Code refuses to skip permission prompts as root without it.
      const r = await runProc(CLAUDE_BIN, ['-p', prompt, '--model', model, '--dangerously-skip-permissions', '--verbose'], { ...engineEnv, IS_SANDBOX: '1' }, minutes);
      ok = r.code === 0; why = `exit ${r.code}`; tail = r.tail;
    } else {
      const r = await runAgent({ provider: eng, model, prompt, cwd: WORK, env: shellEnv, minutes });
      ok = r.ok; why = r.reason; tail = r.reason;
    }
    if (ok) commitAs(`${eng} ${model}`); else tidy();
    const g = guard(); if (g) { notes.push(`${model}: ${g}`); ok = false; why = g; }
    if (ok) {
      const v = verify();
      if (v.ok) { code = 0; used = `${eng} ${model}`; verified = 'pass'; break engines; }
      feedback = v.out; why = 'result failed the checks'; tail = v.out;
    }
    notes.push(`${eng} ${model}: ${why}`); saveFailure(`${eng}-${model}`, tail);
    console.log(`--- ${eng} ${model} did not finish cleanly (${why}) ---`);
    if (ACCOUNT.test(tail)) { notes.push(`${eng}: account, key or limit problem, skipping its other models`); break; }
  }
}
console.log(`--- engine used: ${used} | checks: ${verified}${notes.length ? ' | ' + notes.join('; ') : ''} ---`);

// Record the run so the next one can see failures and repair them.
try { notes.unshift(`board:${JSON.parse(spawnSync('python3', ['runner/workload.py', SLICE], { cwd: WORK, encoding: 'utf8' }).stdout).board}`); } catch { /* no board */ }
const hp = path.join(WORK, 'pipeline', 'runner-health.csv');
if (!fs.existsSync(hp)) fs.writeFileSync(hp, 'date,slice,level,engine,result,verify,notes\n');
const csvq = (v) => `"${String(v).replace(/"/g, "'").replace(/\s+/g, ' ').slice(0, 400)}"`;
const anyAI = ['claude', 'nvidia', 'openrouter'].some((e) => hasKey[e] && order.includes(e));
const result = code !== 0 || used === 'none' ? 'fail' : (used === 'scripted' && anyAI && wl.level !== 'idle' ? 'fallback' : 'ok');
writeFailures();
fs.appendFileSync(hp, [new Date().toISOString(), SLICE, wl.level, used, result, verified, notes.join('; ')].map(csvq).join(',') + '\n');
commitAs('run record');

// The owner's notices: signature needed, deposit confirmed, deal closed with profit (runner/notify.py).
{
  const vd = path.join(WORK, '..', 'verify-data');
  if (!fs.existsSync(path.join(vd, 'queues.csv'))) spawnSync('python3', ['scripts/build_dashboard_data.py', vd], { cwd: WORK });
  const n = spawnSync('python3', ['runner/notify.py', vd], { cwd: WORK, encoding: 'utf8', env: { ...engineEnv, OWNER_NOTIFY_EMAIL: AUTO.notifyEmail || '' } });
  process.stdout.write((n.stdout || '') + (n.stderr || ''));
  commitAs('owner notices');
}

/* ---------- 4. backstop push ---------- */
git(['add', '-A']);
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
if (dirty.stdout.trim()) git(['commit', '-m', `Runner slice ${SLICE} (uncommitted leftovers)`]);
git(['pull', '--rebase', 'origin', 'main']);
git(['push', 'origin', 'HEAD:main']);

/* ---------- 5. copy everything into Postgres (runner/dbsync.mjs); the repo stays the source of truth ---------- */
// The dashboard reads its data live from the database, so only a build that passed the checks is published.
// Rebuilt after the run's last commits (run record, notices) and checked again before publishing.
const finalCheck = verified === 'pass' ? verify() : { ok: false };
const checkedData = finalCheck.ok ? path.join(WORK, '..', 'verify-data') : '';
if (!checkedData) console.log('db sync: dashboard data not published (checks did not pass)');
try { console.log(await syncDb({ cwd: WORK, storeDocs, slice: SLICE, dataDir: checkedData })); } catch (e) { console.log('db sync: failed', e.message); }

/* ---------- 6. deploy what changed (Render's deploy-on-push isn't firing) ---------- */
try { for (const l of await syncDeploys(WORK)) console.log('deploy:', l); } catch (e) { console.log('deploy: failed', e.message); }
process.exit(code ?? 0);
