/* Kleinspan Leer: learn Afrikaans with Hettie Hadida. Vanilla JS PWA. */
(() => {
'use strict';
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
const API = LOCAL ? location.origin + '/api' : 'https://kleinspan-api.holowise.workers.dev';
const PLUS = { month: 'A$7.99', year: 'A$59' };          // placeholder prices, to confirm
const AVATARS = ['hettie_head','olifant','leeu','stokstert','skilpad','sebra','kameelperd','seekoei','padda'];
const AVATAR_BG = { hettie_head:'#F4C3CB', bokkie_head:'#F4C3CB', olifant:'#F4C3CB', leeu:'#EBCB97', stokstert:'#EBCB97', skilpad:'#CFE0C6', sebra:'#D8E6F2', kameelperd:'#F2DDB8', seekoei:'#D8E6F2', padda:'#CFE0C6' };
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
  snow:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2M4 10.5l3-.5-1-3M20 13.5l-3 .5 1 3M4 13.5l3 .5-1 3M20 10.5l-3-.5 1-3"/></g></svg>',
  clock:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12 7v5.5l3.5 2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  redo:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12a7 7 0 11-2.05-4.95M19 4v4.5h-4.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6a8 8 0 012 1.2l2.5-.9 1.7 3-2 1.7a8 8 0 010 2.4l2 1.7-1.7 3-2.5-.9a8 8 0 01-2 1.2l-.5 2.6h-3.4l-.5-2.6a8 8 0 01-2-1.2l-2.5.9-1.7-3 2-1.7a8 8 0 010-2.4l-2-1.7 1.7-3 2.5.9a8 8 0 012-1.2L10.3 2ZM12 8.6a3.4 3.4 0 100 6.8 3.4 3.4 0 000-6.8Z"/></svg>',
  target:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  download:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>',
  people:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.2" fill="currentColor"/><circle cx="17" cy="9" r="2.5" fill="currentColor"/><path fill="currentColor" d="M2.5 19a6.5 6.5 0 0113 0v1h-13v-1Zm13.6 1v-1a8 8 0 00-1.7-4.9A5 5 0 0121.5 19v1h-5.4Z"/></svg>',
  cloud:'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 18a4.5 4.5 0 01-.6-9 6 6 0 0111.3 1.6A3.8 3.8 0 0117.5 18H7Z"/></svg>',
};
const IMG = {};
const pic = (id, alt = '') => `<img src="${IMG[id === 'bokkie_head' ? 'hettie_head' : id] || ''}" alt="${esc(alt)}" draggable="false" decoding="async">`;
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
  sound: S.get('sound', true),             // Hettie's voice plays by itself
  fx: S.get('fx', true),                    // little sound effects
  speak: S.get('speak', true),              // speaking exercises
  theme: S.get('theme', 'auto'),            // auto | light | dark
  motion: S.get('motion', 'auto'),          // auto | less
  level: S.get('level', 'beginner'),
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
const isLesson = (id) => /^[uia][1-9]l[1-9]$/.test(id);
const FREEZE_EVERY = 7;                       // one streak freeze for every 7 lessons finished, hold up to 2
function stats(cid = state.active) {
  const ev = events(cid); const t = today();
  let xp = 0, xpToday = 0, hold = 0, n = 0;
  const done = {}; const days = new Set(); const frozen = new Set(); let todayDone = false;
  for (const e of ev) {
    xp += e[2] || 0; days.add(e[4]);
    if (e[4] === t) { xpToday += e[2] || 0; if (e[1] !== 'fz') todayDone = true; }
    if (isLesson(e[1])) { done[e[1]] = (done[e[1]] || 0) + 1; if (e[3] !== 2) { n++; if (n % FREEZE_EVERY === 0) hold = Math.min(2, hold + 1); } }
    else if (e[1] === 'fz') { frozen.add(e[4]); hold = Math.max(0, hold - 1); }
  }
  let streak = 0; const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);           // streak still alive until tonight
  while (days.has(today(d))) { if (!frozen.has(today(d))) streak++; d.setDate(d.getDate() - 1); }
  return { xp, xpToday, done, days, frozen, streak, todayDone, hold, nextFreeze: FREEZE_EVERY - (n % FREEZE_EVERY), lessons: Object.keys(done).length };
}
/* streak freeze: if yesterday (or the day before too) was missed and a freeze is held, use it */
function applyFreezes(cid = state.active) {
  if (!cid) return null;
  const st = stats(cid); if (st.todayDone || !st.hold) return null;
  const d = new Date(); d.setDate(d.getDate() - 1); const missing = [];
  while (!st.days.has(today(d)) && missing.length <= 2) { missing.push(today(d)); d.setDate(d.getDate() - 1); }
  if (!missing.length || missing.length > st.hold || !st.days.has(today(d))) return null;
  const evs = missing.map((day, i) => [rid(), 'fz', 0, 0, day, Date.now() + i]);
  mergeEvents(cid, evs);
  if (cid !== 'guest') { S.set(pendKey(cid), [...S.get(pendKey(cid), []), ...evs.map((e) => e[0])]); sync(cid); }
  return { used: missing.length, streak: stats(cid).streak };
}

/* ---------- per-profile preferences + spaced repetition (synced as one small blob) ---------- */
const GOALS = [{ xp: 10, af: 'Rustig', en: 'Casual', min: '1 lesson' }, { xp: 20, af: 'Gereeld', en: 'Regular', min: '2 lessons' }, { xp: 30, af: 'Ernstig', en: 'Serious', min: '3 lessons' }, { xp: 50, af: 'Intens', en: 'Intense', min: '4–5 lessons' }];
const pfKey = (cid) => 'pf.' + cid;
const getPf = (cid = state.active) => S.get(pfKey(cid), {});
function setPf(patch, cid = state.active, local = false) {
  const pf = { ...getPf(cid), ...patch }; if (!local) pf.u = Date.now();
  S.set(pfKey(cid), pf); if (!local) pushPf(cid);
  return pf;
}
const goalXp = (cid = state.active) => getPf(cid).goal || 20;
const BOX = [0, 1, 2, 4, 7, 15, 30];          // review interval in days for each box
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return today(d); };
function srs(cid = state.active) {
  const pf = getPf(cid);
  if (pf.srs) return pf.srs;
  const out = {}; const st = stats(cid);                          // first run: everything already learnt is due
  for (const u of state.course.units) for (const l of u.lessons) if (st.done[l.id]) for (const x of l.ex) if (x.t === 'intro') out[x.w] = [1, today(), 0, 0, 0];
  setPf({ srs: out }, cid, true);
  return out;
}
/* record [box, due day, wrong count, last wrong ts, updated ts] */
function srsMark(ids, ok, L) {
  if (!state.active || !state.course) return;
  const s = { ...srs() }; const now = Date.now();
  for (const id of ids) {
    if (!state.course.items[id]) continue;
    const r = (s[id] || [0, today(), 0, 0, 0]).slice();
    if (ok === 'seen') { if (!s[id]) s[id] = [1, addDays(1), 0, 0, now]; continue; }
    if (!ok) { r[0] = 0; r[1] = today(); r[2]++; r[3] = now; if (L) L.wrongIds.add(id); }
    else if (L && L.wrongIds.has(id)) { /* right after a slip: keep it in today's review */ }
    else if (!L || !L.bumped.has(id)) { r[0] = Math.min(6, r[0] + 1); r[1] = addDays(BOX[r[0]]); if (L) L.bumped.add(id); }
    r[4] = now; s[id] = r;
  }
  setPf({ srs: s }, state.active, true);
}
function srsDue(cid = state.active) {
  const s = srs(cid); const t = today();
  const due = Object.entries(s).filter(([id, r]) => r[1] <= t && state.course.items[id]);
  const mistakes = due.filter(([, r]) => r[0] === 0 && r[2] > 0);
  return { due: due.map(([id]) => id), mistakes: mistakes.map(([id]) => id), learnt: Object.keys(s).filter((id) => state.course.items[id]).length };
}
let pfTimer = null;
function pushPf(cid = state.active) {
  if (!state.session || !cid || cid === 'guest') return;
  clearTimeout(pfTimer);
  pfTimer = setTimeout(() => api('PUT', `/children/${encodeURIComponent(cid)}/state`, { data: getPf(cid) }).catch(() => {}), 800);
}
function mergePf(cid, remote) {
  if (!remote || typeof remote !== 'object') return;
  const mine = getPf(cid);
  const base = (remote.u || 0) > (mine.u || 0) ? { ...mine, ...remote } : { ...remote, ...mine };
  const a = mine.srs || {}, b = remote.srs || {}; const srsM = { ...a };
  for (const [id, r] of Object.entries(b)) if (!a[id] || (r[4] || 0) > (a[id][4] || 0)) srsM[id] = r;
  base.srs = srsM; base.u = Math.max(mine.u || 0, remote.u || 0);
  S.set(pfKey(cid), base);
}
async function pullPf(cid) {
  if (!state.session || !cid || cid === 'guest') return;
  try { const j = await api('GET', `/children/${encodeURIComponent(cid)}/state`); mergePf(cid, j.data); } catch {}
}

