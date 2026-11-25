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
import { runAgent, PROVIDERS } from './agent.mjs';

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

/* ---------- 3. run the slice ---------- */
const aiDoc = Object.entries(storeDocs).find(([p]) => p.endsWith('/settings/ai'));
const AI = (aiDoc && aiDoc[1]) || {};
const FAST = SLICE === 'fast-desk';
const ENGINES_ALL = ['claude', 'nvidia', 'openrouter', 'scripted'];
let order = Array.isArray(AI.engines) && AI.engines.length ? AI.engines.filter((e) => ENGINES_ALL.includes(e))
  : (process.env.ENGINE && !['auto', 'scripted'].includes(process.env.ENGINE) ? [process.env.ENGINE] : ENGINES_ALL.slice());
if (!order.includes('scripted')) order.push('scripted');            // the no-AI run is always the last resort
const pick = (o, fallback) => (o && (FAST ? o.fastDesk : o.mainRuns)) || fallback;
const claudeModel = pick(AI.claude, process.env.CLAUDE_MODEL || (FAST ? 'claude-haiku-5-5' : 'claude-sonnet-5-5'));
const agentModel = (prov) => pick(AI[prov], process.env[`${prov.toUpperCase()}_MODEL`] || PROVIDERS[prov].defaultModel);
const budget = { claude: +(process.env.MAX_MINUTES || (FAST ? 30 : 110)), agent: +(process.env.AGENT_MINUTES || (FAST ? 30 : 90)), scripted: FAST ? 10 : 30 };
const hasKey = { claude: !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_OAUTH_TOKEN),
  nvidia: !!process.env.NVIDIA_API_KEY, openrouter: !!process.env.OPENROUTER_API_KEY, scripted: true };
// Agents get no provider keys in their shell; the scripted run keeps them for its summaries.
const noKeys = { ...agentEnv }; delete noKeys.NVIDIA_API_KEY; delete noKeys.OPENROUTER_API_KEY; delete noKeys.ANTHROPIC_API_KEY; delete noKeys.CLAUDE_CODE_OAUTH_TOKEN;

const promptPath = path.join(WORK, 'runner', 'prompts', `${SLICE}.md`);
if (!fs.existsSync(promptPath)) { console.error(`no prompt for slice '${SLICE}' (${promptPath})`); process.exit(1); }
const prompt = fs.readFileSync(promptPath, 'utf8');
const CLAUDE_BIN = path.join(path.dirname(new URL(import.meta.url).pathname), 'node_modules', '.bin', 'claude');

const runProc = (cmd, args, env, minutes) => new Promise((resolve) => {
  const child = spawn(cmd, args, { cwd: WORK, env, stdio: 'inherit' });
  const kill = setTimeout(() => { console.error(`timeout after ${minutes}m, stopping`); child.kill('SIGTERM'); }, minutes * 60000);
  child.on('close', (c) => { clearTimeout(kill); resolve(c); });
});
// After an engine fails, drop its uncommitted half-work (its commits stay) before the next one starts.
const tidy = () => { git(['checkout', '--', '.', ':!store']); git(['clean', '-fdq', '-e', 'store']); };
const commitAs = (label) => {
  git(['add', '-A']);
  const d = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
  if (d.stdout.trim()) git(['commit', '-q', '-m', `Scheduled run ${new Date().toISOString().slice(0, 10)} slice ${SLICE} (${label})`]);
};

let code = 1, used = 'none';
const tried = [];
for (const eng of order) {
  if (!hasKey[eng]) { tried.push(`${eng}: no key`); continue; }
  const t0 = Date.now();
  if (eng === 'claude') {
    console.log(`--- slice ${SLICE} | claude ${claudeModel} | ${new Date().toISOString()} ---`);
    const c = await runProc(CLAUDE_BIN, ['-p', prompt, '--model', claudeModel, '--dangerously-skip-permissions', '--verbose'], agentEnv, budget.claude);
    if (c === 0) { code = 0; used = `claude ${claudeModel}`; commitAs(used); break; }
    tried.push(`claude ${claudeModel}: exit ${c}`); tidy();
  } else if (eng === 'nvidia' || eng === 'openrouter') {
    const model = agentModel(eng);
    console.log(`--- slice ${SLICE} | ${eng} ${model} | ${new Date().toISOString()} ---`);
    const r = await runAgent({ provider: eng, model, prompt, cwd: WORK, env: noKeys, minutes: budget.agent });
    if (r.ok) { code = 0; used = `${eng} ${model}`; commitAs(used); break; }
    tried.push(`${eng} ${model}: ${r.reason}`); tidy();
  } else {
    console.log(`--- slice ${SLICE} | scripted engine | ${new Date().toISOString()} ---`);
    code = await runProc('python3', ['scripts/auto_slice.py', SLICE], agentEnv, budget.scripted);
    used = 'scripted'; commitAs('scripted'); break;
  }
  console.log(`--- ${eng} did not finish after ${Math.round((Date.now() - t0) / 60000)}m; trying the next engine ---`);
}
console.log(`--- engine used: ${used}${tried.length ? ' | skipped/failed: ' + tried.join('; ') : ''} ---`);

/* ---------- 4. backstop push ---------- */
git(['add', '-A']);
const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: WORK, encoding: 'utf8' });
if (dirty.stdout.trim()) git(['commit', '-m', `Runner slice ${SLICE} (uncommitted leftovers)`]);
git(['pull', '--rebase', 'origin', 'main']);
git(['push', 'origin', 'HEAD:main']);
process.exit(code ?? 0);
