/* Kleinspan Leer: Afrikaans for kids. Vanilla JS PWA. */
(() => {
'use strict';
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? location.origin + '/api' : 'https://kleinspan-api.holowise.workers.dev';
const PLUS = { month: 'A$7.99', year: 'A$59' };          // placeholder prices, to confirm
const AVATARS = ['olifant','leeu','stokstert','skilpad','sebra','kameelperd','seekoei','padda'];
const AVATAR_BG = { olifant:'#F4C3CB', leeu:'#EBCB97', stokstert:'#EBCB97', skilpad:'#CFE0C6', sebra:'#D8E6F2', kameelperd:'#F2DDB8', seekoei:'#D8E6F2', padda:'#CFE0C6' };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = (d = new Date()) => d.toLocaleDateString('en-CA');     // YYYY-MM-DD in the device's zone
const rid = () => 'e' + Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 20);

/* ---------- icons (inline SVG, currentColor) ---------- */
const I = {
  sun:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5" fill="currentColor"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g></svg>',
  protea:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c3 2.6 3.4 7.6 0 11.5C8.6 9.6 9 4.6 12 2Zm-6.3 4.3c3.6.4 6 3.6 5.6 8.3-4-1.7-5.7-5-5.6-8.3Zm12.6 0c.1 3.3-1.6 6.6-5.6 8.3-.4-4.7 2-7.9 5.6-8.3ZM12 15.5c2.6 0 4.8 1.6 5.5 4-2 .9-3.7 1.4-5.5 1.4S8.5 20.4 6.5 19.5c.7-2.4 2.9-4 5.5-4Z"/></svg>',
  crown:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 8.5l4.2 3.4L12 5l4.8 6.9L21 8.5l-1.7 9.2H4.7L3 8.5Zm2 10.7h14v2H5v-2Z"/></svg>',
  star:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17l-5.7 3.1 1.2-6.3L2.9 9.4l6.3-.8L12 2.8Z"/></svg>',
  lock:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 10V8a5 5 0 0110 0v2h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2h1Zm2 0h6V8a3 3 0 00-6 0v2Z"/></svg>',
  play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5.5v13a1 1 0 001.5.9l10-6.5a1 1 0 000-1.7l-10-6.5A1 1 0 008 5.5Z"/></svg>',
  speaker:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h3.5L12 5v14l-4.5-4H4a1 1 0 01-1-1v-4a1 1 0 011-1Z"/><path d="M15.5 8.5a5 5 0 010 7M18 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  mute:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9h3.5L12 5v14l-4.5-4H4a1 1 0 01-1-1v-4a1 1 0 011-1Z"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  mic:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="3" width="7" height="11.5" rx="3.5" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  close:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  back:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  people:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="currentColor"/><circle cx="17" cy="9" r="2.5" fill="currentColor"/><path fill="currentColor" d="M2.5 19a6.5 6.5 0 0113 0v1h-13v-1Zm13.6 1v-1a8 8 0 00-1.7-4.9A5 5 0 0121.5 19v1h-5.4Z"/></svg>',
  cloud:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 18a4.5 4.5 0 01-.6-9 6 6 0 0111.3 1.6A3.8 3.8 0 0117.5 18H7Z"/></svg>',
};
const IMG = {};
const pic = (id, alt = '') => `<img src="${IMG[id] || ''}" alt="${esc(alt)}" draggable="false" decoding="async">`;
const ipacks = {};
function loadImgs(name) {
  if (!ipacks[name]) ipacks[name] = fetch(`imgpack/${name}.json`).then((r) => r.json()).then((j) => Object.assign(IMG, j)).catch(() => {});
  return ipacks[name];
}

/* ---------- storage ---------- */
const S = {
  get(k, d) { try { const v = localStorage.getItem('ks.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ks.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('ks.' + k); } catch {} },
};
if (new URLSearchParams(location.search).get('preview') === '1') S.set('preview', true);
const state = {
  course: null,
  session: S.get('session', null),          // {token,email,ent}
  children: S.get('children', []),
  active: S.get('active', null),            // child id or 'guest'
  sound: S.get('sound', true),
  view: 'boot',
};
const isGuest = () => state.active === 'guest';
const child = () => state.children.find((c) => c.id === state.active) || null;
const plus = () => !!(state.session && state.session.ent && state.session.ent.plus) || S.get('preview', false);
const evKey = (cid) => 'ev.' + cid, pendKey = (cid) => 'pend.' + cid;
const events = (cid = state.active) => S.get(evKey(cid), []);
function mergeEvents(cid, incoming) {
  const map = new Map(events(cid).map((e) => [e[0], e]));
  for (const e of incoming || []) if (Array.isArray(e) && e.length >= 6) map.set(e[0], e);
  const all = [...map.values()].sort((a, b) => a[5] - b[5]);
  S.set(evKey(cid), all);
  return all;
}

/* ---------- progress maths ---------- */
function stats(cid = state.active) {
  const ev = events(cid);
  const xp = ev.reduce((s, e) => s + (e[2] || 0), 0);
  const done = {}; for (const e of ev) done[e[1]] = (done[e[1]] || 0) + 1;
  const days = new Set(ev.map((e) => e[4]));
  let streak = 0; const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);           // streak still alive until tonight
  while (days.has(today(d))) { streak++; d.setDate(d.getDate() - 1); }
  return { xp, done, days, streak, todayDone: days.has(today()), lessons: Object.keys(done).length };
}
function lessonStatus(st) {
  const out = {}; let prevDone = true; let current = null;
  for (const u of state.course.units) {
    const unitOpen = u.free || plus();
    for (const l of u.lessons) {
      const n = st.done[l.id] || 0;
      let s = n ? 'done' : (prevDone && unitOpen ? 'open' : 'locked');
      if (!unitOpen && !n) s = 'plus';
      if (s === 'open' && !current) { current = l.id; s = 'current'; }
      out[l.id] = { s, n, unitOpen };
      prevDone = n > 0;
    }
  }
  return { map: out, current };
}

/* ---------- audio ---------- */
const packs = {}; const urls = {};
async function loadPack(name) {
  if (!packs[name]) packs[name] = fetch(`audio/${name}.json`).then((r) => r.json()).catch(() => ({}));
  return packs[name];
}
async function clipUrl(id) {
  if (urls[id]) return urls[id];
  const pk = state.course.audio[id]; if (!pk) return null;
  const data = await loadPack(pk); if (!data[id]) return null;
  const bin = atob(data[id]); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return (urls[id] = URL.createObjectURL(new Blob([u8], { type: 'audio/mpeg' })));
}
const player = new Audio(); player.preload = 'auto';
let speakToken = 0;
async function say(id, { force = false, rate = 1, btn = null } = {}) {
  if (!state.sound && !force) return;
  const my = ++speakToken;
  const u = await clipUrl(id);
  if (my !== speakToken) return;
  if (!u) return fallbackSpeak(id, rate);
  try {
    player.pause(); player.src = u; player.playbackRate = rate; player.preservesPitch = true;
    if (btn) { btn.classList.add('playing'); player.onended = player.onpause = () => btn.classList.remove('playing'); }
    await player.play();
  } catch { if (btn) btn.classList.remove('playing'); }
}
function fallbackSpeak(id, rate) {      // Web Speech (af-ZA) if an MP3 is ever missing
  const it = state.course.items[id] || state.course.ui[id]; if (!it || !('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(it.af); u.lang = 'af-ZA'; u.rate = 0.85 * rate; speechSynthesis.speak(u);
}
/* tiny synthesized sound effects (no files) */
let ac = null;
function sfx(kind) {
  if (!state.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [[660, 0], [990, .09]], soft: [[330, 0], [294, .12]], tap: [[880, 0]], win: [[523, 0], [659, .12], [784, .24], [1047, .36]], pop: [[740, 0]] }[kind] || [];
    const t0 = ac.currentTime + 0.01;
    for (const [f, t] of notes) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = kind === 'soft' ? 'sine' : 'triangle'; o.frequency.value = f;
      const dur = kind === 'tap' || kind === 'pop' ? 0.07 : 0.22;
      g.gain.setValueAtTime(0.0001, t0 + t); g.gain.exponentialRampToValueAtTime(kind === 'soft' ? 0.12 : 0.18, t0 + t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + dur);
      o.connect(g).connect(ac.destination); o.start(t0 + t); o.stop(t0 + t + dur + 0.02);
    }
  } catch {}
}
const vibrate = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch {} };

/* ---------- API ---------- */
async function api(method, path, body) {
  const h = { 'Content-Type': 'application/json' };
  if (state.session) h.Authorization = 'Bearer ' + state.session.token;
  let r;
  try { r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' }); }
  catch { const e = new Error('offline'); e.code = 'offline'; throw e; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/auth/login' && state.session) { localSignOut(); }
  if (!r.ok) { const e = new Error(j.error || 'error'); e.code = j.error || 'error'; e.status = r.status; e.body = j; throw e; }
  return j;
}
function saveSession(j) {
  state.session = { token: j.token || (state.session && state.session.token), email: j.account.email, ent: j.account.entitlement };
  S.set('session', state.session);
  if (j.children) { state.children = j.children; S.set('children', j.children); }
}
function localSignOut() {
  for (const c of state.children) { S.del(evKey(c.id)); S.del(pendKey(c.id)); }
  state.session = null; state.children = []; S.del('session'); S.del('children');
  if (state.active !== 'guest') { state.active = null; S.del('active'); }
}
let syncing = null;
async function sync(cid = state.active) {
  if (!state.session || !cid || cid === 'guest') return;
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const pend = new Set(S.get(pendKey(cid), []));
      const send = events(cid).filter((e) => pend.has(e[0]));
      const j = await api('POST', `/children/${encodeURIComponent(cid)}/progress`, { events: send.slice(0, 200) });
      mergeEvents(cid, j.events);
      S.set(pendKey(cid), [...pend].filter((id) => !send.slice(0, 200).some((e) => e[0] === id)));
      state.lastSync = Date.now(); state.offline = false;
    } catch (e) { if (e.code === 'offline') state.offline = true; }
    finally { syncing = null; }
  })();
  return syncing;
}
async function refreshMe() {
  if (!state.session) return;
  try { const j = await api('GET', '/me'); saveSession(j); state.offline = false; }
  catch (e) { if (e.code === 'offline') state.offline = true; }
}
addEventListener('online', () => { state.offline = false; sync(); });

/* ---------- toast ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ---------- router ---------- */
function go(view, arg) {
  state.view = view; state.arg = arg;
  const fn = VIEWS[view] || VIEWS.welcome;
  fn(arg);
  app.focus({ preventScroll: true });
}
const VIEWS = {};

/* ---------- welcome ---------- */
VIEWS.welcome = () => {
  app.innerHTML = `<main class="wrap welcome">
    <div class="hero"><img class="wordmark" src="wordmark.svg" alt="Kleinspan" width="150" height="40">
      <div class="blob">${pic('spannie_wave', 'Spannie the meerkat waving')}</div>
      <h1>Leer Afrikaans <em>saam met Spannie</em></h1>
      <p class="lead">Short, playful lessons with pictures and a real Afrikaans voice. For kids aged about 4 to 10.</p>
    </div>
    <div class="stack">
      <button class="btn ok" data-a="guest">${I.play.replace('<svg', '<svg class="icon"')} Begin! <span class="en" style="color:#fff;opacity:.85">Start as a guest</span></button>
      <button class="btn ghost" data-a="signin">Ouers: teken in · Parents: sign in</button>
      <button class="link" data-a="signup">New here? Create a free parent account</button>
    </div>
  </main>`;
  app.onclick = (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    sfx('tap');
    if (a.dataset.a === 'guest') { state.active = 'guest'; S.set('active', 'guest'); say('hi_spannie'); go('path'); }
    if (a.dataset.a === 'signin') go('auth', 'login');
    if (a.dataset.a === 'signup') go('auth', 'signup');
  };
};

/* ---------- auth ---------- */
const ERR = {
  bad_email: 'Please check the email address.', weak_password: 'Use at least 8 characters for the password.',
  consent_required: 'Please tick the box to confirm you are the parent or guardian.', email_taken: 'There is already an account with that email. Try signing in.',
  bad_login: 'That email and password don’t match.', slow_down: 'Too many tries. Please wait a minute and try again.',
  locked: 'Too many wrong passwords. Please wait 15 minutes.', offline: 'You seem to be offline. Check your connection and try again.',
};
VIEWS.auth = (mode = 'login') => {
  const signup = mode === 'signup';
  app.innerHTML = `<main class="wrap">
    <div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>${signup ? 'Create a parent account' : 'Parent sign in'}</h1></div>
    <form class="panel" novalidate>
      <p class="hint">${signup ? 'One account for the whole family: up to 3 children, progress saved across devices. Only a grown-up should fill this in.' : 'Sign in to see your children and their saved progress.'}</p>
      <div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required>
        ${signup ? '<span class="hint">At least 8 characters.</span>' : ''}</div>
      ${signup ? `<label class="check"><input id="consent" type="checkbox"><span>I’m the parent or guardian (18+). I agree to the <a href="privacy.html" target="_blank" rel="noopener">privacy notice</a>, including how my children’s progress is stored.</span></label>` : ''}
      <p class="err" id="err" role="alert"></p>
      <button class="btn ok" type="submit">${signup ? 'Create account' : 'Sign in'}</button>
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:8px">
        <button class="link" type="button" data-a="${signup ? 'login' : 'signup'}">${signup ? 'I already have an account' : 'Create an account'}</button>
        ${signup ? '' : '<button class="link" type="button" data-a="forgot">Forgot password?</button>'}
      </div>
    </form></main>`;
  app.onclick = (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'back') go(state.active ? (state.session ? 'profiles' : 'path') : 'welcome');
    if (a.dataset.a === 'login') go('auth', 'login');
    if (a.dataset.a === 'signup') go('auth', 'signup');
    if (a.dataset.a === 'forgot') $('#err').textContent = 'Password reset by email is coming soon. Until then, sign in on a device where you’re already signed in and change it under Parents → Account.';
  };
  $('form', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', app); const err = $('#err');
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Een oomblik…';
    try {
      const body = { email: $('#em').value.trim(), password: $('#pw').value };
      if (signup) body.consent = $('#consent').checked;
      const j = await api('POST', signup ? '/auth/signup' : '/auth/login', body);
      saveSession(j);
      // pull each child's saved progress so streaks and XP show straight away
      await Promise.all(state.children.map((c) => api('GET', `/children/${c.id}/progress`).then((p) => mergeEvents(c.id, p.events)).catch(() => {})));
      toast(signup ? 'Welkom! Account created.' : 'Welkom terug!');
      go(state.children.length ? 'profiles' : 'addchild', { first: true });
    } catch (x) {
      err.textContent = ERR[x.code] || 'Something went wrong. Please try again.';
      btn.disabled = false; btn.textContent = signup ? 'Create account' : 'Sign in';
    }
  };
};

