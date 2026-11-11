// Holowise v5 — app shell: tabs, scan (auto-detect + auto-capture + batch), card sheet (price, history, deal check),
// collection (IndexedDB), watchlist (alerts within the JustTCG budget), settings and onboarding.
import * as C from './core.js?v=5';
import { readCardV2, readNameV2, makeTools } from './ocr.js?v=5';
import * as X from './ximilar.js?v=5';
import { ebaySoldUrl, auSoldPrice, auQuery } from './au.js?v=5';
import * as HI from './history.js?v=5';
import * as S from './signal.js?v=5';
import * as D from './detect.js?v=5';
import * as DB from './db.js?v=5';
import * as P from './portfolio.js?v=5';
import * as B from './budget.js?v=5';
import { dealVerdict, sessionTotals } from './deal.js?v=5';
import { toCSV, parseCSV } from './csv.js?v=5';

const VERSION = '5.0';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const aud = n => (n == null || isNaN(n)) ? '—' : 'A$' + (+n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, cur) => (cur === 'EUR' ? '€' : cur === 'USD' ? 'US$' : cur === 'AUD' ? 'A$' : '') + (+n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = d => { if (!d) return 'unknown date'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' }); };
const when = t => t ? new Date(t).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Australia/Brisbane' }) + ' AEST' : 'never';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
const pctTxt = x => x == null || isNaN(x) ? '' : (x >= 0 ? '+' : '') + x.toFixed(1) + '%';
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// ---------- state ----------
const loadJSON = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch { return { ...d }; } };
const state = {
  prefs: loadJSON('hw:prefs', { theme: 'system', haptics: true, auto: false, batch: false, deal: false }),
  mode: localStorage.getItem('cl:mode') || 'auto',
  calc: { ...C.DEFAULT_CALC, ...loadJSON('cl:calc', {}) },
  sig: { ...S.DEFAULT_SIGNAL, ...loadJSON('cl:sig', {}) },
  settings: loadJSON('cl:settings', { ximToken: '', ximSlab: true, ximPrices: true, auProxy: '', jtKey: '' }),
  stream: null, busy: false, autoPaused: false, current: null, priceIdx: 0, fx: null, hist: null, range: localStorage.getItem('cl:range') || '90', histSeries: 0,
  lastAn: null, asking: '', batch: [], view: 'scan'
};
const savePrefs = () => localStorage.setItem('hw:prefs', JSON.stringify(state.prefs));
let validTotals = null; C.validPokemonTotals().then(v => { validTotals = v; }).catch(() => {});
C.fxRates().then(fx => { state.fx = fx; }).catch(() => {});

// ---------- feedback ----------
function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms); }
function haptic(p = 12) { if (state.prefs.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch {} }
const status = t => { $('#status').textContent = t || ''; };

// ---------- theme ----------
function applyTheme() {
  let t = state.prefs.theme; if (t === 'system') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; $('#themeColor').setAttribute('content', t === 'light' ? '#f4f6fb' : '#0a0e1a');
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === state.prefs.theme));
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyTheme);

// ---------- router ----------
function showView(v, { push = true } = {}) {
  if (!['scan', 'collection', 'watch', 'settings'].includes(v)) v = 'scan';
  state.view = v;
  $$('.view').forEach(s => s.classList.toggle('active', s.id === 'v-' + v));
  $$('.tabbar button').forEach(b => { const on = b.dataset.view === v; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('#gameSeg').style.visibility = v === 'scan' ? 'visible' : 'hidden';
  if (push && location.hash !== '#' + v) history.replaceState(null, '', '#' + v);
  window.scrollTo({ top: 0 });
  if (v === 'collection') renderCollection();
  if (v === 'watch') renderWatch();
  if (v === 'settings') renderSettings();
}
$$('.tabbar button').forEach(b => b.onclick = () => { haptic(8); showView(b.dataset.view); });

// ---------- sheet + modal ----------
function openSheet() {
  const sh = $('#sheet'), sc = $('#scrim');
  if (!sh.hidden && sh.classList.contains('show')) return;
  sh.hidden = false; sc.hidden = false;
  requestAnimationFrame(() => { sh.classList.add('show'); sc.classList.add('show'); });
  document.body.style.overflow = 'hidden';
  history.pushState({ sheet: 1 }, '');
}
function closeSheet(fromPop = false) {
  const sh = $('#sheet'), sc = $('#scrim'); if (sh.hidden) return;
  sh.classList.remove('show'); sc.classList.remove('show'); document.body.style.overflow = '';
  setTimeout(() => { sh.hidden = true; sc.hidden = true; }, 320);
  if (!fromPop && history.state?.sheet) history.back();
}
$('#sheetClose').onclick = () => closeSheet(); $('#scrim').onclick = () => closeSheet();
addEventListener('popstate', () => { if (!$('#modal').hidden) closeModal(); else closeSheet(true); });
function openModal(html, bind) {
  const m = $('#modal'); $('#modalBox').innerHTML = html; m.hidden = false;
  m.onclick = e => { if (e.target === m) closeModal(); };
  bind?.($('#modalBox'));
}
function closeModal() { $('#modal').hidden = true; $('#modalBox').innerHTML = ''; }

// ---------- game mode ----------
function setMode(m) {
  state.mode = m; localStorage.setItem('cl:mode', m);
  $$('#gameSeg button').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#qNum').placeholder = m === 'onepiece' ? 'OP05-119 / ST01-001' : m === 'pokemon' ? '199/165 or 199' : '199/165 or OP05-119';
}
$$('#gameSeg button').forEach(b => b.onclick = () => { haptic(6); setMode(b.dataset.mode); });

// ---------- camera ----------
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { status('Camera not available here. Use Photo or Search.'); return; }
  if (!isSecureContext) { status('Camera needs HTTPS.'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
    state.stream = stream;
    const v = $('#video'); v.srcObject = stream; await v.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    try { const caps = track.getCapabilities?.() || {}; if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); } catch {}
    $('#camOff').hidden = true; $('#camOff').style.display = 'none'; $('#scanBtn').disabled = false;
    status(state.prefs.auto ? 'Show a card: it captures when steady' : 'Line the card up, then tap the shutter');
    loadOCR(0).catch(() => {}); setTimeout(() => loadOCR(1).catch(() => {}), 1500);
    detectLoop();
  } catch (e) { status('Camera blocked: ' + (e.message || e.name) + '. Use Photo or Search.'); }
}
$('#startCam').onclick = () => { haptic(); startCamera(); };

// ---------- OCR (two reused workers: number + name run in parallel) ----------
const workers = [null, null];
function loadOCR(i = 0) {
  if (workers[i]) return workers[i];
  workers[i] = (async () => {
    for (let k = 0; k < 80 && !window.Tesseract; k++) await new Promise(r => setTimeout(r, 100));
    if (!window.Tesseract) throw new Error('OCR library failed to load (check your connection).');
    const w = await Tesseract.createWorker('eng');
    await w.setParameters({ tessedit_pageseg_mode: '11' }); w._cur = { psm: '11', wl: '' };
    return w;
  })();
  workers[i].catch(() => { workers[i] = null; });
  return workers[i];
}
const recognizeWith = i => async (canvas, { psm = '11', whitelist = '' } = {}) => {
  let w; try { w = await loadOCR(i); } catch { w = await loadOCR(0); }
  if (w._cur.psm !== psm || w._cur.wl !== whitelist) { await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist }); w._cur = { psm, wl: whitelist }; }
  const { data } = await w.recognize(canvas); return data.text || '';
};
const recognize = recognizeWith(0), recognizeName = recognizeWith(1);

// Map the on-screen guide frame to video pixels (video uses object-fit: cover).
function coverMap() {
  const v = $('#video'), cam = $('#cam').getBoundingClientRect();
  const vw = v.videoWidth, vh = v.videoHeight, scale = Math.max(cam.width / vw, cam.height / vh);
  return { v, cam, vw, vh, scale, ox: (cam.width - vw * scale) / 2, oy: (cam.height - vh * scale) / 2 };
}
function frameRectInVideo() {
  const m = coverMap(), f = $('#frame').getBoundingClientRect();
  return { src: m.v, x: (f.left - m.cam.left - m.ox) / m.scale, y: (f.top - m.cam.top - m.oy) / m.scale, w: f.width / m.scale, h: f.height / m.scale };
}
function cardRectInImage(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const det = detectOn(img, W, H);
  if (det) return { src: img, ...det, detected: true };
  let w = W * 0.96, h = w * 88 / 63; if (h > H * 0.96) { h = H * 0.96; w = h * 63 / 88; }
  return { src: img, x: (W - w) / 2, y: (H - h) / 2, w, h };
}

