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

  const modelPicker = (eng, which, msgEl) => {
    const cur = (settings[eng.id] && settings[eng.id][which]) || eng.defaults[which];
    const listId = `ai-${eng.id}-${which}`;
    const inp = h('input', { list: listId, value: cur, 'aria-label': `${eng.name} model for ${which === 'mainRuns' ? 'main runs' : 'fast desk'}`, style: 'min-width:16rem' });
    const dl = h('datalist', { id: listId }, ...eng.models.map(([v, l]) => h('option', { value: v, label: l })));
    inp.addEventListener('change', () => {
      settings[eng.id] = { ...(settings[eng.id] || {}), [which]: inp.value.trim() || eng.defaults[which] };
      saveSettings(msgEl);
    });
    return h('label', { style: 'display:block;margin:4px 0' }, h('span', { text: which === 'mainRuns' ? 'Main runs (A, B, C): ' : 'Fast desk: ' }), inp, dl);
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
      if (r.ok) refresh();
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
      h('p', { class: 'pp-sub', text: 'Every run tries the engines in this order and moves to the next if one fails or runs out: Claude, then NVIDIA, then OpenRouter, then the built-in scripted run (no AI). Each AI engine can run the whole job. Keys are checked with the provider, then saved only on the runner jobs in Render; this page never shows them again.' }));
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
        modelPicker(eng, 'mainRuns', msg), modelPicker(eng, 'fastDesk', msg), msg));
    }
    card.append(h('p', { class: 'pp-sub', text: 'Last resort: the scripted run always stays on, so a run still happens with no AI at all.' }));
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
