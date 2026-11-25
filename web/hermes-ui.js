/* hermes-ui.js — chat with Hermes, the orchestrator of the pipeline (Render site only).
   A "Hermes" tab and a corner button on every page. Messages stream through the dashboard
   server (/api/hermes/chat), which holds Hermes's key. The conversation is kept in this
   browser; Hermes keeps its own memory on its side. */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  };
  const STORE = 'hermes-chat-v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || null; } catch { return null; } };
  const newConv = () => ({ session: Math.random().toString(36).slice(2, 12), messages: [] });
  let conv = load() || newConv();
  const save = () => { conv.messages = conv.messages.slice(-60); localStorage.setItem(STORE, JSON.stringify(conv)); };

  const section = h('section', { class: 'pp-page', id: 'hermes', hidden: '' });
  const status = h('p', { class: 'pp-sub', 'aria-live': 'polite', text: 'Checking Hermes…' });
  const log = h('div', { role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with Hermes',
    style: 'display:flex;flex-direction:column;gap:10px;max-height:62vh;overflow:auto;padding:4px 2px;margin:8px 0' });
  const input = h('textarea', { rows: '3', placeholder: 'Ask Hermes anything, or tell it what to do. Enter sends; Shift+Enter for a new line.', 'aria-label': 'Message to Hermes',
    style: 'width:100%;box-sizing:border-box;padding:10px;border-radius:8px;border:1px solid #ccc;font:inherit;resize:vertical' });
  const sendBtn = h('button', { type: 'button', class: 'pp-btn pp-btn-primary', text: 'Send' });
  const stopBtn = h('button', { type: 'button', class: 'pp-btn', text: 'Stop', hidden: '' });
  const newBtn = h('button', { type: 'button', class: 'pp-btn', text: 'New conversation' });
  let ctrl = null;

  const bubble = (role, text) => {
    const mine = role === 'user';
    const b = h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:85%;padding:10px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;` +
      (mine ? 'background:#1f2a44;color:#fff' : 'background:#f4f3ee;border:1px solid #e5e5e5') });
    b.append(h('div', { class: 'pp-sub', style: `margin:0 0 4px;font-size:12px;${mine ? 'color:#cfd6e6' : ''}`, text: mine ? 'You' : 'Hermes' }));
    const body = h('div', { text });
    b.append(body);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return body;
  };
  const render = () => {
    log.replaceChildren();
    if (!conv.messages.length) log.append(h('p', { class: 'pp-sub', text: 'Hermes runs the pipeline for you. Try: "How did today\'s runs go?", "What needs my signature?", "Start the midday run now", or "Why didn\'t the Houston market produce leads?"' }));
    conv.messages.forEach((m) => bubble(m.role, m.content));
  };

  const send = async () => {
    const text = input.value.trim();
    if (!text || ctrl) return;
    input.value = '';
    if (!conv.messages.length) log.replaceChildren();
    conv.messages.push({ role: 'user', content: text }); save();
    bubble('user', text);
    const out = bubble('assistant', '');
    const steps = h('div', { class: 'pp-sub', style: 'margin:6px 0 0;font-size:12px' });
    out.parentNode.append(steps);
    out.textContent = '…';
    ctrl = new AbortController();
    sendBtn.disabled = true; stopBtn.hidden = false;
    let answer = '';
    try {
      const r = await fetch('/api/hermes/chat', { method: 'POST', credentials: 'same-origin', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: conv.session, messages: conv.messages }) });
      if (!r.ok || !r.body) throw new Error(await r.text().catch(() => `error ${r.status}`));
      const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '', ev = 'message';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).replace(/\r$/, ''); buf = buf.slice(i + 1);
          if (!line) { ev = 'message'; continue; }
          if (line.startsWith('event:')) { ev = line.slice(6).trim(); continue; }
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          let j; try { j = JSON.parse(data); } catch { continue; }
          if (ev === 'hermes.tool.progress' || j.object === 'hermes.tool.progress') {
            const what = j.tool || j.name || (j.data && (j.data.tool || j.data.name)) || 'working';
            const detail = j.label || j.preview || j.status || (j.data && (j.data.label || j.data.preview)) || '';
            steps.textContent = `Working: ${what}${detail ? ' · ' + String(detail).slice(0, 120) : ''}`;
            continue;
          }
          const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
          if (d && d.content) { answer += d.content; out.textContent = answer; log.scrollTop = log.scrollHeight; }
        }
      }
      steps.textContent = '';
      if (!answer) { answer = '(Hermes finished without a written answer.)'; out.textContent = answer; }
    } catch (e) {
      if (e.name === 'AbortError') { answer = answer ? answer + '\n\n(stopped)' : '(stopped)'; out.textContent = answer; }
      else { out.textContent = answer || `Couldn't reach Hermes: ${String(e.message || e).slice(0, 200)}`; if (!answer) { conv.messages.pop(); save(); ctrl = null; sendBtn.disabled = false; stopBtn.hidden = true; return; } }
    }
    conv.messages.push({ role: 'assistant', content: answer }); save();
    ctrl = null; sendBtn.disabled = false; stopBtn.hidden = true;
    input.focus();
  };

  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', () => ctrl && ctrl.abort());
  newBtn.addEventListener('click', () => { if (ctrl) ctrl.abort(); conv = newConv(); save(); render(); input.focus(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  const checkStatus = async () => {
    try {
      const r = await fetch('/api/hermes/status', { credentials: 'same-origin' }); const j = await r.json();
      status.textContent = j.ok ? 'Hermes is online and running the pipeline. It can answer questions, start runs, work the task board and fix problems, inside the guardrails.' : `Hermes isn't available yet: ${j.reason}.`;
    } catch { status.textContent = 'Hermes status unavailable.'; }
  };

  const mount = () => {
    const nav = document.querySelector('.pp-tabs');
    const setup = document.getElementById('setup');
    if (!nav || !setup || document.getElementById('hermes')) return;
    section.append(h('div', { class: 'pp-card' }, h('h2', { text: 'Hermes' }), status, log, input,
      h('div', { style: 'display:flex;gap:8px;margin-top:8px' }, sendBtn, stopBtn, newBtn)));
    setup.parentNode.insertBefore(section, setup.nextSibling);
    const tab = h('button', { class: 'pp-tab', role: 'tab', 'data-page': 'hermes', 'aria-selected': 'false', text: 'Hermes' });
    nav.append(tab);
    const show = () => {
      if (window.PP && window.PP.show) window.PP.show('hermes');
      else { document.querySelectorAll('.pp-page').forEach((s) => { s.hidden = s.id !== 'hermes'; }); location.hash = 'hermes'; }
      checkStatus(); input.focus();
    };
    tab.addEventListener('click', show);
    document.body.append(h('button', { type: 'button', class: 'pp-btn pp-btn-primary', 'aria-label': 'Chat with Hermes', text: 'Ask Hermes',
      style: 'position:fixed;right:18px;bottom:18px;z-index:50;box-shadow:0 4px 14px rgba(0,0,0,.18)', onclick: () => { show(); window.scrollTo({ top: 0 }); } }));
    render();
    if (location.hash === '#hermes') show();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