/* ---------- parent gate ---------- */
VIEWS.gate = (next) => {
  const a = 3 + Math.floor(Math.random() * 6), b = 3 + Math.floor(Math.random() * 6), ans = a * b;
  const opts = shuffle([ans, ans + a, ans - b, ans + 2].filter((v, i, s) => v > 0 && s.indexOf(v) === i)).slice(0, 3);
  if (!opts.includes(ans)) opts[0] = ans;
  app.innerHTML = `<main class="wrap"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Grown-ups only</h1></div>
    <div class="panel gate"><p>To continue, please answer:</p><p class="q">${a} × ${b} = ?</p>
    <div class="numpad">${shuffle(opts).map((o) => `<button data-v="${o}">${o}</button>`).join('')}</div><p class="err" id="err" role="alert"></p></div></main>`;
  app.onclick = (e) => {
    if (e.target.closest('[data-a=back]')) return go(state.session ? 'profiles' : 'path');
    const b2 = e.target.closest('[data-v]'); if (!b2) return;
    if (+b2.dataset.v === ans) { S.set('gateAt', Date.now()); go(next.view, next.arg); }
    else { $('#err').textContent = 'Not quite. Ask a grown-up!'; setTimeout(() => go('gate', next), 900); }
  };
};
const gated = (view, arg) => (Date.now() - S.get('gateAt', 0) < 5 * 60e3 ? go(view, arg) : go('gate', { view, arg }));

