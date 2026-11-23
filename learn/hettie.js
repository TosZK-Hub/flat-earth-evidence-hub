/* Hettie, Kleinspan's AI teacher: chat and guide panel. Standalone: it reads what the app already keeps on the device
   (session, active profile, level, review schedule) and talks to the Worker's /hettie/* endpoints.
   It shows nothing unless the Worker reports Hettie is switched on. Chats stay on this device (sessionStorage). */
(() => {
  'use strict';
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const API = LOCAL ? location.origin + '/api' : 'https://kleinspan-api.holowise.workers.dev';
  const ART = 'hero-hettie.svg';                     // already cached by the app
  const S = { get(k, d) { try { const v = localStorage.getItem('ks.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } } };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = (d = new Date()) => d.toLocaleDateString('en-CA');
  const lessMotion = () => document.documentElement.dataset.motion === 'less' || matchMedia('(prefers-reduced-motion: reduce)').matches;

  const st = { open: false, busy: false, status: null, lastMistake: null, lesson: null, writing: null, returnFocus: null };
  const session = () => S.get('session', null);
  const active = () => S.get('active', null);
  const histKey = () => 'ks.hh.' + (active() || 'none');
  const hist = { get() { try { return JSON.parse(sessionStorage.getItem(histKey()) || '[]'); } catch { return []; } },
    set(v) { try { sessionStorage.setItem(histKey(), JSON.stringify(v.slice(-30))); } catch {} } };

  async function api(method, path, body) {
    const s = session(); const h = { 'Content-Type': 'application/json' };
    if (s && s.token) h.Authorization = 'Bearer ' + s.token;
    let r; try { r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' }); }
    catch { const e = new Error('offline'); e.code = 'offline'; throw e; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || 'error'); e.code = j.error || 'error'; e.status = r.status; e.body = j; throw e; }
    return j;
  }

  /* ---------- what Hettie knows about the learner: IDs and counts only, all from this device ---------- */
  function learner() {
    const cid = active(); const pf = cid ? S.get('pf.' + cid, {}) : {}; const srs = pf.srs || {}; const ev = cid ? S.get('ev.' + cid, []) : [];
    const t = today();
    const trouble = Object.entries(srs).filter(([, r]) => r[2] > 0).sort((a, b) => (b[1][3] || 0) - (a[1][3] || 0)).slice(0, 6).map(([id]) => id);
    const due = Object.values(srs).filter((r) => r[1] <= t).length;
    const days = new Set(ev.map((e) => e[4])); let streak = 0; const d = new Date();
    if (!days.has(t)) d.setDate(d.getDate() - 1);
    while (days.has(today(d))) { streak++; d.setDate(d.getDate() - 1); }
    const xp = ev.filter((e) => e[4] === t).reduce((a, e) => a + (e[2] || 0), 0);
    const lastLesson = [...ev].reverse().find((e) => /^[a-z]/.test(e[1]) && !['rv', 'fz'].includes(e[1]));
    const lastWrong = Object.entries(srs).filter(([, r]) => r[2] > 0 && r[3]).sort((a, b) => b[1][3] - a[1][3])[0];
    return { child: cid && cid !== 'guest' ? cid : undefined, level: S.get('level', 'beginner'), lesson: st.lesson || (lastLesson && lastLesson[1]) || undefined,
      trouble, today: { due, streak, goal: pf.goal || 20, xp, next: nextLesson(ev) }, lastWrong: lastWrong ? lastWrong[0] : null };
  }

  let course = null;                                // the app's course.json (already cached): only used to find the next lesson
  const loadCourse = () => course || (course = fetch('course.json').then((r) => r.json()).catch(() => null));
  let courseData = null;
  function nextLesson(ev) {
    if (!courseData) return undefined;
    const done = new Set(ev.map((e) => e[1])); const lv = S.get('level', 'beginner');
    for (const u of courseData.units.filter((x) => x.level === lv)) for (const l of u.lessons) if (!done.has(l.id)) return l.id;
    return undefined;
  }

  /* ---------- markup ---------- */
  const ICON = {
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l15-7-5 15-2.5-6L4 12Z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M2 10h4v11H2zM8 21h9.5a2 2 0 002-1.6l1.4-7A2 2 0 0019 10h-5.2l.8-4.1A1.7 1.7 0 0013 4l-5 6v11Z"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 14h-4V3h4zM16 3H6.5a2 2 0 00-2 1.6l-1.4 7A2 2 0 005 14h5.2l-.8 4.1A1.7 1.7 0 0011 20l5-6V3Z"/></svg>',
  };
  function fmt(t) {      // safe: escape everything, then allow **bold** (shown as Afrikaans) and line breaks
    return esc(t).replace(/\*\*([^*\n]{1,120})\*\*/g, '<b lang="af">$1</b>').replace(/\*([^*\n]{1,80})\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
  }
  function build() {
    if (document.getElementById('hh-fab')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <button id="hh-fab" class="hh-fab" type="button" aria-haspopup="dialog" aria-controls="hh-panel" aria-expanded="false">
        <img src="${ART}" alt="" width="44" height="44" decoding="async"><span class="hh-fab-t"><b>Vra Hettie</b><span>Ask your teacher</span></span></button>
      <button id="hh-nudge" class="hh-nudge" type="button" hidden></button>
      <div id="hh-scrim" class="hh-scrim" hidden></div>
      <section id="hh-panel" class="hh-panel" role="dialog" aria-modal="true" aria-labelledby="hh-title" aria-describedby="hh-note" hidden>
        <header class="hh-head">
          <div class="hh-ava"><img src="${ART}" alt="Hettie Hadida, the hadeda" width="52" height="52"></div>
          <div class="hh-ttl"><h2 id="hh-title">Hettie</h2><span>Jou Afrikaans-juffrou · Your Afrikaans teacher</span></div>
          <span class="hh-left" id="hh-left" aria-live="polite"></span>
          <button class="hh-x" type="button" data-hh="close" aria-label="Close Hettie">${ICON.close}</button>
        </header>
        <div class="hh-log" id="hh-log" role="log" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Conversation with Hettie"></div>
        <div class="hh-chips" id="hh-chips" role="group" aria-label="Quick starts"></div>
        <form class="hh-form" id="hh-form">
          <label class="hh-sr" for="hh-in">Message Hettie</label>
          <textarea id="hh-in" rows="1" maxlength="500" placeholder="Skryf in Afrikaans of Engels…" autocomplete="off" spellcheck="false" lang="af"></textarea>
          <button class="hh-send" type="submit" aria-label="Stuur · Send">${ICON.send}</button>
        </form>
        <p class="hh-note" id="hh-note">Hettie is an AI teacher and can make mistakes. Your chat stays on this device. <button type="button" class="hh-link" data-hh="clear">Clear chat</button></p>
      </section>`);
    const fab = $('#hh-fab'), panel = $('#hh-panel');
    fab.onclick = () => openPanel();
    fab.addEventListener('keydown', (e) => e.stopPropagation());
    $('#hh-nudge').addEventListener('keydown', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => { if (st.open && e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closePanel(); } }, true);
    document.addEventListener('focusin', (e) => { if (st.open && !panel.contains(e.target)) $('#hh-in').focus({ preventScroll: true }); });   // keep focus inside the dialog
    $('#hh-scrim').onclick = () => closePanel();
    $('#hh-nudge').onclick = () => { const a = $('#hh-nudge').dataset.act; hideNudge(); openPanel(a); };
    panel.addEventListener('click', onPanelClick);
    panel.addEventListener('keydown', onKey);
    $('#hh-form').onsubmit = (e) => { e.preventDefault(); const v = $('#hh-in').value.trim(); if (v) send('chat', v); };
    const ta = $('#hh-in');
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#hh-form').requestSubmit(); } });
    new MutationObserver(placeFab).observe(document.getElementById('app') || document.body, { childList: true, subtree: false });
    placeFab();
  }
  const $ = (s) => document.querySelector(s);
  const inLesson = () => !!document.querySelector('#app .lesson');
  function placeFab() {           // stay out of the way during lessons and on sign-in screens
    const fab = $('#hh-fab'); if (!fab) return;
    const show = st.status !== false && !inLesson() && !!active() && !st.open;
    fab.hidden = !show;
  }

  /* ---------- open / close, focus handling ---------- */
  function openPanel(action) {
    st.open = true; st.returnFocus = document.activeElement;
    $('#hh-panel').hidden = false; $('#hh-scrim').hidden = false; $('#hh-fab').setAttribute('aria-expanded', 'true'); placeFab();
    document.documentElement.classList.add('hh-lock');
    render(); chips(); refreshStatus();
    requestAnimationFrame(() => { $('#hh-panel').classList.add('in'); $('#hh-in').focus({ preventScroll: true }); });
    if (action) setTimeout(() => quick(action), 50);
  }
  function closePanel() {
    st.open = false; const p = $('#hh-panel'); p.classList.remove('in'); $('#hh-scrim').hidden = true;
    document.documentElement.classList.remove('hh-lock');
    setTimeout(() => { p.hidden = true; }, lessMotion() ? 0 : 180);
    $('#hh-fab').setAttribute('aria-expanded', 'false'); placeFab();
    const f = st.returnFocus; if (f && f !== document.body && document.contains(f) && f.offsetParent !== null) f.focus({ preventScroll: true }); else if (!$('#hh-fab').hidden) $('#hh-fab').focus();
  }
  function onKey(e) {
    e.stopPropagation();                 // keys typed to Hettie must not reach the app's lesson shortcuts (1-9, Enter)
    if (e.key === 'Escape') { e.preventDefault(); closePanel(); return; }
    if (e.key !== 'Tab') return;
    const f = [...$('#hh-panel').querySelectorAll('button:not([disabled]),textarea,[tabindex="0"]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- conversation ---------- */
  function render() {
    const log = $('#hh-log'); const h = hist.get();
    if (!session()) {
      log.innerHTML = `<div class="hh-empty"><img src="${ART}" alt="" width="120" height="120"><p><b>Hallo! Ek is Hettie.</b><br>Sign in or create a free account to chat with me. I'll explain your mistakes, plan your day and practise conversations with you at your level.</p></div>`;
      return;
    }
    if (!h.length) {
      log.innerHTML = `<div class="hh-empty"><img src="${ART}" alt="" width="120" height="120"><p><b>Goeiedag! Ek is Hettie.</b><br>Ask me anything about Afrikaans, or pick a quick start below. Ek praat Afrikaans én Engels, so don't be shy.</p></div>`;
      return;
    }
    log.innerHTML = h.map((m, i) => bubble(m, i)).join('');
    log.scrollTop = log.scrollHeight;
  }
  function bubble(m, i) {
    if (m.r === 'u') return `<div class="hh-msg hh-u"><span class="hh-sr">You said:</span><p>${esc(m.t)}</p></div>`;
    const fb = m.fb ? `<span class="hh-fbdone">${m.fb > 0 ? 'Dankie!' : 'Thanks, we’ll check it.'}</span>`
      : `<span class="hh-fb"><button type="button" data-fb="1" data-i="${i}" aria-label="Good answer">${ICON.up}</button><button type="button" data-fb="-1" data-i="${i}" aria-label="Something is wrong with this answer">${ICON.down}</button></span>`;
    return `<div class="hh-msg hh-h${m.sys ? ' hh-sys' : ''}"><img src="${ART}" alt="" width="28" height="28"><div><span class="hh-sr">Hettie said:</span><p>${fmt(m.t)}</p>${m.sys ? '' : fb}</div></div>`;
  }
  function push(m) { const h = hist.get(); h.push(m); hist.set(h); return h.length - 1; }
  function typing(on) {
    const log = $('#hh-log'); const t = $('#hh-typing');
    if (on && !t) { log.insertAdjacentHTML('beforeend', `<div class="hh-msg hh-h" id="hh-typing"><img src="${ART}" alt="" width="28" height="28"><div><p class="hh-dots" aria-hidden="true"><i></i><i></i><i></i></p><span class="hh-sr">Hettie is typing</span></div></div>`); log.scrollTop = log.scrollHeight; }
    if (!on && t) t.remove();
  }
  const LABEL = { plan: 'Plan vir vandag · Plan my day', review: 'Oefen my moeilike woorde · Practise my tricky words', explain: 'Hoekom was ek verkeerd? · Why was I wrong?', intro: 'Wat leer ek nou? · What am I learning?', chat: 'Kom ons gesels · Let’s chat', write: 'Kyk na my skryfwerk · Check my writing' };
  function chips() {
    const box = $('#hh-chips'); if (!session()) { box.innerHTML = ''; return; }
    const L = learner(); const list = ['plan'];
    if (L.trouble.length) list.push('review');
    if (st.lastMistake || L.lastWrong) list.push('explain');
    if (L.lesson) list.push('intro');
    if (st.writing) list.push('write');
    list.push('chat');
    box.innerHTML = list.map((k) => `<button type="button" class="hh-chip" data-q="${k}">${esc(LABEL[k])}</button>`).join('');
  }
  function quick(k) {
    const L = learner();
    if (k === 'chat') return send('chat', L.level === 'beginner' ? 'Hallo Hettie! Kom ons gesels. Start easy, please.' : 'Hallo Hettie! Kom ons gesels.', LABEL.chat.split(' · ')[0]);
    if (k === 'write' && st.writing) return send('chat', 'Please give me feedback on my writing: ' + st.writing.text, LABEL.write.split(' · ')[0]);
    if (k === 'explain') {
      const m = st.lastMistake && st.lastMistake.item ? st.lastMistake : { item: L.lastWrong, type: 'exercise', answer: '' };
      if (!m.item) return;
      return send('explain', '', LABEL.explain.split(' · ')[0], { mistake: m, lesson: m.lesson || L.lesson });
    }
    send(k, '', LABEL[k].split(' · ')[0]);
  }
  async function send(mode, text, shown, extra = {}) {
    if (st.busy) return; if (!session()) { render(); return; }
    st.busy = true; const ta = $('#hh-in'); const btn = $('.hh-send'); btn.disabled = true;
    const L = learner();
    const history = hist.get().filter((m) => !m.sys).slice(-8).map((m) => ({ r: m.r, t: m.t }));
    push({ r: 'u', t: shown || text }); render(); ta.value = ''; ta.style.height = '';
    typing(true);
    const body = { mode, message: mode === 'chat' ? text : '', level: L.level, lesson: mode === 'plan' ? undefined : L.lesson, trouble: L.trouble, child: L.child,
      today: mode === 'plan' ? L.today : undefined, history: mode === 'chat' ? history : [], ...extra };
    try {
      const j = await api('POST', '/hettie/chat', body);
      typing(false); push({ r: 'h', t: j.reply, mode }); render(); bob();
      if (typeof j.used === 'number') showLeft(j.used, j.limit);
    } catch (e) {
      typing(false);
      const msg = e.code === 'hettie_daily_limit' ? (e.body && e.body.plus ? `That’s all ${e.body.limit} of today’s chats, my friend. Ek is môre weer hier! (Tomorrow’s chats open at 10:00 Brisbane time.)`
          : `That’s your ${e.body ? e.body.limit : ''} free chats for today. Kleinspan Plus gives you up to 60 a day with me, plus all the Plus levels. Ek sien jou môre!`)
        : e.code === 'offline' ? 'Jy is aflyn: you’re offline. I need the internet to answer, but your lessons still work.'
        : e.code === 'slow_down' ? 'Stadig oor! Give me a few seconds to catch my breath.'
        : e.code === 'hettie_busy' ? 'Ek is bietjie oorwerk vandag: I’ve had a very busy day. Please try again later.'
        : e.code === 'signed_out' ? 'Please sign in again to chat with me.'
        : 'Eish, something went wrong on my side. Try again in a moment?';
      push({ r: 'h', t: msg, sys: true }); render();
      if (e.body && typeof e.body.used === 'number') showLeft(e.body.used, e.body.limit);
    } finally { st.busy = false; btn.disabled = false; chips(); }
  }
  function bob() { if (lessMotion()) return; const a = $('.hh-ava'); a.classList.remove('bob'); void a.offsetWidth; a.classList.add('bob'); }
  function showLeft(used, limit) { const n = Math.max(0, limit - used); $('#hh-left').textContent = `${n} left today`; $('#hh-left').setAttribute('aria-label', `${n} of ${limit} messages left today`); }
  async function refreshStatus() {
    if (!session()) return;
    try { const s = await api('GET', '/hettie/status'); if (s.enabled) showLeft(s.used, s.limit); } catch {}
  }
  function onPanelClick(e) {
    const c = e.target.closest('[data-hh]');
    if (c && c.dataset.hh === 'close') return closePanel();
    if (c && c.dataset.hh === 'clear') { hist.set([]); render(); chips(); $('#hh-in').focus(); return; }
    const q = e.target.closest('[data-q]'); if (q) return quick(q.dataset.q);
    const fb = e.target.closest('[data-fb]');
    if (fb) {
      const h = hist.get(); const m = h[+fb.dataset.i]; if (!m) return;
      const rating = +fb.dataset.fb; m.fb = rating; hist.set(h); render();
      api('POST', '/hettie/feedback', { mode: m.mode || 'chat', rating, reason: rating > 0 ? 'great' : 'wrong_afrikaans' }).catch(() => {});
    }
  }

  /* ---------- nudges: a small "Ask Hettie" pill after a mistake or a lesson, never blocking ---------- */
  let nudgeT;
  function nudge(text, act, ms = 9000) {
    if (st.status === false || !session()) return;
    const n = $('#hh-nudge'); if (!n) return;
    n.innerHTML = `<img src="${ART}" alt="" width="30" height="30"><span>${esc(text)}</span>`; n.dataset.act = act; n.hidden = false;
    n.classList.toggle('in-lesson', inLesson());
    clearTimeout(nudgeT); nudgeT = setTimeout(hideNudge, ms);
  }
  function hideNudge() { const n = $('#hh-nudge'); if (n) n.hidden = true; }

  /* the app calls these when it supports them (window.KSHettie hook); everything also works without them */
  window.KSHettie = {
    lessonStart(d) { st.lesson = d && d.lesson; st.lastMistake = null; },
    mistake(d) { st.lastMistake = d && d.item ? { item: d.item, type: d.type || 'exercise', answer: d.answer || '', lesson: d.lesson } : st.lastMistake; if (st.lastMistake) nudge('Hoekom? Vra Hettie', 'explain'); },
    writeDone(d) { if (d && d.text) { st.writing = { text: String(d.text).slice(0, 450) }; nudge('Kry terugvoer van Hettie', 'write'); } },
    lessonEnd(d) { if (d && d.mistakes > 0) setTimeout(() => nudge('Oefen jou foute met Hettie', 'review', 12000), 2500); },
    unitStart() {},
  };

  async function boot() {
    try { const h = await fetch(API + '/health', { cache: 'no-store', credentials: 'omit' }).then((r) => r.json()); st.status = !!h.hettie; }
    catch { st.status = false; }
    if (!st.status) return;
    build(); loadCourse().then((j) => { courseData = j; });
    addEventListener('storage', (e) => { if (e.key && e.key.startsWith('ks.')) placeFab(); });
    setInterval(placeFab, 1500);           // the app swaps views without events; this keeps the button's visibility in step
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