// ---------- card-frame detection ----------
const TW = 180; let thumbC = null;
function grayThumb(src, W, H) {
  const th = Math.round(TW * H / W);
  if (!thumbC || thumbC.height !== th) thumbC = mkCanvas(TW, th);
  const g = thumbC.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0, TW, th);
  const d = g.getImageData(0, 0, TW, th).data, y = new Float32Array(TW * th);
  for (let i = 0, j = 0; j < y.length; i += 4, j++) y[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return { w: TW, h: th, y };
}
function detectOn(src, W, H) { // returns a source-pixel rect, slightly padded, or null
  const im = grayThumb(src, W, H), r = D.detectCard(im);
  if (!r.found) return null;
  const k = W / TW, pad = 0.012;
  return { x: Math.max(0, (r.x - r.w * pad) * k), y: Math.max(0, (r.y - r.h * pad) * k), w: r.w * (1 + 2 * pad) * k, h: r.h * (1 + 2 * pad) * k };
}
const tracker = D.makeSteadyTracker({ need: 4, maxDiff: 7, minIoU: 0.88 });
let lastDet = null, stillNoCard = 0, capturedBox = null, changeFrames = 0, loopOn = false, lastFallback = 0;
function detectLoop() {
  if (loopOn) return; loopOn = true;
  const tick = async () => {
    if (!state.stream) { loopOn = false; return; }
    const v = $('#video');
    if (!document.hidden && state.view === 'scan' && v.videoWidth) {
      const im = grayThumb(v, v.videoWidth, v.videoHeight), det = D.detectCard(im), st = tracker.push(im, det);
      lastDet = det.found ? det : null; drawOverlay(det, st);
      // after a capture, wait until the card is removed or swapped before auto-capturing again
      if (state.autoPaused && capturedBox) {
        const moved = !det.found || D.iou(det, capturedBox) < 0.6 || st.diff > 14;
        changeFrames = moved ? changeFrames + 1 : 0;
        if (changeFrames >= 3 && (state.prefs.batch || $('#sheet').hidden)) { state.autoPaused = false; capturedBox = null; status(state.prefs.batch ? 'Next card…' : 'Ready'); }
      }
      if (state.prefs.auto && !state.busy && !state.autoPaused) {
        if (st.state === 'steady') { capturedBox = det; captureDetected(det, im); }
        else if (st.state === 'still-nocard') { if (++stillNoCard > 16 && Date.now() - lastFallback > 2500) { lastFallback = Date.now(); fallbackQuick(); } }
        else { stillNoCard = 0; status(det.found ? 'Hold steady…' : 'Looking for a card…'); }
      }
    }
    setTimeout(tick, 110);
  };
  tick();
}
function drawOverlay(det, st) {
  const c = $('#ov'), r = c.getBoundingClientRect(), dpr = devicePixelRatio || 1;
  if (c.width !== Math.round(r.width * dpr)) { c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr); }
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  $('#frame').classList.toggle('found', !!det.found);
  if (!det.found) return;
  const m = coverMap(), k = m.vw / TW;
  const x = (det.x * k * m.scale + m.ox) * dpr, y = (det.y * k * m.scale + m.oy) * dpr, w = det.w * k * m.scale * dpr, h = det.h * k * m.scale * dpr;
  const steady = st.state === 'steady' || state.busy;
  g.lineWidth = 3 * dpr; g.strokeStyle = steady ? '#34d399' : 'rgba(255,255,255,.9)'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 6 * dpr;
  const L = Math.min(w, h) * 0.18;
  g.beginPath();
  [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([px, py, sx, sy]) => { g.moveTo(px + sx * L, py); g.lineTo(px, py); g.lineTo(px, py + sy * L); });
  g.stroke();
  if (steady) { g.fillStyle = 'rgba(52,211,153,.10)'; g.fillRect(x, y, w, h); }
}
function captureDetected(det) {
  const v = $('#video'), k = v.videoWidth / TW, pad = 0.012;
  const rect = { src: v, x: Math.max(0, (det.x - det.w * pad) * k), y: Math.max(0, (det.y - det.h * pad) * k), w: det.w * (1 + 2 * pad) * k, h: det.h * (1 + 2 * pad) * k, detected: true };
  state.autoPaused = true; haptic([10, 40, 10]);
  $('#frame').classList.add('hit'); setTimeout(() => $('#frame').classList.remove('hit'), 700);
  scanFrom(snapshot(rect), 'Card locked, reading…');
}
// Copy the frame region so OCR works on a still image while the video keeps moving.
function snapshot(r) {
  const c = mkCanvas(Math.round(r.w), Math.round(r.h)); c.getContext('2d').drawImage(r.src, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  return { src: c, x: 0, y: 0, w: c.width, h: c.height, detected: r.detected };
}
async function fallbackQuick() { // no card edges found (e.g. busy background): try a quick number read in the guide frame
  if (state.busy || state.settings.ximToken) return;
  state.busy = true;
  try {
    const r = snapshot(frameRectInVideo());
    const q = await readCardV2(r, { recognize, mkCanvas, mode: state.mode, quick: true, validTotals, firstScale: 2 });
    state.busy = false;
    if (q.best) { state.autoPaused = true; capturedBox = lastDet || { x: 0, y: 0, w: 1, h: 1 }; await scanFrom(r, 'Number spotted, reading…'); }
  } catch { } finally { state.busy = false; }
}
function setAuto(on) {
  state.prefs.auto = on; savePrefs();
  ['#autoBtn', '#chipAuto'].forEach(s => $(s).setAttribute('aria-pressed', on));
  state.autoPaused = false; capturedBox = null; tracker.reset();
  if (on && !state.stream) { status('Starting camera…'); startCamera(); }
  else status(on ? 'Auto-capture on: show a card' : 'Auto-capture off');
}
$('#autoBtn').onclick = $('#chipAuto').onclick = () => { haptic(8); setAuto(!state.prefs.auto); };
$('#chipBatch').onclick = () => { haptic(8); setBatch(!state.prefs.batch); };
$('#chipDeal').onclick = () => { haptic(8); state.prefs.deal = !state.prefs.deal; savePrefs(); $('#chipDeal').setAttribute('aria-pressed', state.prefs.deal); toast(state.prefs.deal ? 'Deal mode: enter the asking price on each card' : 'Deal mode off'); };

function glareRatio(r) {
  const T = makeTools(mkCanvas); const g = T.gray(T.crop(r, 0.86, 1, 0, 1, { scale: 1, maxW: 400 }));
  let n = 0; for (const v of g.y) if (v > 245) n++; return n / g.y.length;
}
async function validateParse(p, names) {
  const list = p.opCode ? await C.onePieceByCode(p.opCode) : await C.pokemonByNumber(p.pkNumber.number, p.pkNumber.total, names);
  return { list, strong: list.length > 0 && (names.length ? list.some(x => C.nameMatches(x.name, names)) : !p.guessed) };
}

async function scanFrom(rect, label = 'Reading card…') {
  if (state.busy) return; state.busy = true;
  $('#frame').classList.add('busy'); $('#scanBtn').disabled = true;
  const log = [], t0 = performance.now();
  try {
    if (state.settings.ximToken) {
      status('Identifying with Ximilar…');
      try {
        const json = await X.ximilarIdentify(X.cardJpegBase64(rect, { mkCanvas }), state.settings.ximToken, { slab: state.settings.ximSlab, priceStats: state.settings.ximPrices });
        const parsed = X.parseXimilar(json);
        log.push('[ximilar] ' + (parsed.card?.best?.full_name || parsed.error || 'no card found') + (parsed.slab ? ` · slab ${parsed.slab.company} ${parsed.slab.grade}` : ''));
        const list = await X.ximilarToCandidates(parsed);
        if (list.length) { $('#ocrText').textContent = log.join('\n'); status(`Ximilar: ${parsed.card.best.full_name}`); deliver(list, 'ximilar', true, true); return; }
        status('Ximilar found no card. Using on-device OCR…');
      } catch (e) { log.push('[ximilar] ' + e.message); status((e.status === 401 ? 'Ximilar token not accepted. ' : 'Ximilar unavailable. ') + 'Using on-device OCR…'); }
    }
    const glare = glareRatio(rect);
    if (glare > 0.04) log.push(`[glare] ${(glare * 100).toFixed(0)}% of the number area is blown out`);
    status('Loading OCR (first time only)…'); await loadOCR(0); status(label);
    const isOPmode = state.mode === 'onepiece';
    const nmP = readNameV2(rect, { recognize: recognizeName, mkCanvas, isOP: isOPmode }); // in parallel on worker 2
    const res = await readCardV2(rect, { recognize, mkCanvas, mode: state.mode, onStep: status, validTotals, firstScale: 2,
      validate: async p => validateParse(p, (p.opCode && !isOPmode) ? [] : (await nmP).names) });
    let nm = await nmP;
    const isOP = !!res.best?.opCode || isOPmode;
    if (isOP && !isOPmode) nm = await readNameV2(rect, { recognize: recognizeName, mkCanvas, isOP: true });
    log.push(res.text, `[name] ${nm.text.replace(/\s+/g, ' ').trim()}`, `best: ${res.best ? (res.best.opCode || res.best.pkNumber.raw) + (res.strong ? ' (name agrees)' : ' (unconfirmed)') : 'none'} · ${res.calls} OCR passes · ${((performance.now() - t0) / 1000).toFixed(1)}s${rect.detected ? ' · auto-cropped to card edges' : ''}`);
    $('#ocrText').textContent = log.join('\n');
    await identify(res, nm.names, isOP, glare);
  } catch (e) { status('Scan failed: ' + e.message); console.error(e); }
  finally { state.busy = false; $('#frame').classList.remove('busy'); $('#scanBtn').disabled = !state.stream; }
}
$('#scanBtn').onclick = () => { if (!state.stream) return; haptic(15); state.autoPaused = true; capturedBox = lastDet; const det = lastDet; if (det) captureDetected(det); else scanFrom(snapshot(frameRectInVideo())); };
$('#photoIn').onchange = async e => {
  const f = e.target.files?.[0]; if (!f) return;
  const img = new Image(); img.src = URL.createObjectURL(f); await img.decode().catch(() => {});
  await scanFrom(cardRectInImage(img), 'Reading photo…'); URL.revokeObjectURL(img.src); e.target.value = '';
};

async function identify(res, names, isOP, glare = 0) {
  let list = [], how = '';
  const best = res.best;
  if (best) {
    const key = best.opCode || `${best.pkNumber.number}/${best.pkNumber.total}`;
    $('#qNum').value = key; $('#qName').value = names[0] || '';
    if (res.strong) { list = best.list; how = `${best.opCode ? 'code' : 'number'} ${key}`; }
    else { const seen = new Set(); list = res.tried.flatMap(t => t.list || []).filter(c => !seen.has(c.id) && seen.add(c.id)); how = `${best.opCode ? 'code' : 'number'} ${key} (name not confirmed)`; }
  }
  if (!list.length && names.length) {
    status('No number read. Searching by name…');
    let used = names[0];
    if (isOP || state.mode === 'onepiece') { for (const n of names.slice(0, 3)) { list = await C.onePieceSearch(n); if (list.length) { used = n; break; } } }
    else list = await C.pokemonFuzzySearch(names);
    if (list.length && !isOP && state.mode !== 'onepiece') used = list[0].name;
    $('#qName').value = used; how = `name "${used}" (check set and variant)`;
  }
  const glareMsg = glare > 0.04 ? ' Glare on the number: tilt the card.' : '';
  if (!list.length) { status('No match.' + glareMsg + ' Try closer and flatter, or Search.'); haptic([30, 60, 30]); showCands([], ''); state.autoPaused = true; return; }
  const byNumber = !how.startsWith('name');
  status(`${list.length} match${list.length > 1 ? 'es' : ''} by ${how}.${glareMsg}`);
  deliver(list, how, byNumber, res.strong);
}
// Route an identification: batch mode adds it to the session; otherwise show candidates and open the card sheet.
function deliver(list, how, byNumber, strong) {
  haptic([12, 50, 12]);
  if (state.prefs.batch) { showCands(list, how, true); addToBatch(list[0], { check: !strong, how }); return; }
  showCands(list, how, byNumber);
  if (list.length === 1 || (byNumber && list.length <= 12)) select(list[0]);
}

function showCands(list, how, preselect = false) {
  $('#candPanel').hidden = !list.length;
  $('#candTitle').textContent = list.length === 1 ? 'Match' : `Is it one of these? (${list.length})`;
  const box = $('#cands'); box.innerHTML = '';
  list.slice(0, 30).forEach(c => {
    const b = document.createElement('button'); b.className = 'cand'; b.type = 'button';
    b.innerHTML = `<img loading="lazy" alt="" src="${esc(c.thumb || '')}"><div class="n">${esc(c.name)}</div><div class="m">${esc(c.setName || c.id)} · ${esc(c.number || '')}${c.rarity ? ' · ' + esc(c.rarity) : ''}</div>`;
    b.onclick = () => { haptic(6); box.querySelectorAll('.cand').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); if (state.prefs.batch) replaceLastBatch(c); else select(c); };
    box.appendChild(b);
  });
  if (preselect) box.querySelector('.cand')?.classList.add('sel');
}