/* ---------- theme + motion ---------- */
const mqDark = matchMedia('(prefers-color-scheme: dark)'); const mqMotion = matchMedia('(prefers-reduced-motion: reduce)');
function applyTheme() {
  const dark = state.theme === 'dark' || (state.theme === 'auto' && mqDark.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.motion = state.motion === 'less' || mqMotion.matches ? 'less' : 'full';
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#1C1916' : '#F6EFE3';
}
const lessMotion = () => document.documentElement.dataset.motion === 'less';
mqDark.addEventListener && mqDark.addEventListener('change', applyTheme);
mqMotion.addEventListener && mqMotion.addEventListener('change', applyTheme);
applyTheme();
const announce = (msg) => { const r = $('#sr-live'); if (r) { r.textContent = ''; setTimeout(() => { r.textContent = msg; }, 30); } };

function lessonStatus(st) {
  const out = {}; let prevDone = true; let current = null;
  let lvl = null; let lvCur = null;
  for (const u of state.course.units) {
    if (u.level !== lvl) { lvl = u.level; prevDone = true; lvCur = null; }
    const unitOpen = u.free || plus();
    for (const l of u.lessons) {
      const n = st.done[l.id] || 0;
      let s = n ? 'done' : (prevDone && unitOpen ? 'open' : 'locked');
      if (!unitOpen && !n) s = 'plus';
      if (s === 'open' && !lvCur) { lvCur = l.id; if (!current) current = l.id; s = 'current'; }
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
  if (!state.fx) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { ok: [[660, 0], [990, .09]], soft: [[330, 0], [294, .12]], tap: [[880, 0]], win: [[523, 0], [659, .12], [784, .24], [1047, .36]], pop: [[740, 0]], combo: [[784, 0], [988, .07], [1319, .14]], goal: [[523, 0], [784, .1], [1047, .2], [1319, .3], [1568, .42]], freeze: [[1175, 0], [880, .1], [1175, .2]] }[kind] || [];
    const t0 = ac.currentTime + 0.01;
    for (const [f, t] of notes) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = kind === 'soft' ? 'sine' : 'triangle'; o.frequency.value = f;
      const dur = kind === 'tap' || kind === 'pop' ? 0.07 : kind === 'combo' ? 0.12 : 0.22;
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
      <div class="blob">${pic('hettie_wave', 'Hettie Hadida waving hello')}</div>
      <h1>Leer Afrikaans <em>met Hettie</em></h1>
      <p class="lead">Five-minute lessons with a real Afrikaans voice, from your first <i>hallo</i> to everyday conversation and the slang people actually use. Hettie Hadida will remind you to practise. Loudly.</p>
      <ul class="levels-mini" aria-label="Levels"><li><b>Beginner</b> free</li><li><b>Intermediêr</b> Plus</li><li><b>Gevorderd</b> soon</li></ul>
    </div>
    <div class="stack">
      <button class="btn ok" data-a="guest">${I.play.replace('<svg', '<svg class="icon"')} Begin <span class="en" style="color:#fff;opacity:.85">Try it now, no account</span></button>
      <button class="btn ghost" data-a="signin">Teken in · Sign in</button>
      <button class="link" data-a="signup">New here? Create a free account</button>
    </div>
  </main>`;
  app.onclick = (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    sfx('tap');
    if (a.dataset.a === 'guest') { state.active = 'guest'; S.set('active', 'guest'); if (needsOnboarding('guest')) return go('onboard', 0); say('hi_hettie'); go('path'); }
    if (a.dataset.a === 'signin') go('auth', 'login');
    if (a.dataset.a === 'signup') go('auth', 'signup');
  };
};

/* ---------- auth ---------- */
const ERR = {
  bad_email: 'Please check the email address.', weak_password: 'Use at least 8 characters for the password.',
  consent_required: 'Please tick the box to agree to the privacy notice.', bad_name: 'Please type a name (up to 20 characters).', email_taken: 'There is already an account with that email. Try signing in.',
  bad_login: 'That email and password don’t match.', slow_down: 'Too many tries. Please wait a minute and try again.',
  locked: 'Too many wrong passwords. Please wait 15 minutes.', offline: 'You seem to be offline. Check your connection and try again.',
};
VIEWS.auth = (mode = 'login') => {
  const signup = mode === 'signup';
  app.innerHTML = `<main class="wrap">
    <div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>${signup ? 'Create your account' : 'Sign in'}</h1></div>
    <form class="panel" novalidate>
      <p class="hint">${signup ? 'Free. Your progress, XP and streak are saved and synced across your devices.' : 'Welcome back. Sign in to pick up where you left off.'}</p>
      ${signup ? '<div class="field"><label for="nm">Your name</label><input id="nm" maxlength="20" autocomplete="given-name" required><span class="hint">A first name or nickname is enough.</span></div>' : ''}
      <div class="field"><label for="em">Email</label><input id="em" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="pw">Password</label><input id="pw" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required>
        ${signup ? '<span class="hint">At least 8 characters.</span>' : ''}</div>
      ${signup ? `<label class="check"><input id="consent" type="checkbox"><span>I’m 16 or older and I agree to the <a href="privacy.html" target="_blank" rel="noopener">privacy notice</a>.</span></label>` : ''}
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
    if (a.dataset.a === 'forgot') $('#err').textContent = 'Password reset by email is coming soon. Until then, sign in on a device where you’re already signed in and change it under Account.';
  };
  $('form', app).onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', app); const err = $('#err');
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Een oomblik…';
    try {
      const body = { email: $('#em').value.trim(), password: $('#pw').value };
      if (signup) { body.consent = $('#consent').checked; if (!$('#nm').value.trim()) throw Object.assign(new Error('bad_name'), { code: 'bad_name' }); }
      const j = await api('POST', signup ? '/auth/signup' : '/auth/login', body);
      saveSession(j);
      // pull each child's saved progress so streaks and XP show straight away
      await Promise.all(state.children.map((c) => api('GET', `/children/${c.id}/progress`).then((p) => mergeEvents(c.id, p.events)).catch(() => {})));
      if (signup) await createProfile($('#nm').value.trim(), 'hettie_head');
      toast(signup ? 'Welkom! Your account is ready.' : 'Welkom terug!');
      await Promise.all(state.children.map((c) => pullPf(c.id)));
      if (state.children.length === 1) { state.active = state.children[0].id; S.set('active', state.active); sync(); go(needsOnboarding() ? 'onboard' : 'path', 0); }
      else go(state.children.length ? 'profiles' : 'addchild', { first: true });
    } catch (x) {
      err.textContent = ERR[x.code] || 'Something went wrong. Please try again.';
      btn.disabled = false; btn.textContent = signup ? 'Create account' : 'Sign in';
    }
  };
};

const gated = (view, arg) => go(view, arg);      // no gate: accounts are for adult learners

/* ---------- profiles ---------- */
const face = (av) => `<span class="face" style="--bgc:${AVATAR_BG[av] || '#EEE3D0'}">${pic(av)}</span>`;
VIEWS.profiles = () => {
  if (!state.session) return go('welcome');
  const kids = state.children;
  app.innerHTML = `<main class="wrap">
    <div class="page-head"><h1>Wie leer vandag?</h1><span class="spacer"></span><button class="btn ghost small" data-a="parents">${I.people} Account</button></div>
    <p class="en">Who’s learning today?</p>
    <div class="profiles">
      ${kids.map((c) => { const st = stats(c.id); return `<button class="prof" data-c="${esc(c.id)}">${face(c.avatar)}<span>${esc(c.name)}</span><span class="en">${st.streak ? `${st.streak}-day streak · ` : ''}${st.xp} XP</span></button>`; }).join('')}
      ${kids.length < 3 ? `<button class="prof add" data-a="add"><span class="face">${I.plus}</span><span>Nuwe profiel</span><span class="en">Add a profile</span></button>` : ''}
    </div></main>`;
  app.onclick = async (e) => {
    const c = e.target.closest('[data-c]');
    if (c) { sfx('tap'); state.active = c.dataset.c; S.set('active', state.active); await Promise.all([sync(), pullPf(state.active)]); go(needsOnboarding() ? 'onboard' : 'path', 0); freezeCheck(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'add') gated('addchild');
    if (a.dataset.a === 'parents') gated('parents');
  };
};
async function createProfile(name, av) {
  const j = await api('POST', '/children', { name, avatar: av });
  state.children = j.children; S.set('children', j.children);
  // first profile after playing as a guest: keep the guest's progress
  const g = S.get(evKey('guest'), []);
  if (g.length && state.children.length === 1) {
    mergeEvents(j.child.id, g); S.set(pendKey(j.child.id), g.map((x) => x[0])); S.del(evKey('guest'));
    state.active = j.child.id; await sync(j.child.id); toast('Your guest progress is saved');
  }
  const gp = S.get(pfKey('guest'), null);
  if (gp && state.children.length === 1) { S.set(pfKey(j.child.id), { ...gp, u: Date.now() }); S.del(pfKey('guest')); state.active = j.child.id; pushPf(j.child.id); }
  state.active = j.child.id; S.set('active', state.active);
  return j.child;
}
VIEWS.addchild = (opt = {}) => {
  let av = AVATARS[state.children.length % AVATARS.length];
  const edit = opt.edit ? state.children.find((c) => c.id === opt.edit) : null;
  if (edit) av = edit.avatar;
  app.innerHTML = `<main class="wrap"><div class="page-head">${opt.first ? '' : `<button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button>`}<h1>${edit ? 'Edit profile' : 'Add a profile'}</h1></div>
    <form class="panel" novalidate>
      <div class="field"><label for="nm">Name or nickname</label><input id="nm" maxlength="20" autocomplete="off" value="${edit ? esc(edit.name) : ''}" required>
      <span class="hint">Each profile keeps its own progress, handy if you share the account with a partner or family.</span></div>
      <p style="font-weight:800;margin:14px 0 4px">Pick an avatar</p>
      <div class="avatars" role="group" aria-label="Avatar">${AVATARS.map((a) => `<button type="button" data-av="${a}" aria-pressed="${a === av}" aria-label="${a}">${face(a)}</button>`).join('')}</div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn ok" type="submit">${edit ? 'Save' : 'Add profile'}</button>
      ${opt.first ? `<p class="hint" style="margin-top:12px">You can have up to 3 profiles in one account.</p>` : ''}
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
      await createProfile(name, av);
      go(state.children.length > 1 ? 'profiles' : needsOnboarding() ? 'onboard' : 'path', 0);
    } catch (x) { err.textContent = x.code === 'max_children' ? 'You can have up to 3 profiles.' : (ERR[x.code] || 'Could not save. Try again.'); btn.disabled = false; }
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
  const levels = state.course.levels;
  if (!levels.some((x) => x.id === state.level)) state.level = 'beginner';
  const lv = levels.find((x) => x.id === state.level);
  const lvUnits = state.course.units.filter((u) => u.level === lv.id);
  const tabs = `<div class="levels" role="tablist" aria-label="Level">${levels.map((x) => {
    const n = state.course.units.filter((u) => u.level === x.id).flatMap((u) => u.lessons); const d = n.filter((l) => st.done[l.id]).length;
    return `<button role="tab" class="lvl ${x.id === lv.id ? 'on' : ''}" aria-selected="${x.id === lv.id}" data-lv="${x.id}"><b>${esc(x.af)}</b><span>${x.soon ? 'Coming soon' : x.free ? `Free · ${d}/${n.length}` : plus() ? `Plus · ${d}/${n.length}` : 'Plus'}</span></button>`; }).join('')}</div>`;
  const units = lvUnits.map((u) => { const ui = state.course.units.indexOf(u); const un = lvUnits.indexOf(u) + 1;
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
        <button class="node ${s.s === 'plus' ? 'locked' : s.s}" data-l="${l.id}" aria-label="${esc(label)}" ${['plus', 'locked'].includes(s.s) ? '' : 'aria-haspopup="dialog" aria-expanded="false"'}>${icon}
        ${s.n ? `<span class="stars">${I.star.repeat(Math.min(3, s.n))}</span>` : ''}</button>
        <span class="node-label">${esc(l.title)}<span class="en">${esc(l.en)}</span></span></div>`;
    }).join('');
    return `<section class="unit" style="--u:${u.colour}" aria-label="Unit ${un}: ${esc(u.en)}">
      <div class="unit-head"><small>${esc(lv.af)} · Eenheid ${un}</small><h2>${esc(u.title)}</h2><p>${esc(u.en)}</p>
        ${u.free ? '<span class="tag">Gratis · Free</span>' : `<span class="tag">${locked ? I.lock.replace('<svg', '<svg width="14" height="14"') + ' Plus · coming soon' : 'Plus'}</span>`}
        <div class="crowns">${I.crown.replace('<svg', '<svg width="18" height="18"')} ${crowns}/${u.lessons.length}</div></div>
      <div class="lessons">${pic(DECO[ui], '').replace('<img', `<img class="deco ${side < 0 ? 'r' : 'l'}" style="top:${decoTop}px"`)}${nodes}</div>
      ${locked ? `<p class="plus-note">${esc(lv.en)} is part of <b>Kleinspan Plus</b>, coming soon.</p>` : ''}
    </section>`;
  }).join('');
  const who = isGuest() ? `<button class="avatar-btn" data-a="who" aria-label="Guest. Sign in or create an account" style="background:#F4C3CB">${pic('hettie_head')}</button>`
    : `<button class="avatar-btn" data-a="who" aria-label="${esc(c.name)}. Account and profiles" style="background:${AVATAR_BG[c.avatar]}">${pic(c.avatar)}</button>`;
  const goal = goalXp(); const gp = Math.min(1, st.xpToday / goal); const due = srsDue();
  const ring = `<svg class="ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" class="trk"/><circle cx="12" cy="12" r="9.5" class="val" style="stroke-dasharray:${(gp * 59.7).toFixed(1)} 60;${gp ? "" : "stroke-opacity:0"}"/></svg>`;
  const week = []; { const d = new Date(); d.setDate(d.getDate() - 6); for (let i = 0; i < 7; i++) { const k = today(d); week.push(`<span class="day ${st.days.has(k) ? 'on' : ''} ${st.frozen.has(k) ? 'frozen' : ''} ${i === 6 ? 'today' : ''}"><i>${st.frozen.has(k) ? I.snow : I.sun}</i>${DAYS[d.getDay()]}</span>`); d.setDate(d.getDate() + 1); } }
  const rail = `<aside class="rail" aria-label="Today">
      <section class="card goal ${gp >= 1 ? 'met' : ''}"><div class="card-h">${I.target}<div><b>${gp >= 1 ? 'Doel bereik!' : 'Daaglikse doel'}</b><span class="en">${gp >= 1 ? 'Daily goal reached' : 'Daily goal'}</span></div><button class="link small" data-a="goal">${goal} XP</button></div>
        <div class="goal-bar" role="progressbar" aria-label="Daily goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(st.xpToday, goal)}"><i style="--from:0%;--to:${Math.round(gp * 100)}%"></i><span>${Math.min(st.xpToday, goal)} / ${goal} XP</span></div></section>
      <section class="card review ${due.due.length ? 'due' : ''}">${pic(due.mistakes.length ? 'hettie_think' : 'hettie_head', '')}<div><b>${due.mistakes.length ? `${due.mistakes.length} fout${due.mistakes.length > 1 ? 'e' : ''} om te hersien` : due.due.length ? `${due.due.length} woord${due.due.length > 1 ? 'e' : ''} om te hersien` : 'Hersien'}</b>
        <span class="en">${due.mistakes.length ? `Practise the ${due.mistakes.length > 1 ? `${due.mistakes.length} you slipped on` : 'one you slipped on'}` : due.due.length ? 'Due today, before you forget them' : due.learnt ? 'All caught up. Practise anyway?' : 'Unlocks after your first lesson'}</span></div>
        <button class="btn small ${due.due.length ? '' : 'ghost'}" data-a="review" ${due.learnt ? '' : 'disabled'}>${due.due.length ? 'Oefen' : 'Oefen'}</button></section>
      <section class="card streak-card"><div class="card-h">${I.sun}<div><b>${st.streak} ${st.streak === 1 ? 'dag' : 'dae'} op 'n ry</b><span class="en">${st.todayDone ? 'Today’s done. See you tomorrow!' : st.streak ? 'Do a lesson today to keep it going' : 'Start a streak today'}</span></div></div>
        <div class="week" aria-label="This week">${week.join('')}</div>
        <p class="freezes">${I.snow}<span>${st.hold ? `<b>${st.hold} streak freeze${st.hold > 1 ? 's' : ''}</b> ready. Used automatically if you miss a day.` : `Next streak freeze in <b>${st.nextFreeze} lesson${st.nextFreeze > 1 ? 's' : ''}</b>.`}</span></p></section>
      ${!plus() ? `<section class="card plus-card"><b>Kleinspan Plus</b><span class="en">Intermediate conversations, verbs, idioms and slang. Coming soon.</span><button class="btn small ghost" data-a="plusinfo">Learn more</button></section>` : ''}
    </aside>`;
  app.innerHTML = `<header class="top"><div class="wrap row">${who}
      <span class="pill streak ${st.todayDone ? 'on' : ''}" title="Day streak">${I.sun}<span><span class="sr">Streak: </span>${st.streak}</span>${st.hold ? `<span class="fz" title="${st.hold} streak freeze${st.hold > 1 ? 's' : ''}">${I.snow}<span class="sr">${st.hold} streak freezes</span></span>` : ''}</span>
      <span class="pill xp" title="XP">${I.protea}<span><span class="sr">XP: </span>${st.xp}</span></span>
      <button class="pill goalpill ${gp >= 1 ? 'met' : ''}" data-a="goal" aria-label="Daily goal: ${Math.min(st.xpToday, goal)} of ${goal} XP">${ring}<span class="gpt">${Math.round(gp * 100)}%</span></button>
      <span class="spacer"></span>
      ${state.offline ? `<span class="offline">${I.cloud} offline</span>` : ''}
      <button class="icon-btn" data-a="sound" aria-pressed="${state.sound}" aria-label="Sound ${state.sound ? 'on' : 'off'}">${state.sound ? I.speaker : I.mute}</button>
      <button class="icon-btn" data-a="settings" aria-label="Settings">${I.gear}</button>
    </div></header>
    <div class="path-layout">
    <main class="wrap path">
      ${isGuest() ? `<div class="guest-bar"><div><b>Learning as a guest</b>Progress stays on this device. A free account saves it everywhere.</div><button class="btn small" data-a="signup">Save</button></div>` : ''}
      ${rail.replace('<aside class="rail"', '<aside class="rail mini"')}
      ${tabs}
      ${lv.soon ? `<section class="soon panel">${pic('hettie_sleep', 'Hettie asleep')}<h2>Gevorderd kom binnekort</h2><p>Advanced is on its way: longer conversations, reading real texts, and the trickier grammar. It will be part of Kleinspan Plus.</p></section>`
        : `<p class="lvl-blurb">${esc(lv.blurb)}</p>${units}
      <div class="chest">${pic('deco_chest', 'Treasure chest')}<b>Meer kom binnekort!</b><span class="en">More units coming soon.</span></div>`}
    </main>${rail.replace('<aside class="rail"', '<aside class="rail side"')}</div>`;
  app.onclick = (e) => {
    const n = e.target.closest('[data-l]');
    if (n) {
      const s = ls.map[n.dataset.l];
      if (s.s === 'plus') { sfx('tap'); return go('plus'); }
      if (s.s === 'locked') { sfx('soft'); vibrate(30); n.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], 300); return toast('Finish the lesson before this one first.'); }
      const open = $('.node-pop', app); const same = open && open.dataset.for === n.dataset.l; if (open) open.remove();
      $$('.node[aria-expanded=true]', app).forEach((x) => x.setAttribute('aria-expanded', 'false'));
      if (same) return;
      sfx('tap');
      const f = findLesson(n.dataset.l); const idx = f.u.lessons.indexOf(f.l) + 1;
      n.setAttribute('aria-expanded', 'true');
      n.closest('.node-wrap').insertAdjacentHTML('beforeend', `<div class="node-pop" data-for="${esc(n.dataset.l)}" role="dialog" aria-label="${esc(f.l.title)}">
        <b>${esc(f.l.title)}</b><span class="en">${esc(f.l.en)} · Les ${idx} van ${f.u.lessons.length}</span>
        <button class="btn small" data-start="${esc(n.dataset.l)}">${s.n ? 'Oefen weer' : 'Begin'} <span class="xpb">+${s.n ? 10 : 10} XP</span></button></div>`);
      const pop = $('.node-pop', app); setTimeout(() => $('.btn', pop).focus({ preventScroll: true }), 30);
      if (pop.getBoundingClientRect().bottom > innerHeight - 20) pop.scrollIntoView({ block: 'nearest', behavior: lessMotion() ? 'auto' : 'smooth' });
      return;
    }
    const st0 = e.target.closest('[data-start]'); if (st0) { sfx('tap'); return go('lesson', st0.dataset.start); }
    if (!e.target.closest('.node-pop')) { const op = $('.node-pop', app); if (op) { op.remove(); $$('.node[aria-expanded=true]', app).forEach((x) => x.setAttribute('aria-expanded', 'false')); } }
    const lvb = e.target.closest('[data-lv]');
    if (lvb) { sfx('tap'); state.level = lvb.dataset.lv; S.set('level', state.level); return go('path'); }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'sound') { const on = !(state.sound || state.fx); state.sound = state.fx = on; S.set('sound', on); S.set('fx', on); go('path'); if (on) sfx('ok'); }
    if (a.dataset.a === 'settings' || a.dataset.a === 'goal') { sfx('tap'); go('settings', a.dataset.a === 'goal' ? 'goal' : null); }
    if (a.dataset.a === 'review') { sfx('tap'); startReview(); }
    if (a.dataset.a === 'plusinfo') { sfx('tap'); state.session ? go('parents') : go('plus'); }
    if (a.dataset.a === 'who') { sfx('tap'); state.session ? go(state.children.length > 1 ? 'profiles' : 'parents') : go('welcome'); }
    if (a.dataset.a === 'signup') go('auth', 'signup');
  };
  // bring the current lesson into view
  requestAnimationFrame(() => { const cur = $('.node.current', app); if (cur && cur.getBoundingClientRect().top > innerHeight * 0.7) cur.scrollIntoView({ block: 'center', behavior: 'smooth' }); });
};

