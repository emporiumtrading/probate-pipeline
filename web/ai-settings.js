/* ai-settings.js — "AI engines" card on the Setup page (Render site only).
   Keys go to /api/ai/key, which checks them and saves them on the runner cron jobs
   in Render; this page never stores or shows a full key. Models and the on/off
   choice per engine are saved in the doc store (data/users/<user>/settings/ai),
   which every run reads before it starts. */
(function () {
  'use strict';
  const USER = window.__PP_USER || 'owner';
  const DOC = `data/users/${USER}/settings/ai`;
  const ENGINES = [
    { id: 'claude', name: 'Claude', key: 'ANTHROPIC_API_KEY', note: 'Runs first. Billed to your Anthropic account.',
      models: [['claude-haiku-5-5', 'Haiku 5.5 (cheapest)'], ['claude-sonnet-5-5', 'Sonnet 5.5'], ['claude-opus-5-5', 'Opus 5.5 (most expensive)']],
      defaults: { mainRuns: 'claude-sonnet-5-5', fastDesk: 'claude-haiku-5-5' } },
    { id: 'nvidia', name: 'NVIDIA', key: 'NVIDIA_API_KEY', note: 'Backup: runs the whole job if Claude fails or runs out. Free tier at build.nvidia.com.',
      models: [['meta/llama-3.3-70b-instruct', 'Llama 3.3 70B'], ['qwen/qwen3-coder-480b-a35b-instruct', 'Qwen3 Coder'], ['deepseek-ai/deepseek-v3.1', 'DeepSeek V3.1'], ['openai/gpt-oss-120b', 'gpt-oss 120B']],
      defaults: { mainRuns: 'meta/llama-3.3-70b-instruct', fastDesk: 'meta/llama-3.3-70b-instruct' } },
    { id: 'openrouter', name: 'OpenRouter (free models)', key: 'OPENROUTER_API_KEY', note: 'Second backup, free models.',
      models: [['meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (free)'], ['qwen/qwen3-coder:free', 'Qwen3 Coder (free)'], ['deepseek/deepseek-chat-v3.1:free', 'DeepSeek V3.1 (free)']],
      defaults: { mainRuns: 'meta-llama/llama-3.3-70b-instruct:free', fastDesk: 'meta-llama/llama-3.3-70b-instruct:free' } },
  ];
  const SERVICES = [
    { name: 'Email (Resend)', key: 'RESEND_API_KEY', note: 'Sends email to estates and buyers, reads replies, and sends you the deposit and closing notices. Verify your business email domain in Resend first.' },
    { name: 'Letters by mail (Lob)', key: 'LOB_API_KEY', note: 'Prints and mails letters. Use the live_ key; test keys never mail anything.' },
    { name: 'E-signature (DocuSeal)', key: 'DOCUSEAL_API_KEY', note: 'Sends contracts to you and the seller for one-tap signature.' },
  ];
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c) e.append(c);
    return e;
  };
  const api = async (url, opts) => { const r = await fetch(url, { credentials: 'same-origin', ...opts }); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* text */ } return { ok: r.ok, status: r.status, j, t }; };

  let settings = {};
  const saveSettings = async (msgEl) => {
    settings.updated = new Date().toISOString();
    const r = await api('/api/doc', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: DOC, data: settings }) });
    msgEl.textContent = r.ok ? 'Saved. The next run uses it.' : `Not saved (${r.status}).`;
  };

  const capPicker = (msgEl) => {
    const sel = h('select', { 'aria-label': 'Strongest Claude model allowed' },
      ...[['claude-haiku-5-5', 'Haiku 5.5 only (cheapest)'], ['claude-sonnet-5-5', 'Up to Sonnet 5.5 (recommended)'], ['claude-opus-5-5', 'Up to Opus 5.5 (most expensive)']]
        .map(([v, l]) => h('option', { value: v, text: l })));
    sel.value = settings.claudeMax || 'claude-sonnet-5-5';
    sel.addEventListener('change', () => { settings.claudeMax = sel.value; saveSettings(msgEl); });
    return h('div', {}, h('p', { class: 'pp-sub', text: 'Models are picked automatically: each run measures the work waiting and starts with Haiku for routine work or Sonnet for deep-dives, negotiation and repairs, and moves up a model if an attempt fails or its result fails the checks. Nothing waiting: no AI is used at all.' }),
      h('label', {}, h('span', { text: 'Strongest Claude model allowed: ' }), sel));
  };

  const keyRow = (eng, st, msgEl, refresh) => {
    const k = st.keys[eng.key] || {};
    const state = h('span', { class: 'pp-sub', text: k.set ? `Key set, ending …${k.last4}` : 'No key yet' });
    const inp = h('input', { type: 'password', autocomplete: 'off', placeholder: k.set ? 'Paste a new key to replace it' : 'Paste the API key', 'aria-label': `${eng.name} API key`, style: 'min-width:18rem' });
    const save = h('button', { type: 'button', class: 'pp-btn pp-btn-primary', text: 'Save key', onclick: async () => {
      if (!inp.value.trim()) return;
      save.disabled = true; msgEl.textContent = 'Checking the key with the provider…';
      const r = await api('/api/ai/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: eng.key, value: inp.value.trim() }) });
      inp.value = ''; save.disabled = false;
      msgEl.textContent = r.ok ? `Saved on the runners (ending …${r.j.last4}). They redeploy and use it from the next run.` : `Not saved: ${(r.j && r.j.error) || r.status}`;
      if (r.ok) { refresh(); window.dispatchEvent(new Event('pp-setup-saved')); }
    } });
    const del = k.set ? h('button', { type: 'button', class: 'pp-btn', text: 'Remove', onclick: async () => {
      if (!confirm(`Remove the ${eng.name} key from the runners?`)) return;
      const r = await api('/api/ai/key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: eng.key, value: '' }) });
      msgEl.textContent = r.ok ? 'Removed.' : `Not removed: ${(r.j && r.j.error) || r.status}`;
      if (r.ok) refresh();
    } }) : null;
    return h('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0' }, inp, save, del, state);
  };

  const render = async (card) => {
    const [st, doc] = await Promise.all([api('/api/ai'), api(`/api/doc?path=${encodeURIComponent(DOC)}`)]);
    settings = (doc.ok && doc.j) || {};
    card.replaceChildren();
    card.append(h('h2', { text: 'AI engines for the scheduled runs' }),
      h('p', { class: 'pp-sub', text: 'Every run tries the engines in this order and moves to the next if one fails or runs out: Claude, then NVIDIA, then OpenRouter, then the built-in scripted run (no AI). Each AI engine can run the whole job. Every result must pass the pipeline checks; a run that fails is repaired automatically by the next one, and no run can change the guardrails (hard limits, autonomy). Keys are checked with the provider, then saved only on the runner jobs in Render; this page never shows them again.' }));
    if (!st.ok) { card.append(h('p', { class: 'pp-sub', text: `Couldn't load the AI settings (${st.status}).` })); return; }
    if (!st.j.renderReady) card.append(h('p', { class: 'pp-sub', role: 'alert', text: 'One-time step: add RENDER_API_KEY (Render → Account settings → API keys) to the probate-dashboard service\'s Environment in Render. Until then, keys can\'t be saved from here.' }));
    const on = settings.engines || ['claude', 'nvidia', 'openrouter', 'scripted'];
    for (const eng of ENGINES) {
      const msg = h('p', { class: 'pp-sub', 'aria-live': 'polite' });
      const toggle = h('input', { type: 'checkbox', 'aria-label': `Use ${eng.name}` });
      toggle.checked = on.includes(eng.id);
      toggle.addEventListener('change', () => {
        const set = new Set(settings.engines || ['claude', 'nvidia', 'openrouter', 'scripted']);
        if (toggle.checked) set.add(eng.id); else set.delete(eng.id);
        settings.engines = ['claude', 'nvidia', 'openrouter', 'scripted'].filter((e) => set.has(e) || e === 'scripted');
        saveSettings(msg);
      });
      card.append(h('div', { class: 'pp-card', style: 'margin:10px 0' },
        h('h3', {}, h('label', {}, toggle, document.createTextNode(` ${eng.name}`))),
        h('p', { class: 'pp-sub', text: eng.note }),
        keyRow(eng, st.j, msg, () => render(card)),
        eng.id === 'claude' ? capPicker(msg) : h('p', { class: 'pp-sub', text: 'Models are picked by themselves each run: the system asks the provider which free models it offers that day, keeps the ones that can do the work, tests them, and starts with the quickest. Retired models are skipped without anyone touching this page.' }),
        msg));
    }
    card.append(h('p', { class: 'pp-sub', text: 'Last resort: the scripted run always stays on, so a run still happens with no AI at all.' }));
    card.append(h('h2', { text: 'Sending and signing services' }),
      h('p', { class: 'pp-sub', text: 'The workers send letters, email and signature packets through these. Each key is checked when you save it; the next run tests the service and switches the channel on by itself.' }));
    for (const svc of SERVICES) {
      const msg = h('p', { class: 'pp-sub', 'aria-live': 'polite' });
      card.append(h('div', { class: 'pp-card', style: 'margin:10px 0' }, h('h3', { text: svc.name }), h('p', { class: 'pp-sub', text: svc.note }),
        keyRow(svc, st.j, msg, () => render(card)), msg));
    }
  };

  const mount = () => {
    const setup = document.getElementById('setup');
    if (!setup || document.getElementById('ai-engines')) return;
    const card = h('div', { class: 'pp-card', id: 'ai-engines' });
    const head = document.getElementById('setup-head');
    if (head && head.nextSibling) setup.insertBefore(card, head.nextSibling); else setup.append(card);
    render(card).catch((e) => { card.textContent = `AI settings failed to load: ${e.message}`; });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