/* ---------- profiles ---------- */
const face = (av) => `<span class="face" style="--bgc:${AVATAR_BG[av] || '#EEE3D0'}">${pic(av)}</span>`;
VIEWS.profiles = () => {
  if (!state.session) return go('welcome');
  const kids = state.children;
  app.innerHTML = `<main class="wrap">
    <div class="page-head"><h1>Wie leer vandag?</h1><span class="spacer"></span><button class="btn ghost small" data-a="parents">${I.people} Parents</button></div>
    <p class="en">Who’s learning today?</p>
    <div class="profiles">
      ${kids.map((c) => { const st = stats(c.id); return `<button class="prof" data-c="${esc(c.id)}">${face(c.avatar)}<span>${esc(c.name)}</span><span class="en">${st.streak ? `${st.streak}-day streak · ` : ''}${st.xp} XP</span></button>`; }).join('')}
      ${kids.length < 3 ? `<button class="prof add" data-a="add"><span class="face">${I.plus}</span><span>Voeg kind by</span><span class="en">Add a child</span></button>` : ''}
    </div></main>`;
  app.onclick = async (e) => {
    const c = e.target.closest('[data-c]');
    if (c) { sfx('tap'); state.active = c.dataset.c; S.set('active', state.active); go('path'); sync(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'add') gated('addchild');
    if (a.dataset.a === 'parents') gated('parents');
  };
};
VIEWS.addchild = (opt = {}) => {
  let av = AVATARS[state.children.length % AVATARS.length];
  const edit = opt.edit ? state.children.find((c) => c.id === opt.edit) : null;
  if (edit) av = edit.avatar;
  app.innerHTML = `<main class="wrap"><div class="page-head">${opt.first ? '' : `<button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button>`}<h1>${edit ? 'Edit profile' : 'Add a child'}</h1></div>
    <form class="panel" novalidate>
      <div class="field"><label for="nm">Child’s first name or nickname</label><input id="nm" maxlength="20" autocomplete="off" value="${edit ? esc(edit.name) : ''}" required>
      <span class="hint">Only a first name or nickname, please. We don’t need surnames, birthdays or photos.</span></div>
      <p style="font-weight:800;margin:14px 0 4px">Pick an animal</p>
      <div class="avatars" role="group" aria-label="Avatar">${AVATARS.map((a) => `<button type="button" data-av="${a}" aria-pressed="${a === av}" aria-label="${a}">${face(a)}</button>`).join('')}</div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn ok" type="submit">${edit ? 'Save' : 'Add child'}</button>
      ${opt.first ? `<p class="hint" style="margin-top:12px">You can add up to 3 children.</p>` : ''}
    </form></main>`;
  app.onclick = (e) => {
    if (e.target.closest('[data-a=back]')) return go(edit ? 'parents' : 'profiles');
    const b = e.target.closest('[data-av]'); if (!b) return;
    av = b.dataset.av; sfx('pop'); $$('[data-av]', app).forEach((x) => x.setAttribute('aria-pressed', x === b));
  };
  $('form', app).onsubmit = async (e) => {
    e.preventDefault(); const err = $('#err'); const name = $('#nm').value.trim();
    if (!name) { err.textContent = 'Please type a name.'; return; }
    const btn = $('button[type=submit]', app); btn.disabled = true;
    try {
      if (edit) { const j = await api('PATCH', `/children/${edit.id}`, { name, avatar: av }); state.children = j.children; S.set('children', j.children); return go('parents'); }
      const j = await api('POST', '/children', { name, avatar: av });
      state.children = j.children; S.set('children', j.children);
      // first child after playing as a guest: keep the guest's progress
      const g = S.get(evKey('guest'), []);
      if (g.length && state.children.length === 1) {
        mergeEvents(j.child.id, g); S.set(pendKey(j.child.id), g.map((x) => x[0])); S.del(evKey('guest'));
        state.active = j.child.id; await sync(j.child.id); toast(`Guest progress saved to ${j.child.name}`);
      }
      state.active = j.child.id; S.set('active', state.active);
      go('profiles');
    } catch (x) { err.textContent = x.code === 'max_children' ? 'You can have up to 3 children.' : (ERR[x.code] || 'Could not save. Try again.'); btn.disabled = false; }
  };
};

/* ---------- path map ---------- */
const OFF = [0, 56, 84, 56, 0, -56, -84, -56];
const DECO = ['deco_baobab', 'deco_aloe', 'deco_protea', 'deco_koppie', 'deco_baobab'];
VIEWS.path = () => {
  if (!state.active) return go('welcome');
  if (!isGuest() && !child()) return go(state.session ? 'profiles' : 'welcome');
  const st = stats(); const ls = lessonStatus(st); const c = child();
  let k = 0;
  const units = state.course.units.map((u, ui) => {
    const crowns = u.lessons.filter((l) => st.done[l.id]).length;
    const offs = u.lessons.map((_, j) => OFF[(k + j) % OFF.length]);
    const side = offs.reduce((a, b) => a + b, 0);                  // nodes lean this way, so the decoration goes on the other side
    const ext = offs.indexOf(side < 0 ? Math.min(...offs) : Math.max(...offs));
    const decoTop = 20 + ext * 126;
    const locked = !(u.free || plus());
    const nodes = u.lessons.map((l) => {
      const s = ls.map[l.id]; const x = OFF[k++ % OFF.length];
      const icon = s.s === 'done' ? I.crown : s.s === 'current' ? I.play : s.s === 'open' ? I.star : I.lock;
      const label = s.s === 'plus' ? `${l.title}, Kleinspan Plus, coming soon` : s.s === 'locked' ? `${l.title}, locked` : `${l.title}${s.n ? `, done ${s.n} time${s.n > 1 ? 's' : ''}` : ''}`;
      return `<div class="node-wrap" style="--x:${x}px">${s.s === 'current' ? `<span class="bubble">${s.n ? 'Weer!' : 'Begin!'}</span>` : ''}
        <button class="node ${s.s === 'plus' ? 'locked' : s.s}" data-l="${l.id}" aria-label="${esc(label)}">${icon}
        ${s.n ? `<span class="stars">${I.star.repeat(Math.min(3, s.n))}</span>` : ''}</button>
        <span class="node-label">${esc(l.title)}<span class="en">${esc(l.en)}</span></span></div>`;
    }).join('');
    return `<section class="unit" style="--u:${u.colour}" aria-label="Unit ${ui + 1}: ${esc(u.en)}">
      <div class="unit-head"><small>Eenheid ${ui + 1} · Unit ${ui + 1}</small><h2>${esc(u.title)}</h2><p>${esc(u.en)}</p>
        ${u.free ? '<span class="tag">Gratis · Free</span>' : `<span class="tag">${locked ? I.lock.replace('<svg', '<svg width="14" height="14"') + ' Plus · coming soon' : 'Plus'}</span>`}
        <div class="crowns">${I.crown.replace('<svg', '<svg width="18" height="18"')} ${crowns}/${u.lessons.length}</div></div>
      <div class="lessons">${pic(DECO[ui], '').replace('<img', `<img class="deco ${side < 0 ? 'r' : 'l'}" style="top:${decoTop}px"`)}${nodes}</div>
      ${locked ? `<p class="plus-note">Unit ${ui + 1} is part of <b>Kleinspan Plus</b>, coming soon.</p>` : ''}
    </section>`;
  }).join('');
  const who = isGuest() ? `<button class="avatar-btn" data-a="who" aria-label="Guest. Switch learner">${pic('spannie_wave')}</button>`
    : `<button class="avatar-btn" data-a="who" aria-label="${esc(c.name)}. Switch learner" style="background:${AVATAR_BG[c.avatar]}">${pic(c.avatar)}</button>`;
  app.innerHTML = `<header class="top"><div class="wrap row">${who}
      <span class="pill streak ${st.todayDone ? 'on' : ''}" title="Day streak">${I.sun}<span><span class="sr">Streak: </span>${st.streak}</span></span>
      <span class="pill xp" title="XP">${I.protea}<span><span class="sr">XP: </span>${st.xp}</span></span>
      <span class="spacer"></span>
      ${state.offline ? `<span class="offline">${I.cloud} offline</span>` : ''}
      <button class="icon-btn" data-a="sound" aria-pressed="${state.sound}" aria-label="Sound ${state.sound ? 'on' : 'off'}">${state.sound ? I.speaker : I.mute}</button>
    </div></header>
    <main class="wrap path">
      ${isGuest() ? `<div class="guest-bar"><div><b>Playing as a guest</b>Progress stays on this device. A free parent account saves it everywhere.</div><button class="btn small" data-a="signup">Save</button></div>` : ''}
      ${units}
      <div class="chest">${pic('deco_chest', 'Treasure chest')}<b>Meer kom binnekort!</b><span class="en">More units coming soon.</span></div>
    </main>`;
  app.onclick = (e) => {
    const n = e.target.closest('[data-l]');
    if (n) {
      const s = ls.map[n.dataset.l];
      if (s.s === 'plus') { sfx('soft'); return toast('Kleinspan Plus is coming soon!'); }
      if (s.s === 'locked') { sfx('soft'); vibrate(30); n.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 300); return toast('Finish the lesson before this one first.'); }
      sfx('tap'); return go('lesson', n.dataset.l);
    }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'sound') { state.sound = !state.sound; S.set('sound', state.sound); go('path'); if (state.sound) sfx('ok'); }
    if (a.dataset.a === 'who') { sfx('tap'); state.session ? go('profiles') : go('welcome'); }
    if (a.dataset.a === 'signup') go('auth', 'signup');
  };
  // bring the current lesson into view
  requestAnimationFrame(() => { const cur = $('.node.current', app); if (cur && cur.getBoundingClientRect().top > innerHeight * 0.7) cur.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
};

/* ---------- lesson player ---------- */
const INSTR = { tap: 'ui_tap', listen: 'ui_listen', match: 'ui_match', build: 'ui_build', sentence: 'ui_sentence', say: 'ui_say', intro: 'ui_new' };
function findLesson(id) { for (const u of state.course.units) for (const l of u.lessons) if (l.id === id) return { u, l }; return null; }
VIEWS.lesson = async (lid) => {
  const f = findLesson(lid); if (!f) return go('path');
  const { u, l } = f;
  const upto = state.course.units.slice(0, state.course.units.indexOf(u) + 1).map((x) => loadImgs(x.id));
  await Promise.all([loadPack('ui'), loadPack(u.id), ...upto]);
  const L = { queue: l.ex.map((x) => ({ ...x })), i: 0, total: l.ex.length, mistakes: 0, retried: new Set() };
  app.innerHTML = `<div class="lesson" style="--u:${u.colour}" role="dialog" aria-label="Lesson: ${esc(l.en)}">
    <div class="lesson-top"><button class="icon-btn" data-a="quit" aria-label="Close lesson">${I.close}</button>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <button class="icon-btn" data-a="sound" aria-label="Sound ${state.sound ? 'on' : 'off'}" aria-pressed="${state.sound}">${state.sound ? I.speaker : I.mute}</button></div>
    <div class="stage" id="stage"></div></div>
    <div class="sheet" id="sheet" aria-live="assertive"><div class="in"></div></div>`;
  app.onclick = (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'quit') { player.pause(); stopRec(); go('path'); }
    if (a.dataset.a === 'sound') { state.sound = !state.sound; S.set('sound', state.sound); a.innerHTML = state.sound ? I.speaker : I.mute; a.setAttribute('aria-pressed', state.sound); }
  };
  next(L, u, l);
};
function progress(L) {
  const done = Math.min(L.i, L.total); const pct = Math.round((done / L.total) * 100);
  const bar = $('.bar'); if (!bar) return; bar.setAttribute('aria-valuenow', pct); $('i', bar).style.width = pct + '%';
}
function next(L, u, l) {
  hideSheet(); progress(L);
  if (L.i >= L.queue.length) return finishLesson(L, u, l);
  const ex = L.queue[L.i]; const stage = $('#stage'); if (!stage) return;
  window.__ks.cur = ex;
  stage.innerHTML = ''; stage.scrollTop = 0;
  const done = (ok) => {
    if (ok) { L.i++; progress(L); }
    next(L, u, l);
  };
  const ctx = { L, u, l, ex, stage, done, item: state.course.items[ex.w] };
  (EX[ex.t] || EX.tap)(ctx);
}
function instr(stage, key, extra = '') {
  const ui = state.course.ui[key];
  stage.insertAdjacentHTML('beforeend', `<div class="prompt"><div><h2>${esc(ui.af)}</h2><span class="en">${esc(ui.en)}</span></div>${extra}</div>`);
}
function sheet(kind, title, sub, img, btnText, onBtn) {
  const sh = $('#sheet'); if (!sh) return;
  sh.className = 'sheet show ' + kind;
  $('.in', sh).innerHTML = `<div class="msg">${img ? pic(img) : ''}<div><b>${esc(title)}</b><span>${sub}</span></div></div>
    ${btnText ? `<button class="btn ${kind === 'good' ? 'ok' : ''}" id="sheetBtn">${esc(btnText)}</button>` : ''}`;
  const b = $('#sheetBtn'); if (b) { b.onclick = () => { sfx('tap'); onBtn(); }; setTimeout(() => b.focus({ preventScroll: true }), 50); }
}
function hideSheet() { const sh = $('#sheet'); if (sh) sh.className = 'sheet'; }
const PRAISE = ['ok_1', 'ok_2', 'ok_3', 'ok_4', 'ok_5'];
function good(ctx, extra = '') {
  sfx('ok'); vibrate(15);
  const p = PRAISE[Math.floor(Math.random() * PRAISE.length)]; const ui = state.course.ui[p];
  setTimeout(() => say(p), 250);
  const it = ctx.item;
  sheet('good', ui.af, `${esc(ui.en)}${it ? ` · <span class="school">${esc(it.af)}</span> = ${esc(it.en)}` : ''}${extra}`, 'spannie_cheer', 'Gaan voort · Continue', () => ctx.done(true));
}
function oops(ctx, reveal) {
  sfx('soft'); vibrate([20, 40, 20]); ctx.L.mistakes++;
  const key = reveal ? 'retry_2' : 'retry_1'; const ui = state.course.ui[key];
  say(key);
  if (!ctx.L.retried.has(ctx.L.i) && reveal) {            // practise it again at the end, once
    ctx.L.retried.add(ctx.L.i); ctx.L.queue.push({ ...ctx.ex }); ctx.L.total++;
  }
  sheet('soft', ui.af, esc(ui.en) + (reveal ? ' · We’ll try this one again later.' : ''), 'spannie_think', null);
  setTimeout(hideSheet, 1700);
}
function optCard(id, text) {
  const it = state.course.items[id];
  return text ? `<button class="opt text" data-o="${esc(id)}">${esc(it.af)}</button>`
    : `<button class="opt" data-o="${esc(id)}" aria-label="${esc(it.en)}">${pic(it.img, it.en)}</button>`;
}
function choose(ctx, onPick) {
  let tries = 0; let solved = false;
  ctx.stage.querySelector('.opts').onclick = (e) => {
    const b = e.target.closest('[data-o]'); if (!b || solved) return;
    const id = b.dataset.o;
    if (id === ctx.ex.w) {
      solved = true; b.classList.add('right'); b.insertAdjacentHTML('beforeend', `<span class="tick">${I.check}</span>`);
      if (onPick) onPick(id);
      setTimeout(() => { say(ctx.ex.w); good(ctx); }, 150);
    } else {
      tries++; b.classList.add('wrong');
      if (ctx.ex.t === 'tap' || ctx.ex.t === 'listen') setTimeout(() => say(id, {}), 0);
      if (tries >= 2) { const r = ctx.stage.querySelector(`[data-o="${CSS.escape(ctx.ex.w)}"]`); r && r.classList.add('hint'); setTimeout(() => say(ctx.ex.w), 900); }
      oops(ctx, tries >= 2);
    }
  };
}
const EX = {
  intro(ctx) {
    const it = ctx.item; const isPhrase = /[ .!?]/.test(it.af.trim());
    instr(ctx.stage, 'ui_new');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="intro-card"><span class="badge">${isPhrase ? 'Nuwe sin · New phrase' : 'Nuwe woord · New word'}</span>
      <div class="pic">${pic(it.img, it.en)}</div>
      <div class="word">${esc(it.af)}</div><div class="en">${esc(it.en)}</div>
      <div style="display:flex;gap:14px;align-items:center"><button class="speak" data-s="1" aria-label="Hear it again">${I.speaker}</button>
      <button class="speak slow" data-s="slow" aria-label="Hear it slowly">${pic('skilpad', 'slowly')}</button></div></div>
      <div class="footer-cta"><div class="in"><button class="btn" id="go">Gaan voort · Continue</button></div></div>`);
    say('ui_new').then(() => sleep(state.sound ? 1100 : 0)).then(() => say(ctx.ex.w));
    ctx.stage.querySelector('.intro-card').onclick = (e) => { const s = e.target.closest('[data-s]'); if (s) say(ctx.ex.w, { force: true, rate: s.dataset.s === 'slow' ? 0.7 : 1, btn: s }); };
    $('#go').onclick = () => { sfx('tap'); ctx.done(true); };
  },
  tap(ctx) {
    const it = ctx.item;
    instr(ctx.stage, 'ui_tap');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="listen-hero" style="align-items:center;margin:0 0 18px"><button class="speak" data-s aria-label="Hear the word">${I.speaker}</button><span class="word">${esc(it.af)}</span></div>
      <div class="opts ${ctx.ex.o.length === 3 ? 'three' : ''}">${ctx.ex.o.map((o) => optCard(o)).join('')}</div>`);
    say(ctx.ex.w);
    $('[data-s]', ctx.stage).onclick = (e) => say(ctx.ex.w, { force: true, btn: e.currentTarget });
    choose(ctx);
  },
  listen(ctx) {
    instr(ctx.stage, 'ui_listen');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="listen-hero"><button class="speak big" data-s="1" aria-label="Play the word">${I.speaker.replace('class="icon"', '')}</button>
      <button class="speak slow" data-s="slow" aria-label="Play slowly">${pic('skilpad', 'slowly')}</button></div>
      <div class="opts ${ctx.ex.text ? 'textual' : ctx.ex.o.length === 3 ? 'three' : ''}">${ctx.ex.o.map((o) => optCard(o, ctx.ex.text)).join('')}</div>`);
    setTimeout(() => say(ctx.ex.w, { btn: $('.speak.big', ctx.stage) }), 300);
    $('.listen-hero', ctx.stage).onclick = (e) => { const s = e.target.closest('[data-s]'); if (s) say(ctx.ex.w, { force: true, rate: s.dataset.s === 'slow' ? 0.7 : 1, btn: s }); };
    choose(ctx);
  },
  match(ctx) {
    instr(ctx.stage, 'ui_match');
    const ids = ctx.ex.p; const left = shuffle(ids), right = shuffle(ids);
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="match"><div class="col">${left.map((id) => `<button class="chip" data-m="${esc(id)}" data-side="w">${I.speaker}<span>${esc(state.course.items[id].af)}</span></button>`).join('')}</div>
      <div class="col">${right.map((id) => `<button class="chip" data-m="${esc(id)}" data-side="p" aria-label="${esc(state.course.items[id].en)}">${pic(state.course.items[id].img, state.course.items[id].en)}</button>`).join('')}</div></div>`);
    say('ui_match');
    let sel = null; let matched = 0; let bad = 0;
    $('.match', ctx.stage).onclick = (e) => {
      const b = e.target.closest('[data-m]'); if (!b || b.classList.contains('done')) return;
      if (b.dataset.side === 'w') say(b.dataset.m, { force: true }); else sfx('tap');
      if (!sel || sel.dataset.side === b.dataset.side) { if (sel) sel.classList.remove('sel'); sel = b; b.classList.add('sel'); return; }
      if (sel.dataset.m === b.dataset.m) {
        sel.classList.remove('sel'); sel.classList.add('done'); b.classList.add('done'); sfx('pop'); matched++; sel = null;
        if (matched === ids.length) { ctx.item = null; setTimeout(() => good(ctx), 350); }
      } else {
        bad++; const a = sel; a.classList.remove('sel'); a.classList.add('bad'); b.classList.add('bad'); sfx('soft'); vibrate(30);
        setTimeout(() => { a.classList.remove('bad'); b.classList.remove('bad'); }, 450); sel = null;
        if (bad === 2) ctx.L.mistakes++;
      }
    };
  },
  build(ctx) { buildLike(ctx, false); },
  sentence(ctx) { buildLike(ctx, true); },
  say(ctx) {
    const it = ctx.item;
    instr(ctx.stage, 'ui_say');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="say"><div class="pic">${pic(it.img, it.en)}</div>
      <div style="display:flex;align-items:center;gap:12px"><button class="speak" data-s aria-label="Hear it first">${I.speaker}</button><span class="word">${esc(it.af)}</span></div>
      ${SR ? `<button class="mic" id="mic" aria-label="Tap and say it">${I.mic}</button><p class="heard" id="heard">Tap the microphone, then say it.</p>`
        : `<p class="hint">Say it out loud to your grown-up!</p>`}
      <div class="footer-cta"><div class="in" style="display:grid;gap:10px">
        <button class="btn ${SR ? 'ghost' : 'ok'}" id="saidit">${SR ? 'Skip the microphone' : 'Ek het dit gesê! · I said it!'}</button></div></div></div>`);
    say('ui_say').then(() => sleep(state.sound ? 1300 : 0)).then(() => say(ctx.ex.w));
    $('[data-s]', ctx.stage).onclick = (e) => say(ctx.ex.w, { force: true, btn: e.currentTarget });
    $('#saidit').onclick = () => { stopRec(); ctx.item = it; good(ctx); };
    if (!SR) return;
    let attempts = 0;
    $('#mic').onclick = () => {
      const mic = $('#mic'); const heard = $('#heard');
      if (rec) { stopRec(); return; }
      player.pause();
      try {
        rec = new SR(); rec.lang = 'af-ZA'; rec.interimResults = false; rec.maxAlternatives = 5;
        mic.classList.add('on'); heard.textContent = 'Luister… · Listening…';
        rec.onresult = (ev) => {
          const alts = [...ev.results[0]].map((a) => a.transcript);
          const best = Math.max(...alts.map((a) => similar(a, it.af)));
          heard.textContent = `“${alts[0]}”`;
          attempts++;
          if (best >= 0.6) good(ctx, ' · Lekker gesê!');
          else if (attempts >= 2) { ctx.item = it; sheet('good', 'Lekker probeer!', 'Great try! Keep practising with your grown-up.', 'spannie_cheer', 'Gaan voort · Continue', () => ctx.done(true)); sfx('ok'); }
          else { sfx('soft'); heard.textContent += ' Probeer weer! · Try again!'; }
        };
        rec.onerror = (ev) => {
          heard.textContent = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
            ? 'The microphone isn’t available. Say it to your grown-up, then tap the button below.'
            : 'Didn’t catch that. Tap the microphone and try again.';
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'language-not-supported') { $('#saidit').textContent = 'Ek het dit gesê! · I said it!'; $('#saidit').className = 'btn ok'; mic.disabled = true; }
        };
        rec.onend = () => { mic.classList.remove('on'); rec = null; };
        rec.start();
      } catch { heard.textContent = 'Say it to your grown-up, then tap the button below.'; rec = null; }
    };
  },
};
let rec = null;
function stopRec() { try { rec && rec.abort(); } catch {} rec = null; }
function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim(); }
function similar(a, b) {
  a = norm(a); b = norm(b); if (!a || !b) return 0; if (a === b || a.includes(b)) return 1;
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function buildLike(ctx, words) {
  const it = ctx.item;
  const target = words ? it.af.split(/\s+/) : [...it.af];
  const tiles = ctx.ex.tiles.map((t, i) => ({ t, i }));
  instr(ctx.stage, words ? 'ui_sentence' : 'ui_build');
  ctx.stage.insertAdjacentHTML('beforeend', `<div class="build-pic">${pic(it.img, it.en)}<button class="speak" data-s aria-label="Hear it">${I.speaker}</button></div>
    ${words ? `<p class="en" style="text-align:center;margin:-6px 0 12px">${esc(it.en)}</p>` : ''}
    <div class="slots ${words ? 'words' : ''}" aria-label="Your answer">${target.map((_, i) => `<button class="slot" data-slot="${i}" aria-label="Empty"></button>`).join('')}</div>
    <div class="bank">${tiles.map((t) => `<button class="tile" data-t="${t.i}">${esc(t.t)}</button>`).join('')}</div>`);
  say(ctx.ex.w);
  $('[data-s]', ctx.stage).onclick = (e) => say(ctx.ex.w, { force: true, btn: e.currentTarget });
  const fill = Array(target.length).fill(null); const fixed = Array(target.length).fill(false); let tries = 0;
  const render = () => {
    $$('.slot', ctx.stage).forEach((s, i) => { s.textContent = fill[i] === null ? '' : tiles[fill[i]].t; s.className = 'slot' + (fill[i] !== null ? ' filled' : '') + (fixed[i] ? ' fixed' : ''); s.setAttribute('aria-label', fill[i] === null ? 'Empty' : tiles[fill[i]].t); });
    $$('.tile', ctx.stage).forEach((b) => b.classList.toggle('used', fill.includes(+b.dataset.t)));
  };
  const check = () => {
    const got = fill.map((f) => tiles[f].t);
    const eq = (a, b) => (words ? norm(a) === norm(b) : a.toLowerCase() === b.toLowerCase());
    if (got.every((g, i) => eq(g, target[i]))) { fixed.fill(true); render(); setTimeout(() => good(ctx), 200); return; }
    tries++;
    got.forEach((g, i) => { if (eq(g, target[i])) fixed[i] = true; else fill[i] = null; });
    $('.slots', ctx.stage).classList.add('shake'); setTimeout(() => $('.slots', ctx.stage) && $('.slots', ctx.stage).classList.remove('shake'), 450);
    if (tries >= 2) {        // gentle help: place the next correct tile
      const i = fixed.indexOf(false); if (i >= 0) { const tIdx = tiles.findIndex((t) => !fill.includes(t.i) && eq(t.t, target[i])); if (tIdx >= 0) { fill[i] = tIdx; fixed[i] = true; } }
    }
    render(); oops(ctx, false); if (tries === 2) ctx.L.mistakes++;
  };
  ctx.stage.onclick = (e) => {
    const t = e.target.closest('[data-t]'); const s = e.target.closest('[data-slot]');
    if (t) { const i = fill.indexOf(null); if (i < 0) return; fill[i] = +t.dataset.t; sfx('tap'); render(); if (!fill.includes(null)) setTimeout(check, 250); }
    else if (s) { const i = +s.dataset.slot; if (fill[i] !== null && !fixed[i]) { fill[i] = null; sfx('pop'); render(); } }
  };
}

/* ---------- finish + celebrate ---------- */
async function finishLesson(L, u, l) {
  const perfect = L.mistakes === 0; const xp = 10 + (perfect ? 5 : 0);
  const cid = state.active; const before = stats(cid);
  const ev = [rid(), l.id, xp, perfect ? 1 : 0, today(), Date.now()];
  mergeEvents(cid, [ev]);
  if (cid !== 'guest') { S.set(pendKey(cid), [...S.get(pendKey(cid), []), ev[0]]); sync(cid); }
  const after = stats(cid);
  celebrate({ xp, perfect, streak: after.streak, newDay: !before.todayDone, unitDone: u.lessons.every((x) => after.done[x.id]) && !u.lessons.every((x) => before.done[x.id]), u, l, days: after.days });
}
const DAYS = ['S', 'M', 'D', 'W', 'D', 'V', 'S'];        // Sondag..Saterdag
function celebrate(r) {
  sfx('win'); setTimeout(() => say('done_1'), 500); vibrate([30, 60, 30]);
  const week = []; const d = new Date(); d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) { const k = today(d); week.push(`<span class="day ${r.days.has(k) ? 'on' : ''} ${i === 6 ? 'today' : ''}"><i>${I.sun}</i>${DAYS[d.getDay()]}</span>`); d.setDate(d.getDate() + 1); }
  app.insertAdjacentHTML('beforeend', `<div class="celebrate" role="dialog" aria-label="Lesson complete"><canvas id="confetti"></canvas>
    ${pic(r.unitDone ? 'spannie_crown' : 'spannie_cheer', 'Spannie cheering').replace('<img', '<img class="hero-img"')}
    <h1>${r.unitDone ? 'Eenheid klaar!' : 'Jy het dit gedoen!'}</h1>
    <p class="en">${r.unitDone ? `You finished ${esc(r.u.en)}! You earned a crown.` : 'You did it!'}</p>
    <div class="stats"><div class="stat"><small>XP</small><b style="color:var(--c-brand)">${I.protea.replace('class="icon"', '')}+${r.xp}</b>${r.perfect ? '<span class="en">Geen foute! No mistakes</span>' : '<span class="en">Lekker gewerk!</span>'}</div>
      <div class="stat"><small>Streak</small><b style="color:var(--c-gold)">${I.sun.replace('class="icon"', '')}${r.streak}</b><span class="en">${r.newDay ? 'day' + (r.streak > 1 ? 's in a row!' : ' one. Come back tomorrow!') : 'days in a row'}</span></div></div>
    <div class="week" aria-label="This week">${week.join('')}</div>
    ${isGuest() ? `<div class="guest-bar" style="margin:0 0 14px;text-align:left"><div><b>Keep this progress safe</b>Create a free parent account to save it across devices.</div><button class="btn small" data-a="signup">Save</button></div>` : ''}
    <button class="btn ok" id="cont">Gaan voort · Continue</button></div>`);
  confetti($('#confetti'));
  $('#cont').onclick = () => { sfx('tap'); go('path'); };
  const sv = $('.celebrate [data-a=signup]'); if (sv) sv.onclick = () => go('auth', 'signup');
  setTimeout(() => $('#cont') && $('#cont').focus({ preventScroll: true }), 300);
}
function confetti(cv) {
  if (!cv || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = cv.getContext('2d'); const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; ctx.scale(dpr, dpr);
  const cols = ['#D9677F', '#C98A3D', '#5E7D5A', '#6F9FC8', '#B85C3C', '#F4C3CB'];
  const P = Array.from({ length: 90 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 11 - 4, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, s: 7 + Math.random() * 7, c: cols[Math.floor(Math.random() * cols.length)] }));
  const t0 = performance.now();
  (function frame(t) {
    if (!cv.isConnected) return;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of P) {
      p.vy += 0.28; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.ellipse(0, 0, p.s * 0.45, p.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // petal
    }
    if (t - t0 < 3500) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
}

/* ---------- parent area ---------- */
VIEWS.parents = () => {
  if (!state.session) return go('welcome');
  const ent = state.session.ent || {};
  const kids = state.children.map((c) => { const st = stats(c.id); return `<div class="kid-row">${face(c.avatar)}<div class="meta"><b>${esc(c.name)}</b>${st.xp} XP · ${st.streak}-day streak · ${st.lessons} of 25 lessons</div>
    <button class="btn ghost small" data-edit="${esc(c.id)}">Edit</button></div>`; }).join('') || '<p class="hint">No children yet.</p>';
  app.innerHTML = `<main class="wrap"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Parents</h1></div>
    <section class="panel"><h2>Children</h2>${kids}${state.children.length < 3 ? `<button class="btn ghost" style="margin-top:12px" data-a="add">${I.plus.replace('<svg', '<svg class="icon"')} Add a child</button>` : ''}</section>
    <section class="panel"><h2>Plan</h2>
      <p>${ent.plus ? '<b>Kleinspan Plus</b> is active.' : 'You’re on the <b>free plan</b>: Unit 1 (Hallo!) with all its lessons.'}</p>
      <div class="plan"><b>Kleinspan Plus</b><div class="price">${PLUS.month}<span class="en"> /month</span> or ${PLUS.year}<span class="en"> /year</span></div>
        <ul><li>All units: Animals, Food, Colours, Numbers</li><li>For up to 3 children</li><li>No ads, ever</li></ul>
        <button class="btn" disabled>Coming soon</button></div></section>
    <section class="panel"><h2>Account</h2><p class="hint">Signed in as <b>${esc(state.session.email)}</b></p>
      <form id="pwf" novalidate><div class="field"><label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="npw">New password</label><input id="npw" type="password" autocomplete="new-password" minlength="8"></div>
      <p class="err" id="pwerr" role="alert"></p><button class="btn ghost" type="submit">Change password</button></form>
      <div class="stack"><button class="btn ghost" data-a="signout">Sign out</button>
      <button class="link" data-a="delete">Delete account and all children’s data</button>
      <a class="link" href="privacy.html">Privacy notice</a></div></section></main>`;
  app.onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) return go('addchild', { edit: ed.dataset.edit });
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'back') go('profiles');
    if (a.dataset.a === 'add') go('addchild');
    if (a.dataset.a === 'signout') { try { await api('POST', '/auth/logout', {}); } catch {} localSignOut(); state.active = null; S.del('active'); toast('Signed out'); go('welcome'); }
    if (a.dataset.a === 'delete') go('deleteacct');
  };
  $('#pwf').onsubmit = async (e) => {
    e.preventDefault(); const err = $('#pwerr');
    try { await api('POST', '/auth/password', { current: $('#cur').value, password: $('#npw').value }); err.textContent = ''; toast('Password changed. Other devices were signed out.'); $('#cur').value = $('#npw').value = ''; }
    catch (x) { err.textContent = x.code === 'bad_login' ? 'The current password is wrong.' : (ERR[x.code] || 'Could not change it. Try again.'); }
  };
};
VIEWS.deleteacct = () => {
  app.innerHTML = `<main class="wrap"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Delete account</h1></div>
    <form class="panel" novalidate><p>This permanently deletes your parent account, all child profiles and all their progress from our server. It can’t be undone.</p>
    <div class="field"><label for="dpw">Type your password to confirm</label><input id="dpw" type="password" autocomplete="current-password"></div>
    <p class="err" id="err" role="alert"></p><button class="btn" type="submit">Delete everything</button></form></main>`;
  app.onclick = (e) => { if (e.target.closest('[data-a=back]')) go('parents'); };
  $('form', app).onsubmit = async (e) => {
    e.preventDefault();
    try { await api('DELETE', '/me', { password: $('#dpw').value }); localSignOut(); state.active = null; S.del('active'); toast('Account deleted'); go('welcome'); }
    catch (x) { $('#err').textContent = x.code === 'bad_login' ? 'That password is wrong.' : (ERR[x.code] || 'Could not delete. Try again.'); }
  };
};

/* ---------- boot ---------- */
async function boot() {
  try { [state.course] = await Promise.all([fetch('course.json').then((r) => r.json()), loadImgs('core')]); }
  catch { app.innerHTML = '<main class="wrap"><p class="panel">Could not load the lessons. Check your connection and refresh.</p></main>'; return; }
  if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (state.session) {
    await refreshMe();
    if (state.session && state.active && state.active !== 'guest') sync();
  }
  if (state.active === 'guest' || (state.active && child())) go('path');
  else if (state.session) go('profiles');
  else go('welcome');
}
window.__ks = { state, stats, sync, go };      // handy for tests
boot();
})();