/* ---------- keyboard: 1-9 pick an answer, Enter continues ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const op = $('.node-pop'); if (op) { const n = $(`.node[data-l="${op.dataset.for}"]`); op.remove(); if (n) { n.setAttribute('aria-expanded', 'false'); n.focus(); } return; } const m = $('#fzm'); if (m) { m.remove(); return; } }
  if (state.view !== 'lesson' || e.altKey || e.ctrlKey || e.metaKey) return;
  const inText = /^(TEXTAREA|INPUT)$/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === 'Enter') {
    const b = $('#sheetBtn') || $('.celebrate #cont');
    if (b && $('#sheet.show, .celebrate')) { e.preventDefault(); b.click(); return; }
    if (inText && !e.shiftKey) { const f = document.activeElement.form; if (f) { e.preventDefault(); f.requestSubmit(); } return; }
    if (!inText && (document.activeElement === document.body || document.activeElement === app || document.activeElement.tagName === 'BUTTON' && !document.activeElement.closest('#stage .opts, #stage .bank, #stage .match'))) { const g = $('#go'); if (g) { e.preventDefault(); g.click(); } }
    return;
  }
  if (inText || !/^[1-9]$/.test(e.key)) return;
  const opts = $$('#stage .opts [data-o], #stage .opts [data-g], #stage .bank .tile:not(.used), #stage .match .chip:not(.done)');
  const b = opts[+e.key - 1]; if (b) { e.preventDefault(); b.click(); b.focus({ preventScroll: true }); }
});

/* ---------- lesson player ---------- */
const INSTR = { tap: 'ui_tap', listen: 'ui_listen', match: 'ui_match', build: 'ui_build', sentence: 'ui_sentence', say: 'ui_say', intro: 'ui_new', translate: 'ui_translate', gap: 'ui_gap', dictate: 'ui_dictate' };
function findLesson(id) {
  if (id === 'rv' && state.review) return state.review;
  for (const u of state.course.units) for (const l of u.lessons) if (l.id === id) return { u, l }; return null;
}
VIEWS.lesson = async (lid) => {
  const f = findLesson(lid); if (!f) return go('path');
  const { u, l } = f;
  const packsNeeded = u.id === 'rv' ? u.packs : [u.id];
  const upto = u.id === 'rv' ? u.packs.filter((x) => state.course.imgpacks.includes(x)).map(loadImgs)
    : state.course.units.slice(0, state.course.units.indexOf(u) + 1).filter((x) => state.course.imgpacks.includes(x.id)).map((x) => loadImgs(x.id));
  app.innerHTML = `<div class="boot" aria-busy="true">${pic('hettie_wave', '')}<p>Hettie kom…</p></div>`;
  await Promise.all([loadPack('ui'), ...packsNeeded.map(loadPack), ...upto]);
  const L = { queue: l.ex.map((x) => ({ ...x })), i: 0, total: l.ex.length, mistakes: 0, retried: new Set(), wrongIds: new Set(), bumped: new Set(), combo: 0, best: 0, answered: 0, firstTry: 0, t0: Date.now(), review: u.id === 'rv' };
  app.innerHTML = `<div class="lesson" style="--u:${u.colour}" role="dialog" aria-label="Lesson: ${esc(l.en)}">
    <div class="lesson-top"><button class="icon-btn" data-a="quit" aria-label="Close lesson">${I.close}</button>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>
      <button class="icon-btn" data-a="sound" aria-label="Sound ${state.sound ? 'on' : 'off'}" aria-pressed="${state.sound}">${state.sound ? I.speaker : I.mute}</button></div>
    <span class="combo-chip" id="combo" aria-hidden="true"></span>
    <div class="stage" id="stage"></div></div>
    <div class="sheet" id="sheet" aria-live="assertive"><div class="in"></div></div>`;
  app.onclick = (e) => {
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'quit') {
      if (L.i > 0 && L.i < L.queue.length && !a.dataset.sure) { a.dataset.sure = '1'; toast('Tap × again to leave. Your progress in this lesson won’t be saved.'); setTimeout(() => delete a.dataset.sure, 3000); return; }
      player.pause(); stopRec(); go('path');
    }
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
  if (ex.t === 'say' && !speakOn()) { L.i++; L.total = Math.max(L.i, L.total); return next(L, u, l); }
  window.__ks.cur = ex;
  stage.innerHTML = ''; stage.scrollTop = 0;
  const done = (ok) => {
    if (ok) { L.i++; progress(L); }
    next(L, u, l);
  };
  const ctx = { L, u, l, ex, stage, done, item: state.course.items[ex.w], slipped: false };
  stage.classList.remove('enter'); void stage.offsetWidth; stage.classList.add('enter');
  (EX[ex.t] || EX.tap)(ctx);
  if (ex.t === 'intro') srsMark([ex.w], 'seen');
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
  const L = ctx.L; const ids = ctx.ex.p || [ctx.ex.w];
  if (ctx.ex.t !== 'say') {
    L.answered++;
    if (!ctx.slipped) { L.firstTry++; L.combo++; L.best = Math.max(L.best, L.combo); }
    srsMark(ids, true, L);
  }
  const milestone = [3, 5, 10, 15, 20].includes(L.combo) && !ctx.slipped;
  sfx(milestone ? 'combo' : 'ok'); vibrate(15);
  const p = PRAISE[Math.floor(Math.random() * PRAISE.length)]; const ui = state.course.ui[p];
  setTimeout(() => say(p), 250);
  const it = ctx.item;
  const chip = $('#combo');
  if (chip && L.combo >= 3) { chip.innerHTML = `${I.sun}<b>${L.combo}</b> op 'n ry`; chip.classList.add('show'); if (milestone) { chip.classList.remove('pop'); void chip.offsetWidth; chip.classList.add('pop'); } }
  sheet('good', milestone ? `${ui.af} ${L.combo} op 'n ry!` : ui.af, `${esc(ui.en)}${milestone ? ` · ${L.combo} in a row` : ''}${it ? ` · <span class="school">${esc(it.af)}</span> = ${esc(it.en)}` : ''}${extra}`, milestone ? 'hettie_crown' : 'hettie_cheer', 'Gaan voort · Continue', () => ctx.done(true));
  announce(`${ui.en}${milestone ? `, ${L.combo} in a row` : ''}`);
}
function oops(ctx, reveal) {
  sfx('soft'); vibrate([20, 40, 20]); ctx.L.mistakes++;
  if (!ctx.slipped) { ctx.slipped = true; srsMark(ctx.ex.p || [ctx.ex.w], false, ctx.L); }
  ctx.L.combo = 0; const chip = $('#combo'); if (chip) chip.classList.remove('show');
  const key = reveal ? 'retry_2' : 'retry_1'; const ui = state.course.ui[key];
  say(key);
  if (!ctx.L.retried.has(ctx.L.i) && reveal) {            // practise it again at the end, once
    ctx.L.retried.add(ctx.L.i); ctx.L.queue.push({ ...ctx.ex }); ctx.L.total++;
  }
  sheet('soft', ui.af, esc(ui.en) + (reveal ? ' · We’ll try this one again later.' : ''), 'hettie_think', null);
  announce(ui.en);
  setTimeout(hideSheet, 1700);
}
function optCard(id, text) {
  const it = state.course.items[id];
  if (text === 'en') return `<button class="opt text en-opt" data-o="${esc(id)}">${esc(it.en)}</button>`;
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
      if (ctx.ex.t === 'tap' || (ctx.ex.t === 'listen' && !ctx.ex.text)) setTimeout(() => say(id, {}), 0);
      if (tries >= 2) { const r = ctx.stage.querySelector(`[data-o="${CSS.escape(ctx.ex.w)}"]`); r && r.classList.add('hint'); setTimeout(() => say(ctx.ex.w), 900); }
      oops(ctx, tries >= 2);
    }
  };
}
const EX = {
  intro(ctx) {
    const it = ctx.item; const isPhrase = /[ .!?]/.test(it.af.trim());
    instr(ctx.stage, 'ui_new');
    const note = state.course.notes && state.course.notes[ctx.ex.w];
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="intro-card ${it.img ? '' : 'textonly'}"><span class="badge">${isPhrase ? 'Nuwe sin · New phrase' : 'Nuwe woord · New word'}</span>
      ${it.img ? `<div class="pic">${pic(it.img, it.en)}</div>` : `<div class="bubble-pic">${pic('hettie_head', '')}</div>`}
      <div class="word ${isPhrase && !it.img ? 'sentence' : ''}" lang="af">${esc(it.af)}</div><div class="en">${esc(it.en)}</div>
      ${note ? `<p class="tip"><b>Tip</b> ${esc(note)}</p>` : ''}
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
    instr(ctx.stage, ctx.ex.text ? 'ui_words' : 'ui_match');
    const ids = ctx.ex.p; const left = shuffle(ids), right = shuffle(ids);
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="match"><div class="col">${left.map((id) => `<button class="chip" data-m="${esc(id)}" data-side="w">${I.speaker}<span>${esc(state.course.items[id].af)}</span></button>`).join('')}</div>
      <div class="col">${right.map((id) => ctx.ex.text ? `<button class="chip en-chip" data-m="${esc(id)}" data-side="p"><span>${esc(state.course.items[id].en)}</span></button>` : `<button class="chip" data-m="${esc(id)}" data-side="p" aria-label="${esc(state.course.items[id].en)}">${pic(state.course.items[id].img, state.course.items[id].en)}</button>`).join('')}</div></div>`);
    say(ctx.ex.text ? 'ui_words' : 'ui_match');
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
        if (!ctx.slipped) { ctx.slipped = true; ctx.L.combo = 0; srsMark([a.dataset.m, b.dataset.m], false, ctx.L); }
      }
    };
  },
  build(ctx) { buildLike(ctx, false); },
  order(ctx) { buildLike(ctx, true); },
  translate(ctx) {
    const it = ctx.item;
    instr(ctx.stage, 'ui_translate');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="sentence-card"><button class="speak" data-s aria-label="Hear it">${I.speaker}</button><p class="word sentence" lang="af">${esc(it.af)}</p></div>
      <div class="opts textual">${ctx.ex.o.map((o) => optCard(o, 'en')).join('')}</div>`);
    setTimeout(() => say(ctx.ex.w, { btn: $('[data-s]', ctx.stage) }), 250);
    $('[data-s]', ctx.stage).onclick = (e) => say(ctx.ex.w, { force: true, btn: e.currentTarget });
    choose(ctx);
  },
  gap(ctx) {
    const it = ctx.item; const toks = it.af.split(/\s+/); const gi = ctx.ex.gi;
    const core = (t) => t.replace(/[.,!?]+$/, ''); const tail = toks[gi].slice(core(toks[gi]).length);
    instr(ctx.stage, 'ui_gap');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="sentence-card gap-card"><p class="word sentence" lang="af">${toks.map((t, i) => i === gi ? `<span class="blank" id="blank" aria-label="gap">&nbsp;</span>${esc(tail)}` : esc(t)).join(' ')}</p><p class="en">${esc(it.en)}</p></div>
      <div class="opts textual words3">${ctx.ex.o.map((o) => `<button class="opt text" data-g="${esc(o)}" lang="af">${esc(o)}</button>`).join('')}</div>`);
    let tries = 0, solved = false;
    $('.opts', ctx.stage).onclick = (e) => {
      const b = e.target.closest('[data-g]'); if (!b || solved) return;
      if (b.dataset.g === core(toks[gi])) {
        solved = true; b.classList.add('right'); const bl = $('#blank'); bl.textContent = b.dataset.g; bl.classList.add('filled');
        setTimeout(() => { say(ctx.ex.w); good(ctx); }, 200);
      } else {
        tries++; b.classList.add('wrong');
        if (tries >= 2) { const r = ctx.stage.querySelector(`[data-g="${CSS.escape(core(toks[gi]))}"]`); r && r.classList.add('hint'); }
        oops(ctx, tries >= 2);
      }
    };
  },
  dictate(ctx) {
    const it = ctx.item;
    instr(ctx.stage, 'ui_dictate');
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="listen-hero"><button class="speak big" data-s="1" aria-label="Play the sentence">${I.speaker.replace('class="icon"', '')}</button>
      <button class="speak slow" data-s="slow" aria-label="Play slowly">${pic('skilpad', 'slowly')}</button></div>
      <form class="dictate" novalidate><label class="sr" for="dict">Type what you hear</label>
      <textarea id="dict" rows="2" lang="af" autocomplete="off" autocapitalize="sentences" spellcheck="false" placeholder="Tik wat jy hoor · Type what you hear"></textarea>
      <div class="accents" aria-label="Accented letters">${['ê', 'ë', 'ô', 'î', 'û', 'é', "'n"].map((c) => `<button type="button" class="tile small" data-k="${c}">${c}</button>`).join('')}</div>
      <p class="heard" id="dres" aria-live="polite"></p>
      <div class="footer-cta"><div class="in"><button class="btn ok" type="submit">Kyk · Check</button></div></div></form>`);
    setTimeout(() => say(ctx.ex.w, { btn: $('.speak.big', ctx.stage) }), 300);
    $('.listen-hero', ctx.stage).onclick = (e) => { const s = e.target.closest('[data-s]'); if (s) say(ctx.ex.w, { force: true, rate: s.dataset.s === 'slow' ? 0.7 : 1, btn: s }); };
    const ta = $('#dict');
    $('.accents', ctx.stage).onclick = (e) => { const k = e.target.closest('[data-k]'); if (!k) return; const v = k.dataset.k; const p0 = ta.selectionStart, p1 = ta.selectionEnd; ta.value = ta.value.slice(0, p0) + v + ta.value.slice(p1); ta.focus(); ta.selectionStart = ta.selectionEnd = p0 + v.length; };
    let tries = 0;
    const strict = (x) => x.toLowerCase().replace(/[’`]/g, "'").replace(/[.,!?;:]/g, '').replace(/\s+/g, ' ').trim();
    $('form.dictate', ctx.stage).onsubmit = (e) => {
      e.preventDefault(); const v = ta.value; if (!v.trim()) return;
      const res = $('#dres');
      if (strict(v) === strict(it.af)) { ctx.item = it; good(ctx); return; }
      if (norm(v) === norm(it.af)) { ctx.item = it; good(ctx, ` · Watch the accents: <span class="school">${esc(it.af)}</span>`); return; }
      tries++;
      if (similar(v, it.af) >= 0.88) { ctx.item = it; good(ctx, ` · Nearly perfect. It’s spelt <span class="school">${esc(it.af)}</span>`); return; }
      if (tries >= 2) { res.innerHTML = `It’s: <b class="school">${esc(it.af)}</b>`; ctx.L.mistakes++; ctx.item = it; if (!ctx.slipped) { ctx.slipped = true; srsMark([ctx.ex.w], false, ctx.L); } ctx.L.combo = 0; sheet('soft', 'Lekker probeer!', `Good try. The answer is <span class="school">${esc(it.af)}</span>`, 'hettie_think', 'Gaan voort · Continue', () => ctx.done(true)); return; }
      oops(ctx, false); res.textContent = 'Not quite. Listen again (try the slow button).';
    };
  },
  sentence(ctx) { buildLike(ctx, true); },
  say(ctx) {
    const it = ctx.item;
    instr(ctx.stage, 'ui_say');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    ctx.stage.insertAdjacentHTML('beforeend', `<div class="say">${it.img ? `<div class="pic">${pic(it.img, it.en)}</div>` : `<div class="bubble-pic">${pic('hettie_head', '')}</div>`}
      <div style="display:flex;align-items:center;gap:12px"><button class="speak" data-s aria-label="Hear it first">${I.speaker}</button><span class="word ${it.img ? '' : 'sentence'}" lang="af">${esc(it.af)}</span></div>
      <p class="en" style="margin:0">${esc(it.en)}</p>
      ${SR ? `<button class="mic" id="mic" aria-label="Tap and say it">${I.mic}</button><p class="heard" id="heard">Tap the microphone, then say it.</p>`
        : `<p class="hint">Say it out loud, then tap the button.</p>`}
      <div class="footer-cta"><div class="in" style="display:grid;gap:10px">
        <button class="btn ${SR ? 'ghost' : 'ok'}" id="saidit">${SR ? 'Skip the microphone' : 'Ek het dit gesê! · I said it!'}</button>
        <button class="link" id="nospeak" type="button">Can’t speak right now</button></div></div></div>`);
    say('ui_say').then(() => sleep(state.sound ? 1300 : 0)).then(() => say(ctx.ex.w));
    $('[data-s]', ctx.stage).onclick = (e) => say(ctx.ex.w, { force: true, btn: e.currentTarget });
    $('#saidit').onclick = () => { stopRec(); ctx.item = it; good(ctx); };
    $('#nospeak').onclick = () => { stopRec(); state.speakOff = Date.now() + 15 * 60e3; toast('Speaking exercises are off for 15 minutes.'); ctx.done(true); };
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
          else if (attempts >= 2) { ctx.item = it; sheet('good', 'Lekker probeer!', 'Great try! Keep practising out loud.', 'hettie_cheer', 'Gaan voort · Continue', () => ctx.done(true)); sfx('ok'); }
          else { sfx('soft'); heard.textContent += ' Probeer weer! · Try again!'; }
        };
        rec.onerror = (ev) => {
          heard.textContent = ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
            ? 'The microphone isn’t available. Say it out loud, then tap the button below.'
            : 'Didn’t catch that. Tap the microphone and try again.';
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'language-not-supported') { $('#saidit').textContent = 'Ek het dit gesê! · I said it!'; $('#saidit').className = 'btn ok'; mic.disabled = true; }
        };
        rec.onend = () => { mic.classList.remove('on'); rec = null; };
        rec.start();
      } catch { heard.textContent = 'Say it out loud, then tap the button below.'; rec = null; }
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
  const noPic = !it.img;
  ctx.stage.insertAdjacentHTML('beforeend', `${noPic ? `<div class="en-prompt"><button class="speak" data-s aria-label="Hear it">${I.speaker}</button><p>${esc(it.en)}</p></div>` : `<div class="build-pic">${pic(it.img, it.en)}<button class="speak" data-s aria-label="Hear it">${I.speaker}</button></div>
    ${words ? `<p class="en" style="text-align:center;margin:-6px 0 12px">${esc(it.en)}</p>` : ''}`}
    <div class="slots ${words ? 'words' : ''}" aria-label="Your answer">${target.map((_, i) => `<button class="slot" data-slot="${i}" aria-label="Empty"></button>`).join('')}</div>
    <div class="bank">${tiles.map((t) => `<button class="tile" data-t="${t.i}">${esc(t.t)}</button>`).join('')}</div>`);
  if (!noPic) say(ctx.ex.w);
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

/* ---------- review (spaced repetition) ---------- */
const speakOn = () => state.speak && !(state.speakOff && state.speakOff > Date.now());
function packOf(id) { return state.course.audio[id]; }
function buildReview(cid = state.active) {
  const s = srs(cid); const t = today(); const items = state.course.items;
  const all = Object.entries(s).filter(([id]) => items[id]);
  if (!all.length) return null;
  // mistakes first, then what's due, then the weakest of the rest
  const score = ([, r]) => (r[1] <= t ? 0 : 1000) + (r[0] === 0 && r[2] > 0 ? -500 : 0) + r[0] * 10 - Math.min(9, r[2]);
  const pickIds = all.sort((x, y) => score(x) - score(y)).slice(0, 8).map(([id]) => id);
  const learnt = all.map(([id]) => id);
  const pool = (id, n) => {
    const kind = !!items[id].img; const lv = packOf(id)[0];
    const same = (x) => x !== id && !!items[x].img === kind && items[x].af !== items[id].af;
    let c = shuffle(learnt.filter(same)); if (c.length < n) c = c.concat(shuffle(Object.keys(items).filter((x) => same(x) && packOf(x) && packOf(x)[0] === lv && !c.includes(x))));
    return c.slice(0, n);
  };
  const ex = []; let said = 0;
  pickIds.forEach((id, k) => {
    const it = items[id]; const r = s[id]; const hard = r[0] >= 3;
    if (it.img) {
      const kinds = ['listen', 'tap']; if (/^[^ ]{3,8}$/.test(it.af) && hard) kinds.push('build');
      if (speakOn() && said < 1 && k % 3 === 2) kinds.push('say');
      const t = kinds[k % kinds.length];
      if (t === 'build') { const extra = shuffle('aeiknorstdl'.split('').filter((c) => !it.af.includes(c))).slice(0, 2); ex.push({ t: 'build', w: id, tiles: shuffle([...it.af, ...extra]) }); }
      else if (t === 'say') { said++; ex.push({ t: 'say', w: id }); }
      else ex.push({ t, w: id, o: shuffle([id, ...pool(id, 2)]) });
    } else {
      const words = it.af.split(/\s+/);
      const kinds = ['translate', 'listen', words.length >= 3 ? 'order' : 'translate', 'dictate'];
      const t = kinds[(k + (hard ? 2 : 0)) % kinds.length];
      if (t === 'order') {
        const other = shuffle(learnt.filter((x) => !items[x].img && x !== id).flatMap((x) => items[x].af.split(/\s+/))).filter((w) => !words.includes(w)).slice(0, 2);
        ex.push({ t: 'order', w: id, tiles: shuffle([...words, ...other]) });
      } else if (t === 'dictate') ex.push({ t: 'dictate', w: id });
      else if (t === 'listen') ex.push({ t: 'listen', w: id, o: shuffle([id, ...pool(id, 2)]), text: true });
      else ex.push({ t: 'translate', w: id, o: shuffle([id, ...pool(id, 2)]) });
    }
  });
  const pics = pickIds.filter((id) => items[id].img); const texts = pickIds.filter((id) => !items[id].img);
  if (pics.length >= 4) ex.push({ t: 'match', p: pics.slice(0, 4) });
  else if (texts.length >= 4) ex.push({ t: 'match', p: texts.slice(0, 4), text: true });
  const packs = [...new Set(pickIds.map(packOf).concat(ex.flatMap((e) => (e.o || e.p || []).map(packOf))).filter(Boolean))];
  return { u: { id: 'rv', colour: '#6F9FC8', packs, lessons: [], en: 'Review' }, l: { id: 'rv', title: 'Hersiening', en: 'Review', ex: ex.filter((e) => !e.o || e.o.length >= 2) } };
}
function startReview() {
  const r = buildReview(); if (!r) return toast('Finish a lesson first, then Hettie can quiz you on it.');
  state.review = r; go('lesson', 'rv');
}

/* ---------- finish + celebrate ---------- */
async function finishLesson(L, u, l) {
  const perfect = L.mistakes === 0; const xp = (L.review ? 10 : 10) + (perfect ? 5 : 0);
  const cid = state.active; const before = stats(cid);
  const ev = [rid(), l.id, xp, perfect ? 1 : 0, today(), Date.now()];
  mergeEvents(cid, [ev]);
  if (cid !== 'guest') { S.set(pendKey(cid), [...S.get(pendKey(cid), []), ev[0]]); sync(cid); pushPf(cid); }
  const after = stats(cid); const goal = goalXp(cid);
  celebrate({ xp, perfect, streak: after.streak, newDay: !before.todayDone, review: L.review,
    unitDone: !L.review && u.lessons.every((x) => after.done[x.id]) && !u.lessons.every((x) => before.done[x.id]), u, l, days: after.days, frozen: after.frozen,
    goal, before: before.xpToday, after: after.xpToday, hitGoal: before.xpToday < goal && after.xpToday >= goal,
    freeze: after.hold > before.hold, acc: L.answered ? Math.round((L.firstTry / L.answered) * 100) : 100, secs: Math.round((Date.now() - L.t0) / 1000), best: L.best, slips: L.wrongIds.size });
}
const DAYS = ['S', 'M', 'D', 'W', 'D', 'V', 'S'];        // Sondag..Saterdag
function countUp(el, to, ms = 900) {
  if (!el) return; if (lessMotion()) { el.textContent = to; return; }
  const t0 = performance.now(); (function f(t) { const k = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(f); })(t0);
}
function celebrate(r) {
  sfx('win'); setTimeout(() => say('done_1'), 500); vibrate([30, 60, 30]);
  if (r.hitGoal) setTimeout(() => sfx('goal'), 1300);
  const week = []; const d = new Date(); d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) { const k = today(d); week.push(`<span class="day ${r.days.has(k) ? 'on' : ''} ${r.frozen.has(k) ? 'frozen' : ''} ${i === 6 ? 'today' : ''}"><i>${r.frozen.has(k) ? I.snow : I.sun}</i>${DAYS[d.getDay()]}</span>`); d.setDate(d.getDate() + 1); }
  const mm = Math.floor(r.secs / 60), ss = String(r.secs % 60).padStart(2, '0');
  const pct = Math.min(100, Math.round((r.after / r.goal) * 100));
  const title = r.review ? 'Hersiening klaar!' : r.unitDone ? 'Eenheid klaar!' : r.perfect ? 'Perfek!' : 'Jy het dit gedoen!';
  const sub = r.review ? `Review done. Those words will come back just before you’d forget them.` : r.unitDone ? `You finished ${esc(r.u.en)}! You earned a crown.` : r.perfect ? 'Perfect lesson, no mistakes.' : 'You did it!';
  app.insertAdjacentHTML('beforeend', `<div class="celebrate" role="dialog" aria-modal="true" aria-labelledby="cel-h"><canvas id="confetti" aria-hidden="true"></canvas>
    ${pic(r.unitDone || r.hitGoal ? 'hettie_crown' : 'hettie_cheer', 'Hettie celebrating').replace('<img', '<img class="hero-img"')}
    <h1 id="cel-h">${title}</h1>
    <p class="en">${sub}</p>
    <div class="stats three">
      <div class="stat xp"><small>XP</small><b>${I.protea.replace('class="icon"', '')}+<span data-count="${r.xp}">0</span></b></div>
      <div class="stat acc"><small>Akkuraatheid</small><b>${I.check}<span data-count="${r.acc}">0</span>%</b></div>
      <div class="stat time"><small>Tyd</small><b>${I.clock}${mm}:${ss}</b></div></div>
    <div class="goal-card ${r.after >= r.goal ? 'met' : ''}"><div class="goal-top"><b>${r.hitGoal ? 'Daaglikse doel bereik!' : 'Daaglikse doel'}</b><span>${Math.min(r.after, r.goal)}/${r.goal} XP</span></div>
      <div class="goal-bar" role="progressbar" aria-label="Daily goal" aria-valuemin="0" aria-valuemax="${r.goal}" aria-valuenow="${Math.min(r.after, r.goal)}"><i style="--from:${Math.min(100, Math.round((r.before / r.goal) * 100))}%;--to:${pct}%"></i></div>
      <span class="en">${r.hitGoal ? 'Daily goal reached. Hettie is very loud about it.' : r.after >= r.goal ? 'Goal already met today. Everything extra is a bonus.' : `${r.goal - r.after} XP to go today.`}</span></div>
    <div class="streak-row"><div class="streak-num">${I.sun}<b>${r.streak}</b><span>${r.streak === 1 ? 'dag' : 'dae'}</span></div><div class="week" aria-label="This week">${week.join('')}</div></div>
    ${r.freeze ? `<p class="freeze-note">${I.snow} <span><b>Streak freeze earned!</b> If you miss a day, it protects your streak automatically.</span></p>` : ''}
    ${isGuest() ? `<div class="guest-bar" style="margin:0 0 14px;text-align:left"><div><b>Keep this progress safe</b>Create a free account to save it across devices.</div><button class="btn small" data-a="signup">Save</button></div>` : ''}
    <div class="cel-actions">${r.slips && !r.review ? `<button class="btn ghost" id="revnow">${I.redo} Review mistakes now</button>` : ''}
    <button class="btn ok" id="cont">Gaan voort · Continue</button></div></div>`);
  confetti($('#confetti'));
  $$('.celebrate [data-count]').forEach((el, i) => setTimeout(() => countUp(el, +el.dataset.count), 350 + i * 150));
  announce(`${title}. ${r.xp} XP. ${r.acc}% accuracy. Streak ${r.streak}.`);
  $('#cont').onclick = () => { sfx('tap'); go('path'); };
  const rv = $('#revnow'); if (rv) rv.onclick = () => { sfx('tap'); startReview(); };
  const sv = $('.celebrate [data-a=signup]'); if (sv) sv.onclick = () => go('auth', 'signup');
  setTimeout(() => $('#cont') && $('#cont').focus({ preventScroll: true }), 300);
}
function confetti(cv) {
  if (!cv || lessMotion()) return;
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

/* ---------- onboarding + placement ---------- */
const WHY = [['family', 'Family and friends'], ['travel', 'Travel'], ['work', 'Work'], ['heritage', 'My heritage'], ['moving', 'Moving to South Africa'], ['fun', 'Just for fun']];
function needsOnboarding(cid = state.active) { return cid && !getPf(cid).onboarded && !events(cid).length; }
VIEWS.onboard = (step = 0) => {
  const pf = getPf();
  const shell = (body, { back = true, pct = 0 } = {}) => {
    app.innerHTML = `<main class="wrap onboard"><div class="ob-top">${back ? `<button class="icon-btn" data-a="obback" aria-label="Back">${I.back}</button>` : '<span></span>'}
      <div class="bar" role="progressbar" aria-label="Setup" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div></div>${body}</main>`;
  };
  const hettie = (pose, line, en, cls = '') => `<div class="ob-hettie ${cls}">${pic(pose, 'Hettie Hadida')}<div class="speech" lang="af"><b>${line}</b>${en ? `<span class="en">${en}</span>` : ''}</div></div>`;
  if (step === 0) {
    shell(`${hettie('hettie_wave', 'Hallo, ek is Hettie Hadida!', 'Hi! I’m Hettie Hadida. I’ll help you learn Afrikaans, a few minutes at a time.', 'hero')}
      <div class="footer-cta"><div class="in"><button class="btn ok" data-next="1">Gaan voort · Continue</button></div></div>`, { back: false, pct: 5 });
    say('hi_hettie');
  } else if (step === 1) {
    shell(`${hettie('hettie_head', 'Hoekom leer jy Afrikaans?', 'Why are you learning Afrikaans?')}
      <div class="ob-list" role="radiogroup" aria-label="Why are you learning">${WHY.map(([v, l]) => `<button role="radio" aria-checked="${pf.why === v}" class="ob-opt ${pf.why === v ? 'on' : ''}" data-why="${v}">${l}</button>`).join('')}</div>
      <div class="footer-cta"><div class="in"><button class="btn ok" data-next="2" ${pf.why ? '' : 'disabled'}>Gaan voort · Continue</button></div></div>`, { pct: 25 });
  } else if (step === 2) {
    const g = pf.goal || 20;
    shell(`${hettie('hettie_cheer', 'Kies jou daaglikse doel.', 'Pick a daily goal. You can change it any time.')}
      <div class="ob-list" role="radiogroup" aria-label="Daily goal">${GOALS.map((x) => `<button role="radio" aria-checked="${x.xp === g}" class="ob-opt goal ${x.xp === g ? 'on' : ''}" data-goal="${x.xp}"><b>${x.af}</b><span class="en">${x.en}</span><span class="xp">${x.min} a day</span></button>`).join('')}</div>
      <div class="footer-cta"><div class="in"><button class="btn ok" data-next="3">Gaan voort · Continue</button></div></div>`, { pct: 50 });
    if (!pf.goal) setPf({ goal: 20 });
  } else if (step === 3) {
    shell(`${hettie('hettie_think', 'Hoeveel Afrikaans ken jy?', 'How much Afrikaans do you know?')}
      <div class="ob-list">
        <button class="ob-opt big" data-lvl="new"><b>Ek is heeltemal nuut</b><span class="en">I’m completely new. Start from hallo.</span></button>
        <button class="ob-opt big" data-lvl="some"><b>Ek ken 'n paar woorde</b><span class="en">I know some words. Find my level (about 2 minutes).</span></button>
        <button class="ob-opt big" data-lvl="more"><b>Ek kan al 'n bietjie gesels</b><span class="en">I can already chat a little. Find my level.</span></button></div>`, { pct: 75 });
  }
  app.onclick = (e) => {
    const w = e.target.closest('[data-why]'); if (w) { setPf({ why: w.dataset.why }); sfx('tap'); return VIEWS.onboard(1); }
    const g = e.target.closest('[data-goal]'); if (g) { setPf({ goal: +g.dataset.goal }); sfx('tap'); return VIEWS.onboard(2); }
    const lv = e.target.closest('[data-lvl]');
    if (lv) { sfx('tap'); if (lv.dataset.lvl === 'new') { setPf({ onboarded: 1 }); state.level = 'beginner'; S.set('level', 'beginner'); toast('Lekker! Your first lesson is ready.'); return go('path'); } return go('placement'); }
    const n = e.target.closest('[data-next]'); if (n) { sfx('tap'); return VIEWS.onboard(+n.dataset.next); }
    const b = e.target.closest('[data-a=obback]'); if (b) return VIEWS.onboard(Math.max(0, step - 1));
  };
};
VIEWS.placement = async () => {
  const beg = state.course.units.filter((u) => u.level === 'beginner');
  app.innerHTML = `<div class="boot" aria-busy="true">${pic('hettie_think', '')}<p>Hettie berei 'n paar vrae voor…</p></div>`;
  await Promise.all([loadPack('ui'), ...beg.map((u) => loadPack(u.id)), ...beg.filter((u) => state.course.imgpacks.includes(u.id)).map((u) => loadImgs(u.id))]);
  const items = state.course.items; const Q = [];
  for (const u of beg) {
    const ids = shuffle([...new Set(u.lessons.flatMap((l) => l.ex.filter((x) => x.t === 'intro').map((x) => x.w)))].filter((id) => items[id].img));
    const two = ids.slice(0, 2);
    two.forEach((id, k) => { const d = shuffle(ids.filter((x) => x !== id && items[x].en !== items[id].en)).slice(0, 2); Q.push({ u: u.id, w: id, t: k ? 'read' : 'hear', o: shuffle([id, ...d]) }); });
  }
  const ans = []; let i = 0; window.__ks.pq = Q;
  const render = () => {
    if (i >= Q.length) return finish();
    const q = Q[i]; const it = items[q.w];
    app.innerHTML = `<main class="wrap onboard placement"><div class="ob-top"><button class="icon-btn" data-a="quit" aria-label="Stop the placement quiz">${I.close}</button>
      <div class="bar" role="progressbar" aria-label="Placement" aria-valuemin="0" aria-valuemax="${Q.length}" aria-valuenow="${i}"><i style="width:${Math.round((i / Q.length) * 100)}%"></i></div></div>
      <div class="stage enter">${q.t === 'hear' ? `<div class="prompt"><div><h2>Luister mooi en kies.</h2><span class="en">Listen and choose the picture.</span></div></div>
        <div class="listen-hero"><button class="speak big" data-s="1" aria-label="Play the word">${I.speaker.replace('class="icon"', '')}</button></div>
        <div class="opts three">${q.o.map((o) => `<button class="opt" data-o="${esc(o)}" aria-label="${esc(items[o].en)}">${pic(items[o].img, items[o].en)}</button>`).join('')}</div>`
      : `<div class="prompt"><div><h2>Wat beteken dit?</h2><span class="en">What does it mean?</span></div></div>
        <div class="sentence-card"><p class="word" lang="af">${esc(it.af)}</p></div>
        <div class="opts textual">${q.o.map((o) => `<button class="opt text en-opt" data-o="${esc(o)}">${esc(items[o].en)}</button>`).join('')}</div>`}
      <div class="footer-cta"><div class="in"><button class="btn ghost" data-o="__skip">Ek weet nie · I don’t know</button></div></div></div></main>`;
    if (q.t === 'hear') { setTimeout(() => say(q.w, { force: true, btn: $('.speak.big') }), 250); $('[data-s]').onclick = (e) => say(q.w, { force: true, btn: e.currentTarget }); }
  };
  const finish = () => {
    const known = {}; for (const u of beg) known[u.id] = Q.filter((q) => q.u === u.id).every((q) => ans[Q.indexOf(q)]);
    let k = 0; while (k < beg.length && known[beg[k].id]) k++;
    const cid = state.active; const evs = []; const s = { ...srs(cid) }; let t = Date.now();
    for (const u of beg.slice(0, k)) for (const l of u.lessons) { evs.push([rid(), l.id, 0, 2, today(), t++]); for (const x of l.ex) if (x.t === 'intro' && !s[x.w]) s[x.w] = [1, addDays(1), 0, 0, t]; }
    if (evs.length) { mergeEvents(cid, evs); if (cid !== 'guest') { S.set(pendKey(cid), [...S.get(pendKey(cid), []), ...evs.map((e) => e[0])]); sync(cid); } }
    setPf({ srs: s, onboarded: 1, placed: k });
    const next = beg[k];
    app.innerHTML = `<main class="wrap onboard"><div class="ob-hettie result">${pic(k ? 'hettie_crown' : 'hettie_cheer', 'Hettie Hadida')}
      <div class="speech" lang="af"><b>${k >= beg.length ? 'Jy ken die basiese goed!' : k ? 'Mooi so!' : 'Ons begin by die begin.'}</b>
      <span class="en">${k >= beg.length ? 'You know the Beginner basics. Intermediate is next (part of Kleinspan Plus), or review Beginner any time.' : k ? `You placed past ${k} unit${k > 1 ? 's' : ''}. You’ll start at <b>${esc(next.title)}</b> (${esc(next.en)}).` : 'No problem at all. You’ll start with greetings, and it builds from there.'}</span></div></div>
      <p class="hint" style="text-align:center">You got ${ans.filter(Boolean).length} of ${Q.length}. You can still open any earlier lesson to practise.</p>
      <div class="footer-cta"><div class="in"><button class="btn ok" id="obgo">Begin · Start learning</button></div></div></main>`;
    sfx(k ? 'win' : 'ok');
    $('#obgo').onclick = () => { state.level = k >= beg.length && plus() ? 'intermediate' : 'beginner'; S.set('level', state.level); go('path'); };
  };
  app.onclick = (e) => {
    const a = e.target.closest('[data-a=quit]'); if (a) { setPf({ onboarded: 1 }); return go('path'); }
    const b = e.target.closest('[data-o]'); if (!b || b.disabled) return;
    $$('[data-o]').forEach((x) => { x.disabled = true; });
    ans[i] = b.dataset.o === Q[i].w; b.classList.add('picked'); sfx('tap'); i++;
    setTimeout(render, 280);
  };
  render();
};

