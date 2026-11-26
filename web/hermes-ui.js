/* hermes-ui.js — chat with Hermes, the orchestrator of the pipeline (Render site only).
   A floating chat window over the app: the "Ask Hermes" button (and the Hermes tab) opens it;
   it can be dragged by its title bar, resized from its corner, minimized and closed, and it
   remembers where it was. The app stays usable behind it.
   Messages stream through the dashboard server (/api/hermes/chat), which holds Hermes's key.
   Hermes confirms every task you give it: tasks are tracked (/api/hermes/tasks) and a
   "Done" or "Couldn't finish" note arrives in the chat when each one ends, even if it ends
   later, after the window was closed (the button shows a badge). */
(function () {
  'use strict';
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v); }
    for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c);
    return e;
  };
  const STORE = 'hermes-chat-v1', WIN = 'hermes-window-v1', SEEN = 'hermes-tasks-seen-v1';
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const newConv = () => ({ session: Math.random().toString(36).slice(2, 12), messages: [] });
  let conv = load(STORE, null) || newConv();
  const save = () => { conv.messages = conv.messages.slice(-60); localStorage.setItem(STORE, JSON.stringify(conv)); };
  let win = load(WIN, { open: false, min: false, w: 400, h: 560, x: null, y: null });
  const saveWin = () => localStorage.setItem(WIN, JSON.stringify(win));
  let seen = load(SEEN, {});

  /* ---------- styles ---------- */
  document.head.append(h('style', { text: `
    #hermes-win{position:fixed;z-index:1000;display:flex;flex-direction:column;background:#fff;border:1px solid #d9d6ce;border-radius:12px;
      box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden;resize:both;min-width:300px;min-height:260px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px)}
    #hermes-win[hidden]{display:none}
    #hermes-win.min{resize:none;min-height:0;height:auto!important}
    #hermes-win.min .hw-body{display:none}
    #hermes-win .hw-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#1f2a44;color:#fff;cursor:move;user-select:none;touch-action:none}
    #hermes-win .hw-bar b{flex:1;font-size:14px}
    #hermes-win .hw-dot{width:8px;height:8px;border-radius:50%;background:#999}
    #hermes-win .hw-bar button{background:transparent;border:0;color:#fff;font-size:16px;line-height:1;width:28px;height:26px;border-radius:6px;cursor:pointer}
    #hermes-win .hw-bar button:hover,#hermes-win .hw-bar button:focus-visible{background:rgba(255,255,255,.18);outline:none}
    #hermes-win .hw-body{flex:1;display:flex;flex-direction:column;min-height:0;padding:8px 10px 10px;gap:6px}
    #hermes-win .hw-log{flex:1;overflow:auto;display:flex;flex-direction:column;gap:8px;padding:2px}
    #hermes-win .hw-tasks{font-size:12px;color:#6f6c66;max-height:72px;overflow:auto}
    #hermes-win textarea{width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid #ccc;font:inherit;resize:none}
    #hermes-launch .hw-badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:9px;background:#b5402a;color:#fff;font-size:12px;line-height:18px}
    @media (max-width:600px){#hermes-win{left:8px!important;right:8px;top:auto!important;bottom:8px;width:auto!important;height:70vh!important;resize:none}}
  ` }));

  /* ---------- window ---------- */
  const dot = h('span', { class: 'hw-dot', title: 'Checking the assistant…' });
  const minBtn = h('button', { type: 'button', 'aria-label': 'Minimize', title: 'Minimize', text: '–' });
  const closeBtn = h('button', { type: 'button', 'aria-label': 'Close', title: 'Close', text: '×' });
  const newBtn = h('button', { type: 'button', 'aria-label': 'New conversation', title: 'New conversation', text: '+' });
  const bar = h('div', { class: 'hw-bar' }, dot, h('b', { text: 'Probate AI Assistant' }), newBtn, minBtn, closeBtn);
  const status = h('p', { class: 'pp-sub', style: 'margin:0;font-size:12px', 'aria-live': 'polite', text: 'Checking the assistant…' });
  const tasksBox = h('div', { class: 'hw-tasks', 'aria-live': 'polite' });
  const log = h('div', { class: 'hw-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with the Probate AI Assistant' });
  const input = h('textarea', { rows: '2', placeholder: 'Ask the assistant, or give it a task. Enter sends; Shift+Enter for a new line.', 'aria-label': 'Message to the Probate AI Assistant' });
  const sendBtn = h('button', { type: 'button', class: 'pp-btn pp-btn-primary', text: 'Send' });
  const stopBtn = h('button', { type: 'button', class: 'pp-btn', text: 'Stop', hidden: '' });
  const panel = h('div', { id: 'hermes-win', role: 'dialog', 'aria-label': 'Chat with the Probate AI Assistant', hidden: '' },
    bar, h('div', { class: 'hw-body' }, status, tasksBox, log, input, h('div', { style: 'display:flex;gap:8px' }, sendBtn, stopBtn)));
  const badge = h('span', { class: 'hw-badge', hidden: '' });
  const launch = h('button', { type: 'button', id: 'hermes-launch', class: 'pp-btn pp-btn-primary', 'aria-label': 'Chat with the Probate AI Assistant',
    style: 'position:fixed;right:18px;bottom:18px;z-index:999;box-shadow:0 4px 14px rgba(0,0,0,.18)' }, 'Probate AI Assistant', badge);

  const clamp = () => {
    const r = panel.getBoundingClientRect();
    const maxX = Math.max(8, innerWidth - r.width - 8), maxY = Math.max(8, innerHeight - (win.min ? r.height : Math.min(r.height, innerHeight - 16)) - 8);
    if (win.x === null || win.y === null) { win.x = innerWidth - win.w - 18; win.y = innerHeight - win.h - 18; }
    win.x = Math.min(Math.max(8, win.x), maxX); win.y = Math.min(Math.max(8, win.y), maxY);
    panel.style.left = win.x + 'px'; panel.style.top = win.y + 'px';
  };
  const apply = () => {
    panel.hidden = !win.open; launch.hidden = win.open && !win.min;
    panel.classList.toggle('min', !!win.min);
    minBtn.textContent = win.min ? '▢' : '–'; minBtn.title = minBtn.ariaLabel = win.min ? 'Restore' : 'Minimize';
    panel.style.width = win.w + 'px'; if (!win.min) panel.style.height = win.h + 'px';
    if (win.open) clamp();
    saveWin();
  };
  const open = () => { win.open = true; win.min = false; apply(); checkStatus(); refreshTasks(); markSeen(); input.focus(); log.scrollTop = log.scrollHeight; };
  const close = () => { win.open = false; apply(); launch.focus(); };
  minBtn.addEventListener('click', (e) => { e.stopPropagation(); win.min = !win.min; apply(); if (!win.min) { markSeen(); input.focus(); } });
  closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
  launch.addEventListener('click', open);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  bar.addEventListener('dblclick', (e) => { if (e.target === bar || e.target.tagName === 'B') { win.min = !win.min; apply(); } });

  // Drag by the title bar.
  let drag = null;
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    drag = { dx: e.clientX - panel.offsetLeft, dy: e.clientY - panel.offsetTop };
    bar.setPointerCapture(e.pointerId);
  });
  bar.addEventListener('pointermove', (e) => { if (!drag) return; win.x = e.clientX - drag.dx; win.y = e.clientY - drag.dy; clamp(); });
  bar.addEventListener('pointerup', () => { if (drag) { drag = null; saveWin(); } });
  // Remember the size after a resize from the corner.
  new ResizeObserver(() => {
    if (panel.hidden || win.min || innerWidth <= 600) return;
    const w = Math.round(panel.offsetWidth), hh = Math.round(panel.offsetHeight);
    if (w && hh && (w !== win.w || hh !== win.h)) { win.w = w; win.h = hh; saveWin(); }
  }).observe(panel);
  addEventListener('resize', () => { if (win.open) clamp(); });

  /* ---------- conversation ---------- */
  let ctrl = null;
  const bubble = (role, text, note) => {
    const mine = role === 'user';
    const b = h('div', { style: `align-self:${mine ? 'flex-end' : 'flex-start'};max-width:88%;padding:8px 10px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;font-size:14px;` +
      (mine ? 'background:#1f2a44;color:#fff' : note ? 'background:#eef6f0;border:1px solid #cfe5d6' : 'background:#f4f3ee;border:1px solid #e5e5e5') });
    b.append(h('div', { style: `margin:0 0 3px;font-size:11px;${mine ? 'color:#cfd6e6' : 'color:#6f6c66'}`, text: mine ? 'You' : note ? 'AI Assistant · task update' : 'AI Assistant' }));
    const body = h('div', { text });
    b.append(body);
    log.append(b);
    log.scrollTop = log.scrollHeight;
    return body;
  };
  const render = () => {
    log.replaceChildren();
    if (!conv.messages.length) log.append(h('p', { class: 'pp-sub', style: 'font-size:13px', text: 'The Probate AI Assistant runs the pipeline for you and confirms every task when it is done. Try: "How did today\'s runs go?", "What needs my signature?", "Start the midday run now", or "Which market makes us the most money?"' }));
    conv.messages.forEach((m) => bubble(m.role, m.content, m.note));
  };

  const send = async () => {
    const text = input.value.trim();
    if (!text || ctrl) return;
    input.value = '';
    if (!conv.messages.length) log.replaceChildren();
    conv.messages.push({ role: 'user', content: text }); save();
    bubble('user', text);
    const out = bubble('assistant', '…');
    const steps = h('div', { style: 'margin:4px 0 0;font-size:11px;color:#6f6c66' });
    out.parentNode.append(steps);
    ctrl = new AbortController();
    sendBtn.disabled = true; stopBtn.hidden = false;
    let answer = '';
    try {
      const r = await fetch('/api/hermes/chat', { method: 'POST', credentials: 'same-origin', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: conv.session, messages: conv.messages.filter((m) => !m.note) }) });
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
            steps.textContent = `Working: ${what}${detail ? ' · ' + String(detail).slice(0, 100) : ''}`;
            continue;
          }
          const d = j.choices && j.choices[0] && (j.choices[0].delta || j.choices[0].message);
          if (d && d.content) { answer += d.content; out.textContent = answer; log.scrollTop = log.scrollHeight; }
        }
      }
      steps.textContent = '';
      if (!answer) { answer = '(The assistant finished without a written answer.)'; out.textContent = answer; }
    } catch (e) {
      steps.textContent = '';
      if (e.name === 'AbortError') { answer = answer ? answer + '\n\n(stopped)' : '(stopped)'; out.textContent = answer; }
      else {
        out.textContent = answer || `Couldn't reach the assistant: ${String(e.message || e).slice(0, 200)}`;
        if (!answer) { conv.messages.pop(); save(); ctrl = null; sendBtn.disabled = false; stopBtn.hidden = true; return; }
      }
    }
    conv.messages.push({ role: 'assistant', content: answer }); save();
    ctrl = null; sendBtn.disabled = false; stopBtn.hidden = true;
    input.focus();
    refreshTasks();
  };
  sendBtn.addEventListener('click', send);
  stopBtn.addEventListener('click', () => ctrl && ctrl.abort());
  newBtn.addEventListener('click', (e) => { e.stopPropagation(); if (ctrl) ctrl.abort(); conv = newConv(); save(); render(); input.focus(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  /* ---------- status and task confirmations ---------- */
  const checkStatus = async () => {
    try {
      const j = await (await fetch('/api/hermes/status', { credentials: 'same-origin' })).json();
      dot.style.background = j.ok ? '#3fb871' : '#d08a2a';
      dot.title = status.textContent = j.ok ? 'Online: answers questions, starts runs, directs the workers and fixes problems, inside the guardrails.' : `Not available yet: ${j.reason}.`;
    } catch { dot.style.background = '#999'; status.textContent = 'Assistant status unavailable.'; }
  };
  let unseen = [];
  const markSeen = () => {
    for (const t of unseen) seen[t.id] = t.status;
    unseen = []; badge.hidden = true;
    localStorage.setItem(SEEN, JSON.stringify(seen));
  };
  const refreshTasks = async () => {
    let list;
    try { const r = await fetch('/api/hermes/tasks', { credentials: 'same-origin' }); if (!r.ok) return; list = await r.json(); } catch { return; }
    const openT = list.filter((t) => t.status === 'open');
    tasksBox.replaceChildren(...(openT.length ? [h('div', { text: `Working on ${openT.length === 1 ? 'one task' : openT.length + ' tasks'}:` }),
      ...openT.slice(0, 5).map((t) => h('div', { text: `• ${t.title}${t.progress ? ' (' + t.progress + ')' : ''}` }))] : []));
    // A finished task Hermes hasn't confirmed to this browser yet becomes a note in the chat.
    const first = !Object.keys(seen).length;
    for (const t of list.filter((x) => x.status !== 'open' && seen[x.id] !== x.status)) {
      if (first) { seen[t.id] = t.status; continue; }   // first visit: don't replay old history
      const msg = `${t.status === 'done' ? '✅ Done' : '⚠️ Couldn\'t finish'}: ${t.title}${t.result ? '\n' + t.result : ''}`;
      conv.messages.push({ role: 'assistant', content: msg, note: true }); save();
      if (log.querySelector('p.pp-sub')) log.replaceChildren();
      bubble('assistant', msg, true);
      unseen.push(t); seen[t.id] = t.status;
    }
    localStorage.setItem(SEEN, JSON.stringify(seen));
    if (win.open && !win.min) markSeen();
    else if (unseen.length) { badge.textContent = String(unseen.length); badge.hidden = false; }
  };

  /* ---------- mount ---------- */
  const mount = () => {
    if (document.getElementById('hermes-win')) return;
    document.body.append(panel, launch);
    const nav = document.querySelector('.pp-tabs');
    if (nav) nav.append(h('button', { class: 'pp-tab', type: 'button', 'aria-haspopup': 'dialog', text: 'AI Assistant', onclick: (e) => { e.preventDefault(); open(); } }));
    render(); apply(); checkStatus(); refreshTasks();
    setInterval(refreshTasks, 45000);
    if (location.hash === '#hermes') open();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