// ---------- card sheet ----------
const skeleton = () => `<div class="skel-head"><div class="skel skel-img"></div><div><div class="skel skel-line" style="width:80%"></div><div class="skel skel-line" style="width:55%"></div><div class="skel skel-big"></div><div class="skel skel-line" style="width:40%"></div></div></div><div class="skel skel-block"></div><div class="skel skel-block" style="height:90px"></div>`;
function pickPriceIdx(prices, label) {
  if (!prices?.length) return 0;
  const i = label ? prices.findIndex(p => p.label === label) : -1; if (i >= 0) return i;
  const j = prices.findIndex(p => !p.au && /^TCGplayer market|^Market price/.test(p.label)); return j >= 0 ? j : 0;
}
async function getFull(card) {
  const [full0, fx] = await Promise.all([card.game === 'pokemon' ? C.pokemonDetails(card) : card, state.fx ? state.fx : C.fxRates().catch(() => null)]);
  if (fx) state.fx = fx;
  return { ...full0, ximilar: card.ximilar, ximStats: card.ximStats, slab: card.slab, prices: [...(full0.prices || [])] };
}
async function select(card, { label = null } = {}) {
  const det = $('#detail'); det.innerHTML = skeleton(); openSheet();
  if (!state.current || state.current.id !== card.id) state.asking = ''; // asking price belongs to one card
  try {
    const full = await getFull(card);
    if (card.prices?.some(p => p.source === 'ximilar') && !full.prices.some(p => p.source === 'ximilar')) full.prices.push(...card.prices.filter(p => p.source === 'ximilar'));
    full.auNote = '';
    if (state.settings.auProxy && full.game === 'pokemon') {
      try { const au = await auSoldPrice(state.settings.auProxy, full, { graded: !!full.slab }); if (au) full.prices.unshift(au); else full.auNote = 'No recent AU sales found for this card.'; }
      catch (e) { full.auNote = 'AU sold prices unavailable: ' + e.message; }
    }
    state.current = full; state.priceIdx = pickPriceIdx(full.prices, label); state.lastAn = null;
    renderDetail();
    try { HI.logToday(full, full.prices); } catch {}
    loadHistory(full);
    if (state.prefs.deal) setTimeout(() => { const a = $('#dealAsk'); a?.scrollIntoView({ block: 'center', behavior: 'smooth' }); a?.focus({ preventScroll: true }); }, 380);
  } catch (e) { det.innerHTML = `<p class="warn">Couldn't load this card: ${esc(e.message)}. The free API may be busy, so try again in a moment.</p>`; }
}
function currentAud() {
  const c = state.current, p = c?.prices[state.priceIdx];
  return p ? (p.au ? p.value : C.toAUD(p.value, p.currency, state.fx)) : null;
}
function renderDetail() {
  const c = state.current, fx = state.fx, det = $('#detail');
  const p = c.prices[state.priceIdx];
  const audVal = currentAud();
  const k = audVal != null ? C.calc(audVal, state.calc) : null;
  const isAU = !!p?.au, slab = c.slab;
  det.innerHTML = `
    <div class="det-head">
      <img src="${esc(c.image || c.thumb || '')}" alt="${esc(c.name)}">
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="meta">${esc(c.setName || '')} · #${esc(c.number || '')}${c.setTotal ? '/' + c.setTotal : ''}${c.rarity ? ' · ' + esc(c.rarity) : ''}</div>
        <div class="meta">${c.game === 'onepiece' ? 'One Piece TCG' : 'Pokémon TCG'} · data: ${esc(c.source)}</div>
        ${p ? (isAU ? `
          <div class="price-big">${aud(p.value)}</div>
          <div><span class="chip au">AU sales</span> <span class="meta">eBay Australia sold</span></div>
          <div class="src">${esc(p.label)} · range ${aud(p.low)}–${aud(p.high)} · checked ${day(p.updated)} · <a href="${esc(p.attribution)}" target="_blank" rel="noopener">Prices from TCG Prices AU</a></div>` : `
          <div class="price-big">${fmt(p.value, p.currency)} <small>${esc(p.currency)}</small></div>
          <div><span class="aud">${aud(audVal)}</span><span class="est">AUD estimate</span> <span class="chip conv">Converted, not AU sales</span></div>
          <div class="src">${esc(p.label)} · updated ${day(p.updated)}${fx ? ` · FX 1 ${esc(p.currency)} = ${fx[p.currency]?.toFixed(4)} AUD (${esc(fx.source)}, ${day(fx.date)})` : ' · FX unavailable'}</div>`)
        : `<p class="warn">No price data from the free sources for this card. I won't guess. Check the sold listings below.</p>`}
        ${c.auNote ? `<div class="src">${esc(c.auNote)}</div>` : ''}
      </div>
    </div>
    <div class="actions"><button class="btn primary" id="addColl">＋ Collection</button><button class="btn" id="addWatch">♡ Watch</button></div>
    ${slab ? `<div class="slab"><b>Graded slab detected:</b> ${esc(slab.company)} ${esc(slab.grade)}${slab.verbal ? ' (' + esc(slab.verbal) + ')' : ''}${slab.cert ? ` · cert ${slab.certLink ? `<a href="${esc(slab.certLink)}" target="_blank" rel="noopener">${esc(slab.cert)}</a>` : esc(slab.cert)}` : ''}<br><span class="meta">Raw-card prices below don't apply to a graded copy.</span></div>` : ''}
    ${c.ximilar ? `<div class="src">Identified by Ximilar: ${esc(c.ximilar.fullName || '')}${c.ximilar.foil ? ' · ' + esc(c.ximilar.foil) : ''}</div>` : ''}
    ${c.ximStats?.length ? `<div class="xstats"><div class="meta">Ximilar sold stats (currency not stated; indicative):</div>${c.ximStats.map(x => `<div>${esc(x.type)}: median ${x.median ?? '—'} · ${x.volume ?? 0} sales · last ${esc(x.latestDate || '—')}</div>`).join('')}</div>` : ''}
    ${c.prices.length > 1 ? `<label class="meta" style="display:block;margin-top:12px">Price source / variant
      <select id="priceSel" style="width:100%">${c.prices.map((x, i) => `<option value="${i}" ${i === state.priceIdx ? 'selected' : ''}>${x.au ? '[AU sales] ' : '[converted] '}${esc(x.label)}: ${x.au ? aud(x.value) : fmt(x.value, x.currency)}</option>`).join('')}</select></label>` : ''}
    ${k ? `
    <section class="deal" id="dealBox">
      <div class="row-between"><b>Deal check</b><span class="chip conv">Estimate</span></div>
      <div class="row" style="margin-top:8px"><input id="dealAsk" type="number" inputmode="decimal" min="0" step="0.5" placeholder="Asking price A$" value="${esc(state.asking)}" aria-label="Asking price in AUD"><button class="btn small ghost" id="dealClear" type="button">Clear</button></div>
      <div id="dealOut"></div>
    </section>
    <div class="out">
      <div class="sell"><div class="k">Sell for (net after fees)</div><div class="v" id="oSell">${aud(k.sellNet)}</div></div>
      <div class="buy"><div class="k">Max buy</div><div class="v" id="oBuy">${aud(k.buyMax)}</div></div>
    </div>
    <p class="note" id="oNote">${calcNote(k)} <a href="#settings" id="calcLink">Change fees/margin</a></p>` : ''}
    <section id="histBox" class="histbox"></section>
    <p class="warn">Prices are for the variant and condition shown (usually near-mint, raw, English). Graded slabs, Japanese prints and damaged cards can be worth far more or less. Not financial advice.</p>
    <div class="links">
      <a class="btn ghost small" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c))}">eBay AU sold · raw ↗</a>
      <a class="btn ghost small" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c, { graded: true, grade: slab ? `${slab.company} ${slab.grade}`.trim() : '' }))}">eBay AU sold · ${slab ? esc(`${slab.company} ${slab.grade}`) : 'graded'} ↗</a>
    </div>`;
  $('#priceSel')?.addEventListener('change', e => { state.priceIdx = +e.target.value; renderDetail(); });
  $('#addColl').onclick = () => { haptic(); collectionModal(null, c); };
  $('#addWatch').onclick = () => { haptic(); watchModal(c); };
  $('#calcLink')?.addEventListener('click', e => { e.preventDefault(); closeSheet(); showView('settings'); });
  $('#dealAsk')?.addEventListener('input', e => { state.asking = e.target.value; renderDeal(); });
  $('#dealClear')?.addEventListener('click', () => { state.asking = ''; $('#dealAsk').value = ''; renderDeal(); });
  renderDeal(); renderHistory();
}
function renderDeal() {
  const out = $('#dealOut'); if (!out) return;
  const m = currentAud(), a = parseFloat(state.asking);
  if (!(a > 0)) { out.innerHTML = '<p class="meta">Enter the asking price for an instant verdict against your fee-aware sell price and max buy.</p>'; return; }
  const v = dealVerdict(m, a, state.calc); if (!v) { out.innerHTML = '<p class="meta">No market price to compare with.</p>'; return; }
  const an = state.lastAn;
  const trend = an?.ok ? `<div class="meta">Trend signal: <b>${an.signal}</b> (${an.confidence} confidence, ${S.fmtPct(an.proj.midPct)} over ${an.proj.days} days, estimate)</div>`
    : `<div class="meta">Trend signal: ${an ? 'not enough history' : 'loading or unavailable'}.</div>`;
  out.innerHTML = `<div class="verdict ${v.tone}"><div class="vl">${v.label}</div><div>${esc(v.why)}</div>
    <div class="meta">Asking ${aud(a)} is ${pctTxt(v.vsMarketPct)} vs market ${aud(m)} · net after fees ${aud(v.sellNet)} · max buy ${aud(v.buyMax)}</div>${trend}
    <div class="meta">Estimate from the price shown above and your calculator settings. Not financial advice.</div></div>`;
  if (out.dataset.last !== v.band) { haptic(v.tone === 'good' ? [10, 30, 10] : 10); out.dataset.last = v.band; }
}
function calcNote(k) {
  return `Market ${aud(k.marketAUD)} minus ${state.calc.feePct}% fees${state.calc.fixedCost ? ` and A$${(+state.calc.fixedCost).toFixed(2)} postage` : ''} = ${aud(k.sellNet)} net. Buying at ${aud(k.buyMax)} leaves about ${aud(k.profitAtBuy)} (${state.calc.marginPct}%).`;
}
// ---------- price history + keep/sell ----------
const COLORS = { main: '#a78bfa', extra: '#8a93b8', auRaw: '#3ad29f', auGraded: '#ffb84d', auMedian: '#3ad29f' };
async function loadHistory(card) {
  const h = state.hist = { id: card.id, loading: true, series: [], graded: [], momentum: null, snapshot: [], au: null, notes: [] };
  state.histSeries = 0; renderHistory();
  const st = state.settings, jobs = [];
  if (card.game === 'onepiece') jobs.push(HI.opTwoWeeks(card).then(s => { if (s) h.series.push(s); else h.notes.push('OPTCG API has no two-week history for this variant.'); }).catch(e => h.notes.push('OPTCG history unavailable: ' + e.message)));
  if (card.game === 'pokemon') {
    h.momentum = S.windowsMomentum(card.pricing?.cardmarket); if (h.momentum) h.momentum.updated = card.pricing.cardmarket.updated;
    h.snapshot = HI.tcgplayerSnapshot(card.pricing);
  }
  if (st.jtKey) jobs.push(HI.justTcgHistory(card, st.jtKey, { onMeta: m => { B.record(m); renderMeters(); } }).then(list => { if (list.length) h.series.unshift(...list); else h.notes.push('JustTCG has no exact match for this card or variant, so no JustTCG history is shown (never a near match).'); }).catch(e => h.notes.push('JustTCG unavailable: ' + (e.status === 401 || e.status === 403 ? 'key rejected' : e.message))));
  if (st.auProxy && card.game === 'pokemon') {
    h.au = { sales: null, hist: null };
    jobs.push(HI.auSales(st.auProxy, auQuery(card)).then(r => { h.au.sales = r; }).catch(e => h.notes.push('AU sales unavailable: ' + e.message)));
    jobs.push(HI.auHistory(st.auProxy, { q: `${String(card.name).replace(/\(.*?\)/g, '')} ${card.setName || ''}`.trim(), number: card.number }).then(r => {
      h.au.hist = r;
      if (r.median.length) h.series.push({ key: 'au-median', name: 'AU eBay sold median (TCG Prices AU)', kind: 'raw', currency: 'AUD', au: true, source: 'TCG Prices AU', link: 'https://tcgprices.com.au/', points: r.median });
    }).catch(e => h.notes.push('AU history unavailable: ' + e.message)));
  }
  await Promise.allSettled(jobs);
  if (state.hist !== h) return; // a different card was opened meanwhile
  for (const s of HI.localSeries(card)) {
    if (s.points.length >= 2) h.series.push(s);
    else if (!h.localNoted) { h.localNoted = true; h.notes.push(`Saved on this phone: ${s.points.length} day so far for this card. A real day-by-day history builds up each day you open it.`); }
  }
  h.series.sort((a, b) => (b.points.length - a.points.length) || (a.key.startsWith('local') ? 1 : -1));
  h.loading = false; renderHistory();
}

function renderHistory() {
  const box = $('#histBox'), h = state.hist, c = state.current;
  if (!box || !h || !c || h.id !== c.id) return;
  if (h.loading) { box.innerHTML = '<h4>Price history &amp; keep-or-sell</h4><p class="meta">Loading price history…</p>'; return; }
  const fx = state.fx, sig = state.sig;
  const toA = (v, cur) => cur === 'AUD' ? v : (fx ? C.toAUD(v, cur, fx) : null);
  const money = (v, cur) => cur === 'AUD' ? aud(v) : `${fmt(v, cur)}${toA(v, cur) != null ? ` <span class="meta">(≈${aud(toA(v, cur))})</span>` : ''}`;
  const main = h.series[state.histSeries] || h.series[0];
  const an = main ? S.analyze(main.points, sig) : null;
  if (state.lastAn !== an) { state.lastAn = an; setTimeout(renderDeal, 0); }
  const span = main ? S.summarize(main.points).spanDays || 0 : 0;
  const ranges = [['30', 'Last 30 days', 0], ['90', 'Last 90 days', 30], ['365', 'Last year', 90], ['all', 'All', 0]];
  const rangeOK = k => { const r = ranges.find(x => x[0] === k); return r && span >= r[2]; };
  const rk = rangeOK(state.range) ? state.range : 'all';
  const days = rk === 'all' ? null : +rk;
  let html = '<h4>Price history &amp; keep-or-sell</h4>';
  if (main) {
    const lines = [{ name: main.name, color: COLORS.main, points: S.cleanSeries(main.points) }];
    if (main.extra?.points?.length) lines.push({ name: main.extra.name, color: COLORS.extra, dashed: true, points: S.cleanSeries(main.extra.points) });
    const sameCur = main.currency === 'AUD';
    if (sameCur && h.au?.sales?.raw?.length) lines.push({ name: 'AU raw sales', color: COLORS.auRaw, dots: true, points: h.au.sales.raw });
    const lastT = lines[0].points.at(-1)?.t;
    const band = an?.ok ? { t0: lastT, t1: lastT + an.proj.days * 864e5, p0: an.last.p, low: an.proj.low, mid: an.proj.mid, high: an.proj.high } : null;
    html += `${h.series.length > 1 ? `<label class="meta">Series <select id="hSer">${h.series.map((s, i) => `<option value="${i}" ${s === main ? 'selected' : ''}>${esc(s.name)} · ${s.points.length} pts</option>`).join('')}</select></label>` : ''}
      <div class="tabs" role="tablist">${ranges.map(([k, label, need]) => `<button type="button" data-r="${k}" class="${rk === k ? 'on' : ''}" ${span < need ? 'disabled title="Not enough history yet"' : ''} aria-label="${label}">${k === 'all' ? 'All' : k === '365' ? '1y' : k + 'd'}</button>`).join('')}</div>
      ${S.chartSVG(lines, { days, band, cur: main.currency === 'AUD' ? 'A$' : main.currency === 'EUR' ? '€' : '$' })}
      <div class="legend">${lines.map(l => `<span><i style="background:${l.color}"></i>${esc(l.name)}</span>`).join('')}${band ? '<span><i class="bandkey"></i>Projection range (estimate)</span>' : ''}</div>
      <div class="src">Source: ${main.link ? `<a href="${esc(main.link)}" target="_blank" rel="noopener">${esc(main.source)}</a>` : esc(main.source)} · ${esc(main.currency)} · ${an.n} points, ${esc(day(an.first.t))} to ${esc(day(an.last.t))}${main.asOf ? ` · last update ${esc(day(main.asOf))}` : ''}${main.stale ? ` · <b>stale: ${main.ageDays} days old</b>` : ''}${main.note ? ` · ${esc(main.note)}` : ''}${main.match ? ` · matched ${esc(main.match)}` : ''}${main.au ? ' · <a href="https://tcgprices.com.au/" target="_blank" rel="noopener">Prices from TCG Prices AU</a>' : ''}</div>
      <div class="meta">Change over this history: ${an.changePct != null ? S.fmtPct(an.changePct) : '—'} · low ${money(an.min, main.currency)} · high ${money(an.max, main.currency)}</div>`;
    if (an.ok) {
      const cls = an.signal.toLowerCase();
      html += `<div class="signal ${cls}"><div><span class="sig">${an.signal}</span> <span class="chip conv">Estimate, not financial advice</span> <span class="meta">confidence: ${an.confidence}</span></div>
        <div>${esc(an.why)}</div>
        <div class="proj">${an.proj.days}-day projection: ${money(an.proj.mid, main.currency)} (${S.fmtPct(an.proj.midPct)}), likely range ${money(an.proj.low, main.currency)} to ${money(an.proj.high, main.currency)} (~${an.proj.bandPct}% band)</div>
        <details><summary>How this is worked out</summary><p class="meta">Straight-line fit to the log of ${an.window.n} prices over the last ${Math.round(an.window.spanDays)} days: trend ${S.fmtPct(an.trendPctPer30d)} per 30 days (fit R² ${an.r2.toFixed(2)}). Daily volatility ${an.sigmaDailyPct.toFixed(1)}%. The range is last price × e^(trend × days ± ${sig.z} × volatility × √days). Hold or Sell only shows when the projected move beats both your ±${sig.thresholdPct}% threshold and normal noise; otherwise Watch. History can't see reprints, bans, hype or grading news, so confidence is never higher than Medium.</p></details></div>`;
    } else html += `<div class="signal none"><span class="sig">No signal</span> <span class="chip conv">Estimate, not financial advice</span><div>${esc(an.reason)}</div></div>`;
  } else {
    html += `<div class="signal none"><span class="sig">No signal</span><div>No dated price history for this card from the free sources yet${c.game === 'pokemon' ? '. TCGdex only gives Cardmarket rolling averages (below), not a dated series' : ''}. Each time you open this card, today\'s prices are saved on this phone, so a real history builds up. A JustTCG key in Settings adds up to a year of daily prices.</div></div>`;
  }
  if (h.momentum && h.momentum.n >= 2) {
    const m = h.momentum, f2 = v => v ? fmt(v, 'EUR') : '—';
    html += `<div class="mom"><div class="meta"><b>Cardmarket momentum</b> (rolling averages, EUR${m.holo ? ', holo' : ''}, updated ${esc(day(m.updated))}). Momentum only, not a dated history, so no Hold or Sell signal.</div>
      <table><tr><th>1-day avg</th><th>7-day avg</th><th>30-day avg</th><th>Trend</th></tr><tr><td>${f2(m.avg1)}</td><td>${f2(m.avg7)}</td><td>${f2(m.avg30)}</td><td>${f2(m.trend)}</td></tr></table>
      <div class="meta">${esc(m.text)} Short-term direction: <b>${m.dir}</b>.</div></div>`;
  }
  if (h.snapshot.length) html += `<div class="mom"><div class="meta"><b>TCGplayer today</b> (USD, updated ${esc(day(h.snapshot[0].updated))})</div><table><tr><th>Variant</th><th>Low</th><th>Mid</th><th>Market</th><th>High</th></tr>${h.snapshot.map(s => `<tr><td>${esc(s.variant)}</td><td>${s.low ? fmt(s.low, 'USD') : '—'}</td><td>${s.mid ? fmt(s.mid, 'USD') : '—'}</td><td>${s.market ? fmt(s.market, 'USD') : '—'}</td><td>${s.high ? fmt(s.high, 'USD') : '—'}</td></tr>`).join('')}</table></div>`;
  // recent individual sales, raw vs graded
  const sales = h.au?.sales, hs = h.au?.hist;
  const raw = (sales?.raw?.length ? sales.raw : hs?.soldRaw || []).slice(0, 8), gr = (sales?.graded?.length ? sales.graded : hs?.soldGraded || []).slice(0, 8);
  const row = x => `<li><span>${esc(day(x.t))}</span><b>${aud(x.p)}</b><span class="t">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>` : esc(x.title)}</span></li>`;
  if (h.au) {
    html += `<div class="sales"><div class="cols"><div><div class="meta"><b>Recent AU sales · raw</b></div><ul>${raw.length ? raw.map(row).join('') : '<li class="meta">None found</li>'}</ul></div>
      <div><div class="meta"><b>Recent AU sales · graded</b></div><ul>${gr.length ? gr.map(row).join('') : '<li class="meta">None found</li>'}</ul></div></div>
      <div class="src">eBay Australia sold listings. Raw vs graded uses the listing's graded flag, or the title (PSA/BGS/CGC…) when there is no flag. <a href="https://tcgprices.com.au/" target="_blank" rel="noopener">Prices from TCG Prices AU</a>. Not saved on this device.</div></div>`;
  } else {
    html += `<p class="meta">Recent individual sales (raw vs graded) need sold-listing data. The free sources only publish market averages. Use the eBay AU sold links below, or add the TCG Prices AU proxy in Settings${c.game === 'onepiece' ? ' (Pokémon only)' : ''}.</p>`;
  }
  if (h.notes.length) html += `<div class="src">${h.notes.map(esc).join(' · ')}</div>`;
  html += `<details class="assume"><summary>Signal assumptions (you can change these)</summary><div class="calc">
      <label>Projection days<input id="gH" type="number" min="7" max="180" step="1" value="${sig.horizonDays}"></label>
      <label>Hold/Sell threshold %<input id="gT" type="number" min="1" max="100" step="1" value="${sig.thresholdPct}"></label>
      <label>Look-back days<input id="gL" type="number" min="14" max="365" step="1" value="${sig.lookbackDays}"></label>
      <label>Min. data points<input id="gN" type="number" min="5" max="200" step="1" value="${sig.minPoints}"></label>
      <label>Min. history days<input id="gS" type="number" min="7" max="365" step="1" value="${sig.minSpanDays}"></label>
      <label>Band width (z)<input id="gZ" type="number" min="0.5" max="3" step="0.01" value="${sig.z}"></label>
    </div><button type="button" class="btn ghost small-btn" id="gReset">Reset defaults</button></details>
    <p class="warn">Keep-or-sell is a statistical estimate from past prices only. It is not a prediction you can rely on and not financial advice. Prices can move suddenly on reprints, bans, tournament results or hype.</p>`;
  box.innerHTML = html;
  $('#hSer')?.addEventListener('change', e => { state.histSeries = +e.target.value; renderHistory(); });
  box.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { state.range = b.dataset.r; localStorage.setItem('cl:range', state.range); renderHistory(); });
  [['#gH', 'horizonDays'], ['#gT', 'thresholdPct'], ['#gL', 'lookbackDays'], ['#gN', 'minPoints'], ['#gS', 'minSpanDays'], ['#gZ', 'z']].forEach(([id, k]) => $(id)?.addEventListener('change', e => {
    const v = +e.target.value; if (!isFinite(v) || v <= 0) return;
    state.sig = { ...state.sig, [k]: v }; localStorage.setItem('cl:sig', JSON.stringify(state.sig)); renderHistory(); $('#histBox .assume')?.setAttribute('open', '');
  }));
  $('#gReset')?.addEventListener('click', () => { state.sig = { ...S.DEFAULT_SIGNAL }; localStorage.removeItem('cl:sig'); renderHistory(); });
}