/* ---------- settings (works for guests too) ---------- */
const seg = (name, val, opts) => `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${opts.map(([v, label]) => `<button type="button" role="radio" aria-checked="${v === val}" class="${v === val ? 'on' : ''}" data-set="${esc(name)}" data-v="${esc(v)}">${label}</button>`).join('')}</div>`;
const toggle = (key, on, label, sub) => `<label class="toggle"><span><b>${label}</b>${sub ? `<span class="en">${sub}</span>` : ''}</span><input type="checkbox" role="switch" data-tg="${key}" ${on ? 'checked' : ''}><i aria-hidden="true"></i></label>`;
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });
VIEWS.settings = (focus) => {
  if (!state.active) return go('welcome');
  const goal = goalXp();
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  app.innerHTML = `<main class="wrap settings"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Instellings <span class="en">Settings</span></h1></div>
    <section class="panel" id="goal-sec"><h2>Daaglikse doel <span class="en">Daily goal</span></h2>
      <div class="goals" role="radiogroup" aria-label="Daily goal">${GOALS.map((g) => `<button type="button" role="radio" aria-checked="${g.xp === goal}" class="goal-opt ${g.xp === goal ? 'on' : ''}" data-goal="${g.xp}"><b>${g.af}</b><span class="en">${g.en}</span><span class="xp">${g.xp} XP</span><small>${g.min} a day</small></button>`).join('')}</div></section>
    <section class="panel"><h2>Klank <span class="en">Sound</span></h2>
      ${toggle('sound', state.sound, 'Hettie’s voice', 'Plays each word and sentence automatically')}
      ${toggle('fx', state.fx, 'Sound effects', 'Little chimes for right answers and finished lessons')}
      ${toggle('speak', state.speak, 'Speaking exercises', 'Uses your microphone where the browser supports it')}</section>
    <section class="panel"><h2>Voorkoms <span class="en">Appearance</span></h2>
      <p class="hint">Theme</p>${seg('theme', state.theme, [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])}
      ${toggle('motion', state.motion === 'less', 'Less motion', 'No confetti, bouncing or count-ups. Follows your device setting too.')}</section>
    <section class="panel"><h2>App</h2>
      <p class="hint">Lessons already work offline once opened. Download the rest to practise without a connection.</p>
      <div class="stack"><button class="btn ghost" data-a="offline">${I.download} Download all lessons for offline</button>
      ${standalone ? '<p class="hint">Installed as an app.</p>' : `<button class="btn ghost" data-a="install">Install Kleinspan on this device</button>`}
      <p class="hint" id="dl-msg" role="status"></p></div></section>
    <section class="panel"><h2>Rekening <span class="en">Account</span></h2>
      ${state.session ? `<p class="hint">Signed in as <b>${esc(state.session.email)}</b></p><button class="btn ghost" data-a="account">Account, plan and profiles</button>`
        : `<p class="hint">You’re learning as a guest. A free account keeps your progress, goal and review words safe across devices.</p><div class="stack"><button class="btn" data-a="signup">Create a free account</button><button class="btn ghost" data-a="signin">Sign in</button></div>`}
      <p class="hint" style="margin-top:12px">Keyboard: press 1–9 to pick an answer and Enter to continue.</p>
      <a class="link" href="privacy.html">Privacy notice</a></section></main>`;
  if (focus === 'goal') requestAnimationFrame(() => { const g = $('.goal-opt.on'); g && g.focus({ preventScroll: true }); $('#goal-sec').scrollIntoView({ block: 'start' }); });
  app.onchange = (e) => {
    const t = e.target.closest('[data-tg]'); if (!t) return; const k = t.dataset.tg;
    if (k === 'motion') { state.motion = t.checked ? 'less' : 'auto'; S.set('motion', state.motion); applyTheme(); }
    else { state[k] = t.checked; S.set(k, t.checked); }
    if (k === 'fx' && t.checked) sfx('ok');
    if (k === 'sound' && t.checked) say('ok_1');
  };
  app.onclick = async (e) => {
    const g = e.target.closest('[data-goal]');
    if (g) { setPf({ goal: +g.dataset.goal }); sfx('pop'); $$('.goal-opt').forEach((b) => { const on = b === g; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); toast(`Daily goal: ${g.dataset.goal} XP`); return; }
    const sg = e.target.closest('[data-set]');
    if (sg) { state.theme = sg.dataset.v; S.set('theme', state.theme); applyTheme(); sfx('tap'); $$('[data-set=theme]').forEach((b) => { const on = b === sg; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); }); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'back') go('path');
    if (a.dataset.a === 'account') go(state.children.length > 1 ? 'profiles' : 'parents');
    if (a.dataset.a === 'signup') go('auth', 'signup');
    if (a.dataset.a === 'signin') go('auth', 'login');
    if (a.dataset.a === 'install') {
      if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r && r.outcome === 'accepted') toast('Installed!'); }
      else $('#dl-msg').textContent = /iphone|ipad/i.test(navigator.userAgent) ? 'On iPhone or iPad: tap Share, then “Add to Home Screen”.' : 'Use your browser menu and choose “Install app” or “Add to Home screen”.';
    }
    if (a.dataset.a === 'offline') {
      const files = [...state.course.units.map((u) => `audio/${u.id}.json`), 'audio/ui.json', ...state.course.imgpacks.map((x) => `imgpack/${x}.json`)];
      a.disabled = true; let n = 0; const msg = $('#dl-msg');
      for (const f of files) { try { await fetch(f); } catch {} n++; msg.textContent = `Downloading… ${Math.round((n / files.length) * 100)}%`; }
      msg.textContent = 'Done. Every lesson now works offline on this device.'; a.disabled = false; sfx('ok');
    }
  };
};

/* ---------- Kleinspan Plus (placeholder, nothing is sold yet) ---------- */
VIEWS.plus = () => {
  const save = Math.round((1 - parseFloat(PLUS.year.replace(/[^\d.]/g, '')) / (parseFloat(PLUS.month.replace(/[^\d.]/g, '')) * 12)) * 100);
  app.innerHTML = `<main class="wrap plus-page"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Kleinspan Plus</h1></div>
    <div class="plus-hero">${pic('hettie_crown', 'Hettie wearing a crown')}<h2>Go further with Hettie</h2><p class="en">Everything in the free Beginner level, plus:</p></div>
    <ul class="perks"><li>${I.check}<span><b>Intermediêr</b> Real conversations: shops, directions, the doctor, small talk</span></li>
      <li>${I.check}<span><b>Verbs and tenses</b> Past, future and word order, explained simply</span></li>
      <li>${I.check}<span><b>Idioms and slang</b> The Afrikaans people actually use</span></li>
      <li>${I.check}<span><b>Gevorderd</b> When it launches</span></li>
      <li>${I.check}<span><b>Up to 3 profiles</b> on one account</span></li></ul>
    <div class="plans"><div class="plan-opt"><b>Monthly</b><span class="price">${PLUS.month}</span><span class="en">per month</span></div>
      <div class="plan-opt best"><span class="ribbon">Save ${save}%</span><b>Yearly</b><span class="price">${PLUS.year}</span><span class="en">per year</span></div></div>
    <button class="btn" disabled>Coming soon</button>
    <p class="hint" style="text-align:center">Plus isn’t on sale yet. Prices may change before launch. The Beginner level stays free.</p></main>`;
  app.onclick = (e) => { const a = e.target.closest('[data-a]'); if (a && a.dataset.a === 'back') go(state.active ? 'path' : 'welcome'); };
};