// ---------- manual search ----------
$('#searchForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#qName').value.trim(), num = $('#qNum').value.trim();
  if (!name && !num) return;
  status('Searching…'); $('#candPanel').hidden = true; haptic(8);
  try {
    const op = C.parseOnePieceCode(num) || (state.mode !== 'pokemon' ? C.parseOnePieceCode(name) : null);
    const pk = C.parsePokemonNumber(num);
    let list = [];
    if (op && state.mode !== 'pokemon') list = await C.onePieceByCode(op);
    else if (state.mode === 'onepiece') list = await C.onePieceSearch(name || num);
    else if (pk) list = await C.pokemonByNumber(pk.number, pk.total, name ? name.split(/\s+/) : []);
    if (!list.length && state.mode !== 'onepiece') {
      const bare = (num.match(/^[A-Za-z]*\d+/) || [''])[0];
      list = await C.pokemonSearch(name, pk ? pk.number : bare);
      if (!list.length && pk) list = await C.pokemonSearch(name, pk.number.padStart(3, '0'));
    }
    if (!list.length && state.mode === 'auto' && name) list = await C.onePieceSearch(name);
    status(list.length ? `${list.length} result${list.length > 1 ? 's' : ''}` : 'No results. Check spelling, or try just the name.');
    if (state.prefs.batch && list.length) { showCands(list, 'search', true); addToBatch(list[0], { check: list.length > 1, how: 'search' }); return; }
    showCands(list, 'search');
    if (list.length === 1) select(list[0]); else if (list.length) $('#candPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { status('Search failed: ' + err.message); }
};

// ---------- batch / bulk scan ----------
const cardRef = c => ({ game: c.game, id: c.id, code: c.code || null, name: c.name, setName: c.setName || '', number: c.number || '', setTotal: c.setTotal || null, rarity: c.rarity || '', thumb: c.thumb || c.image || '', image: c.image || '', source: c.source || '' });
async function priceFor(card, label = null) {
  const full = await getFull(card);
  const prices = full.prices.filter(p => !p.au && p.source !== 'ximilar');
  const p = prices[pickPriceIdx(prices, label)] || null;
  return { full, p, aud: p ? C.toAUD(p.value, p.currency, state.fx) : null };
}
function setBatch(on) {
  state.prefs.batch = on; savePrefs(); $('#chipBatch').setAttribute('aria-pressed', on); $('#batchPanel').hidden = !on;
  if (on) { toast('Batch mode: scanned cards add to the session list'); if (!state.prefs.auto && state.stream) setAuto(true); }
  renderBatch();
}
async function addToBatch(card, { check = false, how = '' } = {}) {
  const uid = Date.now() + Math.random().toString(36).slice(2, 6);
  const item = { uid, ref: cardRef(card), aud: null, label: '', value: null, currency: '', check, how, qty: 1, loading: true };
  state.batch.unshift(item); renderBatch();
  try { const { p, aud: a, full } = await priceFor(card); Object.assign(item, { ref: cardRef(full), aud: a, label: p?.label || '', value: p?.value ?? null, currency: p?.currency || '' }); }
  catch { item.err = true; }
  item.loading = false; renderBatch(); saveBatch();
  toast(`${check ? 'Check: ' : 'Added '}${card.name}${item.aud ? ' · ' + aud(item.aud) : ''}`);
  status(state.prefs.auto ? 'Added. Show the next card…' : 'Added to batch');
}
async function replaceLastBatch(card) { // user corrected the top match from the candidate grid
  const last = state.batch[0]; if (!last) return addToBatch(card);
  state.batch.shift(); await addToBatch(card, { check: false, how: 'picked' });
}
function saveBatch() { DB.put('sessions', { id: 'current', items: state.batch.map(({ loading, ...x }) => x), at: Date.now() }).catch(() => {}); }
function renderBatch() {
  const ul = $('#batchList'); if (!ul) return;
  const t = sessionTotals(state.batch, state.calc);
  $('#bMarket').textContent = aud(t.market); $('#bOffer').textContent = aud(t.offer);
  $('#batchCount').textContent = `${t.count} card${t.count === 1 ? '' : 's'}${t.unpriced ? ` · ${t.unpriced} unpriced` : ''}`;
  ul.innerHTML = state.batch.length ? '' : '<li class="empty">Scan cards one after another. Each is identified, priced and added here.</li>';
  state.batch.forEach((it, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<img alt="" src="${esc(it.ref.thumb)}"><div><div class="t">${esc(it.ref.name)} ${it.check ? '<span class="tag chk">CHECK</span>' : ''}</div><div class="s">${esc(it.ref.setName)} · ${esc(it.ref.number)}${it.qty > 1 ? ` · ×${it.qty}` : ''}</div></div>
      <div class="r">${it.loading ? '<span class="skel" style="display:inline-block;width:60px;height:14px"></span>' : aud(it.aud)}<div class="s">offer ${it.aud ? aud(C.calc(it.aud, state.calc).buyMax) : '—'}</div></div>`;
    li.onclick = () => batchItemModal(i);
    ul.appendChild(li);
  });
}
function batchItemModal(i) {
  const it = state.batch[i]; if (!it) return;
  openModal(`<h3>${esc(it.ref.name)}</h3><p class="meta">${esc(it.ref.setName)} · ${esc(it.ref.number)} · ${it.aud ? aud(it.aud) + ' (' + esc(it.label) + ')' : 'no price'}${it.check ? ' · identified with low confidence, so check it' : ''}</p>
    <label class="meta">Quantity<input id="bq" type="number" min="1" step="1" value="${it.qty}"></label>
    <div class="row-gap wrap"><button class="btn primary small" id="bSave">Save</button><button class="btn small" id="bOpen">Open card</button><button class="btn small danger" id="bDel">Remove</button></div>`, box => {
    box.querySelector('#bSave').onclick = () => { it.qty = Math.max(1, +box.querySelector('#bq').value || 1); it.check = false; closeModal(); renderBatch(); saveBatch(); };
    box.querySelector('#bOpen').onclick = () => { closeModal(); select(it.ref, { label: it.label }); };
    box.querySelector('#bDel').onclick = () => { state.batch.splice(i, 1); closeModal(); renderBatch(); saveBatch(); haptic(); };
  });
}
$('#bClear').onclick = () => { if (state.batch.length && confirm('Clear this batch session?')) { state.batch = []; renderBatch(); saveBatch(); } };
$('#bCsv').onclick = () => {
  if (!state.batch.length) return;
  const rows = state.batch.map(it => ({ name: it.ref.name, set: it.ref.setName, number: it.ref.number, game: it.ref.game, qty: it.qty, price_label: it.label, price: it.value ?? '', currency: it.currency, market_aud: it.aud?.toFixed(2) ?? '', offer_aud: it.aud ? C.calc(it.aud, state.calc).buyMax.toFixed(2) : '', check: it.check ? 'yes' : '', id: it.ref.id }));
  download(`holowise-batch-${today()}.csv`, toCSV(rows, Object.keys(rows[0])), 'text/csv');
};
$('#bToColl').onclick = async () => {
  if (!state.batch.length) return;
  const items = state.batch.map(it => collectionItem(it.ref, { qty: it.qty, priceLabel: it.label, lastPrice: it.value, currency: it.currency, lastAud: it.aud }));
  await DB.putMany('collection', items); toast(`Added ${items.length} cards to your Collection`); haptic([10, 40, 10]);
};
function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }

// ---------- collection ----------
function collectionItem(ref, o = {}) {
  const d = today();
  return { ...cardRef(ref), qty: 1, condition: 'NM', grade: '', buyAud: null, buyDate: d, manualAud: null, notes: '', addedAt: Date.now(),
    priceLabel: '', lastPrice: null, currency: '', lastAud: null, lastAt: Date.now(), priceLog: o.lastPrice ? [{ d, v: o.lastPrice }] : [], ...o };
}
const CONDS = ['NM', 'LP', 'MP', 'HP', 'DMG'];
function collectionModal(item, card) {
  const isNew = !item;
  let it = item;
  if (isNew) {
    const p = card.prices?.[state.priceIdx];
    const usable = p && !p.au && p.source !== 'ximilar' ? p : card.prices?.find(x => !x.au && x.source !== 'ximilar');
    it = collectionItem(card, { priceLabel: usable?.label || '', lastPrice: usable?.value ?? null, currency: usable?.currency || '', lastAud: usable ? C.toAUD(usable.value, usable.currency, state.fx) : null,
      grade: card.slab ? `${card.slab.company} ${card.slab.grade}`.trim() : '', buyAud: parseFloat(state.asking) > 0 ? parseFloat(state.asking) : null });
  }
  openModal(`<h3>${isNew ? 'Add to collection' : 'Edit card'}</h3>
    <div class="row-gap" style="margin:0 0 12px"><img src="${esc(it.thumb)}" alt="" style="width:46px;border-radius:6px"><div><b>${esc(it.name)}</b><div class="meta">${esc(it.setName)} · ${esc(it.number)}${it.lastAud ? ` · market ${aud(it.lastAud)}` : ''}</div></div></div>
    <div class="grid2">
      <label>Quantity<input id="cQty" type="number" min="1" step="1" value="${it.qty}"></label>
      <label>Condition<select id="cCond">${CONDS.map(c => `<option ${c === it.condition ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>Grade (blank = raw)<input id="cGrade" placeholder="e.g. PSA 10" value="${esc(it.grade)}"></label>
      <label>Paid per card A$<input id="cBuy" type="number" min="0" step="0.01" inputmode="decimal" value="${it.buyAud ?? ''}"></label>
      <label>Purchase date<input id="cDate" type="date" value="${esc(it.buyDate || '')}"></label>
      <label>My value A$ (optional)<input id="cMan" type="number" min="0" step="0.01" inputmode="decimal" placeholder="for graded" value="${it.manualAud ?? ''}"></label>
    </div>
    <label class="meta" style="display:grid;gap:4px;margin-top:10px">Notes<input id="cNotes" value="${esc(it.notes || '')}"></label>
    <p class="meta">Market value uses the converted near-mint raw price. Graded cards need "My value" to count towards the total.</p>
    <div class="row-gap wrap"><button class="btn primary" id="cSave">${isNew ? 'Add' : 'Save'}</button>${isNew ? '' : '<button class="btn" id="cOpen">Open card</button><button class="btn danger" id="cDel">Remove</button>'}<button class="btn ghost" id="cCancel">Cancel</button></div>`, box => {
    const g = s => box.querySelector(s);
    g('#cCancel').onclick = closeModal;
    g('#cSave').onclick = async () => {
      Object.assign(it, { qty: Math.max(1, parseInt(g('#cQty').value, 10) || 1), condition: g('#cCond').value, grade: g('#cGrade').value.trim(), buyAud: parseFloat(g('#cBuy').value) || null,
        buyDate: g('#cDate').value, manualAud: parseFloat(g('#cMan').value) || null, notes: g('#cNotes').value.trim() });
      await DB.put('collection', it); closeModal(); haptic([10, 40, 10]); toast(isNew ? `Added ${it.name} to your Collection` : 'Saved');
      if (state.view === 'collection') renderCollection();
    };
    if (!isNew) {
      g('#cOpen').onclick = () => { closeModal(); select(it, { label: it.priceLabel }); };
      g('#cDel').onclick = async () => { if (!confirm(`Remove ${it.name}?`)) return; await DB.del('collection', it.key); closeModal(); renderCollection(); };
    }
  });
}
async function renderCollection() {
  const items = await DB.all('collection').catch(() => []);
  const s = P.summarize(items);
  $('#pValue').textContent = aud(s.value);
  const pl = $('#pPL'); pl.className = 'pl ' + (s.pl > 0 ? 'up' : s.pl < 0 ? 'down' : '');
  pl.textContent = s.cost ? `${s.pl >= 0 ? '+' : '−'}${aud(Math.abs(s.pl)).replace('A$', 'A$')} ${s.plPct != null ? `(${pctTxt(s.plPct)})` : ''} profit/loss` : 'Add purchase prices to see profit/loss';
  $('#pMeta').textContent = `${s.qty} card${s.qty === 1 ? '' : 's'}${s.unvalued ? ` · ${s.unvalued} not valued` : ''}`;
  const at = await DB.kvGet('collRefreshedAt'); $('#pUpdated').textContent = at ? 'Prices updated ' + when(at) : '';
  // chart from snapshots
  const snaps = (await DB.all('snapshots').catch(() => [])).sort((a, b) => a.d < b.d ? -1 : 1);
  const pts = snaps.map(x => ({ t: Date.parse(x.d + 'T00:00:00Z'), p: x.value }));
  $('#pChart').innerHTML = pts.length >= 2 ? S.chartSVG([{ name: 'Value', color: '#a78bfa', points: pts }, { name: 'Cost', color: '#8f98b8', dashed: true, points: snaps.filter(x => x.cost > 0).map(x => ({ t: Date.parse(x.d + 'T00:00:00Z'), p: x.cost })) }].filter(x => x.points.length), { cur: 'A$', height: 150 }) +
    '<div class="legend"><span><i style="background:#a78bfa"></i>Value (estimate)</span><span><i style="background:#8f98b8"></i>Cost</span></div>'
    : `<p class="meta">${pts.length ? 'One snapshot so far.' : 'No snapshots yet.'} A value chart builds as prices refresh on different days (one snapshot per day).</p>`;
  const mv = P.movers(items, { days: 7, today: today() });
  $('#moversPanel').hidden = !mv.length;
  $('#movers').innerHTML = mv.map(m => `<li data-key="${m.id}"><img alt="" src="${esc(m.thumb)}"><div><div class="t">${esc(m.name)}</div><div class="s">${esc(m.set || '')} · ${fmt(m.from.v, m.cur)} → ${fmt(m.to.v, m.cur)} since ${day(m.from.d)}</div></div><div class="r ${m.pct >= 0 ? 'up' : 'down'}">${pctTxt(m.pct)}</div></li>`).join('');
  const sort = $('#pSort').value;
  const rows = [...s.rows].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'pl' ? (b.pl ?? -1e9) - (a.pl ?? -1e9) : sort === 'recent' ? b.addedAt - a.addedAt : (b.val ?? -1) - (a.val ?? -1));
  const ul = $('#collList'); ul.innerHTML = rows.length ? '' : '<li class="empty">No cards yet. Scan a card and tap <b>＋ Collection</b>, finish a batch, or import a CSV.</li>';
  for (const r of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<img alt="" loading="lazy" src="${esc(r.thumb)}"><div><div class="t">${esc(r.name)}</div><div class="s">${esc(r.setName)} · ${esc(r.number)} · ×${r.q} · ${esc(r.grade || r.condition)}</div></div>
      <div class="r">${r.val != null ? aud(r.val) : '<span class="s">' + esc(r.how) + '</span>'}<div class="s ${r.pl > 0 ? 'up' : r.pl < 0 ? 'down' : ''}">${r.pl != null ? (r.pl >= 0 ? '+' : '−') + aud(Math.abs(r.pl)) : r.how === 'your value' ? 'your value' : ''}</div></div>`;
    li.onclick = () => collectionModal(items.find(x => x.key === r.key));
    ul.appendChild(li);
  }
  $$('#movers li').forEach(li => li.onclick = () => { const it = items.find(x => String(x.key) === li.dataset.key); if (it) collectionModal(it); });
}
$('#pSort').onchange = renderCollection;
async function freshCard(ref) {
  if (ref.game === 'onepiece') { const list = await C.onePieceByCode(ref.code || ref.number); return list.find(x => x.id === ref.id) || null; }
  return C.pokemonById(ref);
}
async function refreshCollection({ auto = false } = {}) {
  const items = await DB.all('collection').catch(() => []); if (!items.length) return;
  const at = await DB.kvGet('collRefreshedAt');
  if (auto && at && Date.now() - at < 6 * 36e5) return;
  const btn = $('#pRefresh'); btn.disabled = true; btn.textContent = 'Refreshing…';
  if (!state.fx) state.fx = await C.fxRates().catch(() => null);
  let ok = 0, fail = 0; const d = today();
  const queue = [...items];
  await Promise.all([0, 1, 2].map(async () => {
    while (queue.length) {
      const it = queue.shift();
      try {
        const f = await freshCard(it); const prices = (f?.prices || []).filter(p => !p.au);
        const p = prices[pickPriceIdx(prices, it.priceLabel)];
        if (p) { Object.assign(it, { lastPrice: p.value, currency: p.currency, priceLabel: p.label, lastAud: C.toAUD(p.value, p.currency, state.fx), lastAt: Date.now(), priceLog: P.pushLog(it.priceLog, d, p.value) }); await DB.put('collection', it); ok++; } else fail++;
      } catch { fail++; }
    }
  }));
  const s = P.summarize(items);
  await DB.put('snapshots', { d, value: Math.round(s.value * 100) / 100, cost: Math.round(s.cost * 100) / 100, n: s.qty, fxDate: state.fx?.date || '' });
  await DB.kvSet('collRefreshedAt', Date.now());
  btn.disabled = false; btn.textContent = 'Refresh prices';
  if (!auto) toast(`Updated ${ok} card${ok === 1 ? '' : 's'}${fail ? ` · ${fail} failed` : ''}`);
  if (state.view === 'collection') renderCollection();
}
$('#pRefresh').onclick = () => { haptic(); refreshCollection(); };
const CSV_COLS = ['name', 'set', 'number', 'game', 'id', 'code', 'qty', 'condition', 'grade', 'buy_aud', 'buy_date', 'my_value_aud', 'market_aud', 'price_label', 'price', 'currency', 'notes'];
$('#csvOut').onclick = async () => {
  const items = await DB.all('collection'); if (!items.length) return toast('Nothing to export yet');
  download(`holowise-collection-${today()}.csv`, toCSV(items.map(it => ({ name: it.name, set: it.setName, number: it.number, game: it.game, id: it.id, code: it.code || '', qty: it.qty, condition: it.condition, grade: it.grade,
    buy_aud: it.buyAud ?? '', buy_date: it.buyDate || '', my_value_aud: it.manualAud ?? '', market_aud: it.lastAud?.toFixed(2) ?? '', price_label: it.priceLabel, price: it.lastPrice ?? '', currency: it.currency, notes: it.notes || '' })), CSV_COLS), 'text/csv');
};
$('#csvIn').onchange = async e => {
  const f = e.target.files?.[0]; if (!f) return; e.target.value = '';
  const rows = parseCSV(await f.text()); let added = 0, looked = 0, skipped = 0;
  toast(`Importing ${rows.length} rows…`, 4000);
  for (const r of rows) {
    const game = /one ?piece/i.test(r.game) || C.parseOnePieceCode(r.code || r.number || '') ? 'onepiece' : 'pokemon';
    let ref = r.id ? { game, id: r.id, code: r.code || (game === 'onepiece' ? (r.number || '').toUpperCase() : null), name: r.name, setName: r.set || '', number: r.number || '' } : null;
    if (!ref && r.name) { // look it up by name + number
      try {
        looked++;
        const list = game === 'onepiece' ? await C.onePieceByCode(C.parseOnePieceCode(r.code || r.number || '') || '') : await C.pokemonSearch(r.name, (r.number || '').split('/')[0]);
        if (list[0]) ref = cardRef(list[0]);
      } catch {}
    }
    if (!ref) { skipped++; continue; }
    await DB.put('collection', collectionItem(ref, { qty: Math.max(1, parseInt(r.qty, 10) || 1), condition: CONDS.includes((r.condition || '').toUpperCase()) ? r.condition.toUpperCase() : 'NM', grade: r.grade || '',
      buyAud: parseFloat(r.buy_aud) || null, buyDate: r.buy_date || today(), manualAud: parseFloat(r.my_value_aud) || null, notes: r.notes || '', priceLabel: r.price_label || '' }));
    added++;
  }
  toast(`Imported ${added}${skipped ? `, skipped ${skipped} (no id or match)` : ''}. Refreshing prices…`, 4000);
  await renderCollection(); refreshCollection();
};

// ---------- JustTCG usage meter ----------
function meterHTML() {
  const u = B.usage();
  const bar = (lab, n, lim) => `<div class="lab"><span>${lab}</span><span>${n} / ${lim}</span></div><div class="bar"><i style="width:${Math.min(100, (n / lim) * 100).toFixed(1)}%"></i></div>`;
  return `${bar('JustTCG calls today (UTC)', u.day, u.dayLimit)}${bar('This month', u.month, u.monthLimit)}<div class="lab"><span>${u.plan ? esc(u.plan) : 'Free tier assumed'}${u.fromApi ? ' · from JustTCG ' + when(Date.parse(u.fromApi)) : ' · counted on this device'}</span><span>${u.dayLeft} left today</span></div>`;
}
function renderMeters() { const h = state.settings.jtKey ? meterHTML() : '<div class="lab"><span>Add a JustTCG key in Settings for 7-day changes and signals.</span></div>'; ['#sMeter', '#wMeter'].forEach(s => { const el = $(s); if (el) el.innerHTML = h; }); }

// ---------- watchlist ----------
const wKey = c => `${c.game}:${c.id}`;
function watchModal(card, existing = null) {
  const it = existing || null;
  const m = it ? it.lastAud : currentAud();
  openModal(`<h3>${it ? 'Edit watch' : 'Watch this card'}</h3>
    <div class="row-gap" style="margin:0 0 12px"><img src="${esc(card.thumb || card.image)}" alt="" style="width:46px;border-radius:6px"><div><b>${esc(card.name)}</b><div class="meta">${esc(card.setName || '')} · ${esc(card.number || '')}${m ? ` · now ${aud(m)}` : ''}</div></div></div>
    <div class="grid2"><label>Alert if at or below (buy) A$<input id="wBuy" type="number" min="0" step="0.5" inputmode="decimal" value="${it?.targetBuy ?? (m ? Math.floor(m * 0.85) : '')}"></label>
    <label>Alert if at or above (sell) A$<input id="wSell" type="number" min="0" step="0.5" inputmode="decimal" value="${it?.targetSell ?? (m ? Math.ceil(m * 1.2) : '')}"></label></div>
    <p class="meta">Targets compare with the AUD market estimate (converted near-mint raw price). Leave blank to just track it.</p>
    <div class="row-gap wrap"><button class="btn primary" id="wSave">${it ? 'Save' : 'Watch'}</button>${it ? '<button class="btn" id="wOpen">Open card</button><button class="btn danger" id="wDel">Remove</button>' : ''}<button class="btn ghost" id="wCancel">Cancel</button></div>`, box => {
    const g = s => box.querySelector(s);
    g('#wCancel').onclick = closeModal;
    g('#wSave').onclick = async () => {
      let w = it;
      if (!w) {
        const c = state.current && wKey(state.current) === wKey(card) ? state.current : card;
        const prices = (c.prices || []).filter(p => !p.au && p.source !== 'ximilar'); const p = prices[pickPriceIdx(prices, c.prices?.[state.priceIdx]?.label)];
        w = { key: wKey(c), ...cardRef(c), addedAt: Date.now(), priceLabel: p?.label || '', lastPrice: p?.value ?? null, currency: p?.currency || '', lastAud: p ? C.toAUD(p.value, p.currency, state.fx) : null, lastAt: Date.now(), priceLog: p ? [{ d: today(), v: p.value }] : [], jt: null, sig: null, alerted: {} };
        const hs = state.hist?.id === c.id ? state.hist.series.find(s => s.jtCardId) : null;
        if (hs) w.jt = { cardId: hs.jtCardId, printing: hs.printing, change7d: hs.change7d, change30d: hs.change30d, at: Date.now() };
        if (state.lastAn?.ok && state.hist?.id === c.id) w.sig = { signal: state.lastAn.signal, confidence: state.lastAn.confidence, midPct: state.lastAn.proj.midPct, at: Date.now() };
      }
      w.targetBuy = parseFloat(g('#wBuy').value) || null; w.targetSell = parseFloat(g('#wSell').value) || null;
      await DB.put('watchlist', w); closeModal(); haptic([10, 40, 10]); toast(it ? 'Saved' : `Watching ${w.name}`);
      updateBadge(); if (state.view === 'watch') renderWatch();
    };
    if (it) {
      g('#wOpen').onclick = () => { closeModal(); select(it, { label: it.priceLabel }); };
      g('#wDel').onclick = async () => { await DB.del('watchlist', it.key); closeModal(); renderWatch(); updateBadge(); };
    }
  });
}
const hitOf = w => w.lastAud > 0 ? (w.targetBuy && w.lastAud <= w.targetBuy ? 'buy' : w.targetSell && w.lastAud >= w.targetSell ? 'sell' : null) : null;
async function updateBadge() {
  const ws = await DB.all('watchlist').catch(() => []); const n = ws.filter(hitOf).length;
  const b = $('#watchBadge'); b.textContent = n; b.hidden = !n;
  try { n ? navigator.setAppBadge?.(n) : navigator.clearAppBadge?.(); } catch {}
  return n;
}
const sigTag = s => s ? `<span class="tag ${s.signal === 'Hold' ? 'hold' : s.signal === 'Sell' ? 'sellsig' : 'watch'}" title="${esc(s.confidence)} confidence estimate">${esc(s.signal)}</span>` : '';
async function renderWatch() {
  const ws = (await DB.all('watchlist').catch(() => [])).sort((a, b) => (!!hitOf(b) - !!hitOf(a)) || b.addedAt - a.addedAt);
  renderMeters();
  const at = await DB.kvGet('watchRefreshedAt'); $('#wUpdated').textContent = at ? 'Updated ' + when(at) : '';
  $('#wNotify').hidden = !('Notification' in window) || Notification.permission !== 'default';
  const ul = $('#watchList'); ul.innerHTML = ws.length ? '' : '<li class="empty">Nothing watched yet. Open a card and tap <b>♡ Watch</b> to set buy/sell targets.</li>';
  for (const w of ws) {
    const h = hitOf(w), li = document.createElement('li'); if (h) li.className = 'hit';
    const ch = w.jt?.change7d;
    li.innerHTML = `<img alt="" loading="lazy" src="${esc(w.thumb)}"><div><div class="t">${esc(w.name)} ${h ? `<span class="tag ${h}">${h === 'buy' ? 'BUY TARGET HIT' : 'SELL TARGET HIT'}</span>` : ''}</div>
      <div class="s">${w.targetBuy ? 'buy ≤ ' + aud(w.targetBuy) : ''}${w.targetBuy && w.targetSell ? ' · ' : ''}${w.targetSell ? 'sell ≥ ' + aud(w.targetSell) : ''}${!w.targetBuy && !w.targetSell ? 'tracking' : ''}</div>
      <div class="s">${ch != null ? `<span class="${ch >= 0 ? 'up' : 'down'}">${pctTxt(ch)} 7d</span> (JustTCG) ` : ''}${sigTag(w.sig)}</div></div>
      <div class="r">${aud(w.lastAud)}<div class="s">${w.lastAt ? day(w.lastAt) : ''}</div></div>`;
    li.onclick = () => watchModal(w, w);
    ul.appendChild(li);
  }
}
async function notifyHits(newHits) {
  if (!newHits.length) return;
  const msg = newHits.map(w => `${w.name}: ${aud(w.lastAud)} (${hitOf(w)} target)`).join('\n');
  toast(`🎯 ${newHits.length} target${newHits.length > 1 ? 's' : ''} hit: ${newHits.map(w => w.name).join(', ')}`, 5000); haptic([20, 60, 20, 60, 20]);
  if ('Notification' in window && Notification.permission === 'granted') {
    try { const reg = await navigator.serviceWorker?.getRegistration(); const o = { body: msg + '\nEstimate, not financial advice.', icon: 'icons/icon.svg', tag: 'hw-watch' };
      reg ? await reg.showNotification('Holowise price alert', o) : new Notification('Holowise price alert', o); } catch {}
  }
}
let watchBusy = false;
async function refreshWatch({ auto = false } = {}) {
  if (watchBusy) return; const ws = await DB.all('watchlist').catch(() => []); if (!ws.length) return;
  const at = await DB.kvGet('watchRefreshedAt'); if (auto && at && Date.now() - at < 2 * 36e5) { updateBadge(); return; }
  watchBusy = true; const btn = $('#wRefresh'); btn.disabled = true; btn.textContent = 'Refreshing…';
  if (!state.fx) state.fx = await C.fxRates().catch(() => null);
  const before = new Map(ws.map(w => [w.key, hitOf(w)])); const fulls = new Map(); const d = today();
  // 1) free sources: current price for every watched card (no JustTCG budget)
  const q = [...ws];
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const w = q.shift(); try {
    const f = await freshCard(w); if (f) fulls.set(w.key, f);
    const prices = (f?.prices || []).filter(p => !p.au); const p = prices[pickPriceIdx(prices, w.priceLabel)];
    if (p) Object.assign(w, { lastPrice: p.value, currency: p.currency, priceLabel: p.label, lastAud: C.toAUD(p.value, p.currency, state.fx), lastAt: Date.now(), priceLog: P.pushLog(w.priceLog, d, p.value) });
  } catch {} } }));
  // 2) JustTCG within budget: batch (1 call per 20 cards) for 7-day change, then 1-year history for signals, oldest first
  const key = state.settings.jtKey; let used = 0, skipped = 0;
  if (key) {
    let allow = B.allowance({ reserveDay: 25, maxPerRun: Math.min(6, 1 + Math.ceil(ws.length / 20) + 3) });
    const onMeta = m => { B.record(m); used++; };
    const stale = ws.filter(w => w.jt?.cardId && (!w.jt.at || Date.now() - w.jt.at > 6 * 36e5));
    for (let i = 0; i < stale.length && allow > 0; i += 20, allow--) {
      try { const res = await HI.justTcgBatch(stale.slice(i, i + 20).map(w => ({ ref: w.key, cardId: w.jt.cardId, printing: w.jt.printing })), key, { onMeta });
        for (const w of stale) { const r = res.get(w.key); if (r) w.jt = { ...w.jt, change7d: r.change7d, change30d: r.change30d, price: r.price, at: Date.now() }; }
      } catch {}
    }
    const needSig = ws.filter(w => !w.jt?.cardId || !w.sig?.at || Date.now() - w.sig.at > 24 * 36e5).sort((a, b) => (a.sig?.at || 0) - (b.sig?.at || 0));
    for (const w of needSig) {
      if (allow <= 0) { skipped++; continue; }
      const f = fulls.get(w.key) || w; const n0 = used;
      try {
        const series = await HI.justTcgHistory(f, key, { onMeta });
        if (used > n0) allow--;
        const s = series[0];
        if (s) { w.jt = { cardId: s.jtCardId, printing: s.printing, change7d: s.change7d, change30d: s.change30d, price: s.price, at: Date.now() };
          const an = S.analyze(s.points, state.sig); w.sig = an.ok ? { signal: an.signal, confidence: an.confidence, midPct: an.proj.midPct, at: Date.now() } : { signal: 'No signal', confidence: 'n/a', at: Date.now() }; }
        else w.sig = { signal: 'No match', confidence: 'n/a', at: Date.now() };
      } catch { if (used > n0) allow--; }
    }
  }
  await DB.putMany('watchlist', ws); await DB.kvSet('watchRefreshedAt', Date.now());
  btn.disabled = false; btn.textContent = 'Refresh';
  const newHits = ws.filter(w => hitOf(w) && hitOf(w) !== before.get(w.key));
  await notifyHits(newHits); await updateBadge();
  if (!auto || used) toast(`Watchlist updated${key ? ` · ${used} JustTCG call${used === 1 ? '' : 's'}` : ''}${skipped ? ` · ${skipped} signal${skipped > 1 ? 's' : ''} deferred to save budget` : ''}`);
  watchBusy = false; renderMeters(); if (state.view === 'watch') renderWatch();
}
$('#wRefresh').onclick = () => { haptic(); refreshWatch(); };
$('#wNotify').onclick = async () => { try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Alerts on (while the app is open)' : 'Alerts not allowed; badges will still show'); } catch {} renderWatch(); };

// ---------- settings ----------
function renderSettings() {
  const st = state.settings;
  $('#sTok').value = st.ximToken; $('#sSlab').checked = st.ximSlab; $('#sXP').checked = st.ximPrices; $('#sProxy').value = st.auProxy; $('#sJt').value = st.jtKey || '';
  $('#sFee').value = state.calc.feePct; $('#sFix').value = state.calc.fixedCost; $('#sMar').value = state.calc.marginPct;
  $('#sHaptics').checked = !!state.prefs.haptics; $('#ver').textContent = 'Holowise v' + VERSION;
  applyTheme(); renderMeters();
}
$$('#themeSeg button').forEach(b => b.onclick = () => { state.prefs.theme = b.dataset.theme; savePrefs(); applyTheme(); haptic(6); });
$('#sHaptics').onchange = e => { state.prefs.haptics = e.target.checked; savePrefs(); haptic(); };
function saveSettings() {
  const proxy = $('#sProxy').value.trim();
  if (proxy && !/^https:\/\//.test(proxy)) { $('#sMsg').textContent = 'Proxy URL must start with https://'; return false; }
  state.settings = { ximToken: $('#sTok').value.trim().replace(/^token\s+/i, ''), ximSlab: $('#sSlab').checked, ximPrices: $('#sXP').checked, auProxy: proxy, jtKey: $('#sJt').value.trim() };
  localStorage.setItem('cl:settings', JSON.stringify(state.settings));
  const n = (s, d) => { const v = parseFloat($(s).value); return isNaN(v) || v < 0 ? d : v; };
  state.calc = { ...state.calc, feePct: Math.min(60, n('#sFee', C.DEFAULT_CALC.feePct)), fixedCost: n('#sFix', C.DEFAULT_CALC.fixedCost), marginPct: Math.min(90, n('#sMar', C.DEFAULT_CALC.marginPct)) };
  localStorage.setItem('cl:calc', JSON.stringify(state.calc));
  return true;
}
$('#settingsForm').onsubmit = e => { e.preventDefault(); if (saveSettings()) { $('#sMsg').textContent = 'Saved on this device only.'; toast('Settings saved'); haptic(); renderSettings(); renderBatch(); } };
$('#sShow').onclick = () => { const i = $('#sTok'); i.type = i.type === 'password' ? 'text' : 'password'; };
$('#sJtShow').onclick = () => { const i = $('#sJt'); i.type = i.type === 'password' ? 'text' : 'password'; };
async function testJustTcg(key, out) {
  if (!key) { out.textContent = 'Paste a key first.'; return false; }
  out.textContent = 'Testing JustTCG (1 call)…';
  try {
    const r = await fetch('https://api.justtcg.com/v1/games', { headers: { 'x-api-key': key } }); const j = await r.json().catch(() => ({}));
    if (j?._metadata) B.record(j._metadata); renderMeters();
    if (!r.ok) { out.textContent = r.status === 401 || r.status === 403 ? 'JustTCG rejected this key.' : `JustTCG error ${r.status}.`; return false; }
    out.textContent = `JustTCG accepted the key ✓${j?._metadata?.apiPlan ? ' · ' + j._metadata.apiPlan : ''}`; return true;
  } catch (e) { out.textContent = 'Network error: ' + e.message; return false; }
}
$('#sJtTest').onclick = () => testJustTcg($('#sJt').value.trim(), $('#sMsg'));
$('#sTest').onclick = async () => {
  const tok = $('#sTok').value.trim(); if (!tok) { $('#sMsg').textContent = 'Paste a token first.'; return; }
  $('#sMsg').textContent = 'Testing Ximilar…';
  try { const c = mkCanvas(64, 90); const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 64, 90);
    await X.ximilarIdentify(c.toDataURL('image/jpeg', 0.6).split(',')[1], tok, { priceStats: false }); $('#sMsg').textContent = 'Ximilar accepted the token ✓';
  } catch (e) { $('#sMsg').textContent = e.message; }
};
$('#dBackup').onclick = async () => { // no API keys in the backup
  const data = { app: 'Holowise', version: VERSION, exportedAt: new Date().toISOString(), collection: await DB.all('collection'), watchlist: await DB.all('watchlist'), snapshots: await DB.all('snapshots'), calc: state.calc, prefs: state.prefs };
  download(`holowise-backup-${today()}.json`, JSON.stringify(data, null, 1), 'application/json');
};
$('#dOnboard').onclick = () => showOnboarding();
$('#dWipe').onclick = async () => {
  if (!confirm('Delete your collection, watchlist, snapshots, saved keys and settings from this device?')) return;
  for (const s of ['collection', 'watchlist', 'snapshots', 'sessions', 'kv']) await DB.clear(s).catch(() => {});
  Object.keys(localStorage).filter(k => /^(hw:|cl:)/.test(k)).forEach(k => localStorage.removeItem(k));
  location.reload();
};

// ---------- onboarding ----------
function showOnboarding() {
  const ob = $('#onboard'); let i = 0;
  const slides = [
    () => `<div class="slide"><img class="logo-big" src="icons/icon.svg" alt=""><h1>Meet <b>Holowise</b></h1><p>Point your camera at a Pokémon or One Piece card. Holowise finds the card, prices it in AUD and tells you what to pay.</p>
      <div class="feat"><div><span class="ico">📷</span><p><b>Auto-scan</b><span>Detects the card and captures it when it's steady. Batch mode handles a whole binder.</span></p></div>
      <div><span class="ico">💼</span><p><b>Collection & watchlist</b><span>Portfolio value, profit/loss, top movers and price targets, all stored on this device.</span></p></div>
      <div><span class="ico">🤝</span><p><b>Deal mode</b><span>Type the asking price for an instant good / fair / overpriced verdict.</span></p></div></div></div>`,
    () => `<div class="slide"><h1>Honest <b>numbers</b></h1><p>Prices come from free public sources (TCGdex/Cardmarket, TCGplayer, OPTCG) and are converted to AUD. They're labelled as conversions, not Australian sales.</p>
      <p>Signals and deal verdicts are simple statistical <b>estimates</b>. When there's not enough data, Holowise says so instead of guessing.</p><p><b>Not financial advice.</b> Your cards, data and keys stay on your phone.</p></div>`,
    () => `<div class="slide"><h1>Unlock <b>price history</b></h1><p>A free JustTCG API key adds 1-year price history, 7-day changes and Hold/Sell/Watch signals. Free tier: 100 calls a day, which Holowise budgets for you.</p>
      <p class="meta" style="color:#b8bfdc">Get one free at <a href="https://justtcg.com" target="_blank" rel="noopener" style="color:#c4b5fd">justtcg.com</a>, then paste it here. It's saved only on this device.</p>
      <input id="obKey" type="password" placeholder="tcg_…" spellcheck="false" autocapitalize="off" value="${esc(state.settings.jtKey || '')}"><div class="row-gap"><button class="btn small ghost" id="obTest" type="button">Test key</button><span id="obMsg" class="meta" style="color:#c3c9e3"></span></div></div>`
  ];
  const draw = () => {
    ob.innerHTML = slides[i]() + `<div class="dots">${slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row-gap"><button class="btn ghost" id="obSkip" type="button">${i < slides.length - 1 ? 'Skip' : 'Skip key'}</button><button class="btn primary" id="obNext" type="button" style="flex:1">${i < slides.length - 1 ? 'Next' : 'Start scanning'}</button></div>`;
    $('#obSkip').onclick = () => finish(false);
    $('#obNext').onclick = () => { haptic(8); if (i < slides.length - 1) { i++; draw(); } else finish(true); };
    $('#obTest')?.addEventListener('click', () => testJustTcg($('#obKey').value.trim(), $('#obMsg')));
  };
  const finish = save => {
    const k = $('#obKey')?.value.trim();
    if (save && k) { state.settings.jtKey = k; localStorage.setItem('cl:settings', JSON.stringify(state.settings)); toast('JustTCG key saved on this device'); }
    localStorage.setItem('hw:onboarded', '1'); ob.hidden = true; ob.innerHTML = ''; renderMeters();
  };
  ob.hidden = false; draw();
}

// ---------- migrate v4 saved scans into the collection (once) ----------
async function migrate() {
  if (localStorage.getItem('hw:migrated')) return;
  try {
    const old = JSON.parse(localStorage.getItem('cl:history') || '[]');
    if (old.length) {
      await DB.putMany('collection', old.map(h => collectionItem({ game: h.game, id: h.id, name: h.name, setName: h.set, number: h.number, thumb: h.thumb, code: h.game === 'onepiece' ? h.number : null },
        { priceLabel: h.label, lastPrice: h.value, currency: h.currency, lastAud: h.aud, buyDate: (h.ts || '').slice(0, 10), addedAt: Date.parse(h.ts) || Date.now(), notes: 'Imported from saved scans' })));
      toast(`Moved ${old.length} saved scan${old.length > 1 ? 's' : ''} into your Collection`, 4000);
    }
  } catch {}
  localStorage.setItem('hw:migrated', '1');
}

// ---------- init ----------
(async function init() {
  applyTheme(); setMode(state.mode);
  $$('#gameSeg button').forEach(b => b.onclick = () => { haptic(6); setMode(b.dataset.mode); });
  $('#chipAuto').setAttribute('aria-pressed', !!state.prefs.auto); $('#chipDeal').setAttribute('aria-pressed', !!state.prefs.deal);
  $('#chipBatch').setAttribute('aria-pressed', !!state.prefs.batch); $('#batchPanel').hidden = !state.prefs.batch;
  try { const s = await DB.get('sessions', 'current'); if (s?.items) state.batch = s.items; } catch {}
  renderBatch(); renderSettings();
  showView((location.hash || '#scan').slice(1), { push: false });
  if (!localStorage.getItem('hw:onboarded')) showOnboarding();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=5').catch(() => {});
  await migrate();
  updateBadge();
  setTimeout(() => { refreshWatch({ auto: true }); refreshCollection({ auto: true }); }, 1500);
  C.tcgdexSets().catch(() => {});
})();