/* ---------- account area ---------- */
VIEWS.parents = () => {
  if (!state.session) return go('welcome');
  const ent = state.session.ent || {};
  const total = state.course.units.reduce((n, u) => n + u.lessons.length, 0);
  const kids = state.children.map((c) => { const st = stats(c.id); return `<div class="kid-row">${face(c.avatar)}<div class="meta"><b>${esc(c.name)}</b>${st.xp} XP · ${st.streak}-day streak · ${st.lessons} of ${total} lessons</div>
    <button class="btn ghost small" data-edit="${esc(c.id)}">Edit</button></div>`; }).join('') || '<p class="hint">No profiles yet.</p>';
  app.innerHTML = `<main class="wrap"><div class="page-head"><button class="icon-btn" data-a="back" aria-label="Back">${I.back}</button><h1>Account</h1></div>
    <section class="panel"><h2>${state.children.length > 1 ? 'Profiles' : 'Your profile'}</h2>${kids}
      ${state.children.length > 1 ? `<button class="btn ok" style="margin-top:12px" data-a="switch">Switch profile</button>` : ''}
      ${state.children.length < 3 ? `<details class="household"><summary>Learning with someone else?</summary><p class="hint">Add up to 3 profiles to one account, each with its own progress. Handy for partners or the whole household.</p><button class="btn ghost" data-a="add">${I.plus.replace('<svg', '<svg class="icon"')} Add a profile</button></details>` : ''}</section>
    <section class="panel"><h2>Plan</h2>
      <p>${ent.plus ? '<b>Kleinspan Plus</b> is active.' : 'You’re on the <b>free plan</b>: the whole Beginner level, all five units.'}</p>
      <div class="plan"><b>Kleinspan Plus</b><div class="price">${PLUS.month}<span class="en"> /month</span> or ${PLUS.year}<span class="en"> /year</span></div>
        <ul><li>Intermediate: real conversations, verbs and tenses, word order, idioms and slang</li><li>Advanced, when it launches</li><li>Up to 3 profiles on one account</li><li>No ads, ever</li></ul>
        <button class="btn" disabled>Coming soon</button></div></section>
    <section class="panel"><h2>Account</h2><p class="hint">Signed in as <b>${esc(state.session.email)}</b></p>
      <form id="pwf" novalidate><div class="field"><label for="cur">Current password</label><input id="cur" type="password" autocomplete="current-password"></div>
      <div class="field"><label for="npw">New password</label><input id="npw" type="password" autocomplete="new-password" minlength="8"></div>
      <p class="err" id="pwerr" role="alert"></p><button class="btn ghost" type="submit">Change password</button></form>
      <div class="stack"><button class="btn ghost" data-a="signout">Sign out</button>
      <button class="link" data-a="delete">Delete account and all data</button>
      <a class="link" href="privacy.html">Privacy notice</a></div></section></main>`;
  app.onclick = async (e) => {
    const ed = e.target.closest('[data-edit]'); if (ed) return go('addchild', { edit: ed.dataset.edit });
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'back') go(state.active && child() ? 'path' : 'profiles');
    if (a.dataset.a === 'switch') go('profiles');
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
    <form class="panel" novalidate><p>This permanently deletes your account, all its profiles and all their progress from our server. It can’t be undone.</p>
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
function freezeCheck() {
  const r = applyFreezes(); if (!r) return;
  if (state.view === 'path') go('path');
  sfx('freeze');
  app.insertAdjacentHTML('beforeend', `<div class="modal-bg" id="fzm"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="fz-h">${pic('hettie_sleep', 'Hettie resting')}
    <h2 id="fz-h">${I.snow} Reeks gered!</h2><p>You missed ${r.used > 1 ? `${r.used} days` : 'a day'}, so Hettie used ${r.used > 1 ? `${r.used} streak freezes` : 'a streak freeze'}. Your <b>${r.streak}-day streak</b> is safe.</p>
    <button class="btn ok" id="fzok">Lekker! Let’s keep it going</button></div></div>`);
  $('#fzok').focus(); $('#fzok').onclick = () => $('#fzm').remove();
}
async function boot() {
  try { [state.course] = await Promise.all([fetch('course.json').then((r) => r.json()), loadImgs('core')]); }
  catch { app.innerHTML = '<main class="wrap"><p class="panel">Could not load the lessons. Check your connection and refresh.</p></main>'; return; }
  if ('serviceWorker' in navigator && !LOCAL) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (state.session) {
    await refreshMe();
    if (state.session && state.active && state.active !== 'guest') { await sync(); await pullPf(state.active); }
  }
  if (state.session && !child() && state.active !== 'guest' && state.children.length === 1) { state.active = state.children[0].id; S.set('active', state.active); }
  if (state.active === 'guest' || (state.active && child())) {
    go(needsOnboarding() ? 'onboard' : 'path', 0); freezeCheck();
    if (new URLSearchParams(location.search).get('go') === 'review' && state.view === 'path' && srsDue().learnt) startReview();
  }
  else if (state.session) go('profiles');
  else go('welcome');
}
window.__ks = { state, stats, sync, go, srs, srsDue, getPf, setPf, applyFreezes, buildReview, mergeEvents };      // handy for tests
boot();
})();
