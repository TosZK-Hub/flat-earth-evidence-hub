// Holowise v7 — app shell: tabs, scan (auto-detect + auto-capture + batch), card sheet (price, history, deal check),
// collection (IndexedDB), watchlist (alerts within the JustTCG budget), settings and onboarding.
import * as C from './core.js?v=7';
import { readCardV2, readNameV2, makeTools } from './ocr.js?v=7';
import * as X from './ximilar.js?v=7';
import { ebaySoldUrl, ebayBuyUrl, auSoldPrice, auQuery, affiliateOn } from './au.js?v=7';
import * as HI from './history.js?v=7';
import * as S from './signal.js?v=7';
import * as D from './detect.js?v=7';
import * as DB from './db.js?v=7';
import * as P from './portfolio.js?v=7';
import * as B from './budget.js?v=7';
import { dealVerdict, sessionTotals } from './deal.js?v=7';
import { toCSV, parseCSV } from './csv.js?v=7';
import * as PL from './plan.js?v=7';
import * as SE from './sell.js?v=7';
import * as CE from './center.js?v=7';
import { parseCommand, spokenCard } from './voice.js?v=7';
import { PAY, PROXY, LAUNCH } from './config.js?v=7';

const VERSION = '7.0';
// Your Worker (config.js PROXY.url); a URL typed in Settings on this device overrides it. Blank = free sources only.
const proxyUrl = () => (state.settings.auProxy || PROXY.url || '').trim();
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
  let list = p.opCode ? await C.onePieceByCode(p.opCode) : await C.pokemonByNumber(p.pkNumber.number, p.pkNumber.total, names);
  if (!list.length) list = await packLookup(p); // offline show mode
  return { list, strong: list.length > 0 && (names.length ? list.some(x => C.nameMatches(x.name, names)) : !p.guessed) };
}

async function scanFrom(rect, label = 'Reading card…') {
  if (state.busy) return; state.busy = true;
  $('#frame').classList.add('busy'); $('#scanBtn').disabled = true;
  const log = [], t0 = performance.now();
  state.scanImg = scanCrop(rect); state.scanPending = true; // kept for the centering check
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
    b.onclick = () => { haptic(6); state.scanFor = c.id; box.querySelectorAll('.cand').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); if (state.prefs.batch) replaceLastBatch(c); else select(c); };
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
  const det = $('#detail'); det.innerHTML = skeleton(); if (!HF.on) openSheet();
  if (state.scanPending) { state.scanFor = card.id; state.scanPending = false; }
  if (!state.current || state.current.id !== card.id) state.asking = ''; // asking price belongs to one card
  try {
    let full = !navigator.onLine ? await packFull(card) : null;
    if (!full) { try { full = await getFull(card); } catch (e) { full = await packFull(card); if (!full) throw e; } }
    if (card.prices?.some(p => p.source === 'ximilar') && !full.prices.some(p => p.source === 'ximilar')) full.prices.push(...card.prices.filter(p => p.source === 'ximilar'));
    full.auNote = '';
    if (proxyUrl() && full.game === 'pokemon' && !full.offlineAt) {
      try { const au = await auSoldPrice(proxyUrl(), full, { graded: !!full.slab }); if (au) full.prices.unshift(au); else if (au !== false) full.auNote = 'No recent AU sales found for this card.'; }
      catch (e) { full.auNote = 'AU sold prices unavailable: ' + e.message; }
    }
    state.current = full; state.priceIdx = pickPriceIdx(full.prices, label); state.lastAn = null;
    renderDetail(); hfAnnounce();
    if (!full.offlineAt) { try { HI.logToday(full, full.prices); } catch {} loadHistory(full); }
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
        ${c.offlineAt ? `<div><span class="chip conv" id="offChip">Offline · price cached ${esc(when(c.offlineAt))}</span></div>` : ''}
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
    ${toolsHTML()}
    <section id="histBox" class="histbox"></section>
    <p class="warn">Prices are for the variant and condition shown (usually near-mint, raw, English). Graded slabs, Japanese prints and damaged cards can be worth far more or less. Not financial advice.</p>
    <div class="links">
      <a class="btn ghost small" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c))}">eBay AU sold · raw ↗</a>
      <a class="btn ghost small" target="_blank" rel="noopener sponsored" id="ebayBuy" href="${esc(ebayBuyUrl(c, slab ? { graded: true, grade: `${slab.company} ${slab.grade}`.trim() } : {}))}">Buy on eBay AU ↗</a>
      <a class="btn ghost small" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c, { graded: true, grade: slab ? `${slab.company} ${slab.grade}`.trim() : '' }))}">eBay AU sold · ${slab ? esc(`${slab.company} ${slab.grade}`) : 'graded'} ↗</a>
    </div>${affNote()}`;
  $('#priceSel')?.addEventListener('change', e => { state.priceIdx = +e.target.value; renderDetail(); });
  $('#addColl').onclick = () => { haptic(); collectionModal(null, c); };
  $('#addWatch').onclick = () => { haptic(); watchModal(c); };
  $('#calcLink')?.addEventListener('click', e => { e.preventDefault(); closeSheet(); showView('settings'); });
  $('#dealAsk')?.addEventListener('input', e => { state.asking = e.target.value; renderDeal(); });
  $('#dealClear')?.addEventListener('click', () => { state.asking = ''; $('#dealAsk').value = ''; renderDeal(); });
  bindTools(); renderDeal(); renderHistory();
}
function renderDeal() {
  if (HF.on) hudCard();
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
  if (st.jtKey || proxyUrl()) jobs.push(HI.justTcgHistory(card, st.jtKey, { proxy: proxyUrl(), onMeta: m => { if (st.jtKey) { B.record(m); renderMeters(); } } }).then(list => { if (list.length) h.series.unshift(...list); else if (!list.disabled) h.notes.push('JustTCG has no exact match for this card or variant, so no JustTCG history is shown (never a near match).'); }).catch(e => h.notes.push('JustTCG unavailable: ' + (e.status === 401 || e.status === 403 ? 'key rejected' : e.message))));
  if (proxyUrl() && card.game === 'pokemon') {
    h.au = { sales: null, hist: null };
    jobs.push(HI.auSales(proxyUrl(), auQuery(card)).then(r => { h.au.sales = r; }).catch(e => h.notes.push('AU sales unavailable: ' + e.message)));
    jobs.push(HI.auHistory(proxyUrl(), { q: `${String(card.name).replace(/\(.*?\)/g, '')} ${card.setName || ''}`.trim(), number: card.number }).then(r => {
      h.au.hist = r;
      if (r.median.length) h.series.push({ key: 'au-median', name: 'AU eBay sold median (TCG Prices AU)', kind: 'raw', currency: 'AUD', au: true, source: 'TCG Prices AU', link: 'https://tcgprices.com.au/', points: r.median });
    }).catch(e => h.notes.push('AU history unavailable: ' + e.message)));
  }
  await Promise.allSettled(jobs);
  if (h.au && (h.au.sales?.disabled || h.au.hist?.disabled)) h.au = null; // AU sold data not switched on at the server
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
  const free = !PL.has('history1y', plan());
  const rk = free && (state.range === '365' || state.range === 'all') ? (rangeOK('90') ? '90' : '30') : rangeOK(state.range) ? state.range : free ? (rangeOK('90') ? '90' : '30') : 'all';
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
      <div class="tabs" role="tablist">${ranges.map(([k, label, need]) => `<button type="button" data-r="${k}" class="${rk === k ? 'on' : ''}" ${span < need ? 'disabled title="Not enough history yet"' : ''} ${(k === '365' || k === 'all') && !PL.has('history1y', plan()) ? 'data-lock="1"' : ''} aria-label="${label}">${k === 'all' ? 'All' : k === '365' ? '1y' : k + 'd'}${(k === '365' || k === 'all') && !PL.has('history1y', plan()) ? ' 🔒' : ''}</button>`).join('')}</div>
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
    html += `<p class="meta">Recent individual sales (raw vs graded) need sold-listing data. The free sources only publish market averages. Use the eBay AU sold links below.</p>`;
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
  box.querySelectorAll('.tabs button').forEach(b => b.onclick = () => { if (b.dataset.lock) { upgradeModal('history1y'); return; } state.range = b.dataset.r; localStorage.setItem('cl:range', state.range); renderHistory(); });
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
    try {
    if (op && state.mode !== 'pokemon') list = await C.onePieceByCode(op);
    else if (state.mode === 'onepiece') list = await C.onePieceSearch(name || num);
    else if (pk) list = await C.pokemonByNumber(pk.number, pk.total, name ? name.split(/\s+/) : []);
    if (!list.length && state.mode !== 'onepiece') {
      const bare = (num.match(/^[A-Za-z]*\d+/) || [''])[0];
      list = await C.pokemonSearch(name, pk ? pk.number : bare);
      if (!list.length && pk) list = await C.pokemonSearch(name, pk.number.padStart(3, '0'));
    }
    if (!list.length && state.mode === 'auto' && name) list = await C.onePieceSearch(name);
    } catch (e2) { if (navigator.onLine) throw e2; }
    if (!list.length) { // offline show mode: search the saved pack
      if (op || pk) list = await packLookup(op ? { opCode: op } : { pkNumber: pk });
      if (!list.length && name) { const pkl = await loadPack(), q = name.toLowerCase(); list = [...pkl.values()].map(x => x.card).filter(c => c.name.toLowerCase().includes(q)); }
      if (list.length) toast('Offline: showing cards from your saved pack');
    }
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
  if (state.batch.length >= PL.limit('batch', plan())) { toast(`Batch is full (${PL.limit('batch', plan())} cards on your plan)`); upgradeModal('batchBig'); state.autoPaused = true; return; }
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
      if (isNew && (await DB.all('collection').catch(() => [])).length >= PL.limit('collection', plan())) { closeModal(); upgradeModal(); toast(`Free plan holds ${PL.LIMITS.free.collection} cards`); return; }
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
function renderMeters() { const h = state.settings.jtKey ? meterHTML() : proxyUrl() ? '<div class="lab"><span>Price history and signals come from the Holowise price server. No key needed.</span></div>' : '<div class="lab"><span>Add a JustTCG key in Settings for 7-day changes and signals.</span></div>'; ['#sMeter', '#wMeter'].forEach(s => { const el = $(s); if (el) el.innerHTML = h; }); }

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
      if (!w && (await DB.all('watchlist').catch(() => [])).length >= PL.limit('watchlist', plan())) { closeModal(); upgradeModal(); toast(`Free plan watches ${PL.LIMITS.free.watchlist} cards`); return; }
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
  if (!PL.has('alerts', plan())) { toast(`${newHits.length} watch target${newHits.length > 1 ? 's' : ''} hit. Pro sends alerts.`, 3500); return; }
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
  const key = state.settings.jtKey, px = key ? '' : proxyUrl(); let used = 0, skipped = 0;
  if (key || px) {
    // Own key: stay inside the free-tier budget. Server (Worker): a fixed per-refresh cap; the Worker rate-limits and caches.
    let allow = key ? B.allowance({ reserveDay: 25, maxPerRun: Math.min(6, 1 + Math.ceil(ws.length / 20) + 3) }) : Math.min(8, 1 + Math.ceil(ws.length / 20) + 4);
    const onMeta = m => { if (key) B.record(m); used++; };
    const stale = ws.filter(w => w.jt?.cardId && (!w.jt.at || Date.now() - w.jt.at > 6 * 36e5));
    for (let i = 0; i < stale.length && allow > 0; i += 20, allow--) {
      try { const res = await HI.justTcgBatch(stale.slice(i, i + 20).map(w => ({ ref: w.key, cardId: w.jt.cardId, printing: w.jt.printing })), key, { onMeta, proxy: px });
        for (const w of stale) { const r = res.get(w.key); if (r) w.jt = { ...w.jt, change7d: r.change7d, change30d: r.change30d, price: r.price, at: Date.now() }; }
      } catch {}
    }
    const needSig = ws.filter(w => !w.jt?.cardId || !w.sig?.at || Date.now() - w.sig.at > 24 * 36e5).sort((a, b) => (a.sig?.at || 0) - (b.sig?.at || 0));
    for (const w of needSig) {
      if (allow <= 0) { skipped++; continue; }
      const f = fulls.get(w.key) || w; const n0 = used;
      try {
        const series = await HI.justTcgHistory(f, key, { onMeta, proxy: px });
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
  if (!auto || used) toast(`Watchlist updated${key || px ? ` · ${used} price-history call${used === 1 ? '' : 's'}` : ''}${skipped ? ` · ${skipped} signal${skipped > 1 ? 's' : ''} deferred to save budget` : ''}`);
  watchBusy = false; renderMeters(); if (state.view === 'watch') renderWatch();
}
$('#wRefresh').onclick = () => { haptic(); refreshWatch(); };
$('#wNotify').onclick = async () => { try { const r = await Notification.requestPermission(); toast(r === 'granted' ? 'Alerts on (while the app is open)' : 'Alerts not allowed; badges will still show'); } catch {} renderWatch(); };

// ---------- settings ----------
function renderSettings() {
  const st = state.settings;
  $('#sTok').value = st.ximToken; $('#sSlab').checked = st.ximSlab; $('#sXP').checked = st.ximPrices; $('#sProxy').value = st.auProxy; $('#sProxy').placeholder = PROXY.url ? PROXY.url + ' (built in)' : 'https://your-proxy.workers.dev'; $('#sJt').value = st.jtKey || '';
  $('#sFee').value = state.calc.feePct; $('#sFix').value = state.calc.fixedCost; $('#sMar').value = state.calc.marginPct;
  $('#sHaptics').checked = !!state.prefs.haptics; $('#ver').textContent = 'Holowise v' + VERSION;
  applyTheme(); renderMeters(); renderPlan(); renderPack();
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
    () => `<div class="slide"><h1>Why <b>Holowise</b></h1><p>Built for Australian collectors and dealers, not a US app with a currency switch.</p>
      <div class="feat"><div><span class="ico">🎙</span><p><b>Hands-free deal mode</b><span>Scan, hear the price and say the asking price for a verdict. Glasses-ready, no tapping at a busy table.</span></p></div>
      <div><span class="ico">🇦🇺</span><p><b>What you actually keep</b><span>Net proceeds across eBay AU, Facebook pickup, your local store and card shows, with dated, sourced fees.</span></p></div>
      <div><span class="ico">🏅</span><p><b>Should I grade it?</b><span>AU grading costs, customs and your odds give the breakeven, with a centering check from the photo.</span></p></div>
      <div><span class="ico">📦</span><p><b>Works offline at shows</b><span>Save your cards before the show: scan and price with no signal. No account needed.</span></p></div></div></div>`,
    () => `<div class="slide"><h1>Honest <b>numbers</b></h1><p>Prices come from free public sources (TCGdex/Cardmarket, TCGplayer, OPTCG) and are converted to AUD. They're labelled as conversions, not Australian sales.</p>
      <p>Signals and deal verdicts are simple statistical <b>estimates</b>. When there's not enough data, Holowise says so instead of guessing.</p><p><b>Not financial advice.</b> Your cards, data and keys stay on your phone. <a href="privacy.html" target="_blank" rel="noopener" style="color:#c4b5fd">Privacy</a> · <a href="terms.html" target="_blank" rel="noopener" style="color:#c4b5fd">Terms</a></p></div>`,
    () => `<div class="slide"><h1>Unlock <b>price history</b></h1><p>A free JustTCG API key adds 1-year price history, 7-day changes and Hold/Sell/Watch signals. Free tier: 100 calls a day, which Holowise budgets for you.</p>
      <p class="meta" style="color:#b8bfdc">Get one free at <a href="https://justtcg.com" target="_blank" rel="noopener" style="color:#c4b5fd">justtcg.com</a>, then paste it here. It's saved only on this device.</p>
      <input id="obKey" type="password" placeholder="tcg_…" spellcheck="false" autocapitalize="off" value="${esc(state.settings.jtKey || '')}"><div class="row-gap"><button class="btn small ghost" id="obTest" type="button">Test key</button><span id="obMsg" class="meta" style="color:#c3c9e3"></span></div></div>`
  ];
  const keySlide = !(proxyUrl() && !state.settings.jtKey); if (!keySlide) slides.pop(); // server-side history: no key to ask for
  const draw = () => {
    ob.innerHTML = slides[i]() + `<div class="dots">${slides.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="row-gap"><button class="btn ghost" id="obSkip" type="button">${i < slides.length - 1 || !keySlide ? 'Skip' : 'Skip key'}</button><button class="btn primary" id="obNext" type="button" style="flex:1">${i < slides.length - 1 ? 'Next' : 'Start scanning'}</button></div>`;
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

// ---------- plans & paywall ----------
const plan = () => PL.current();
const lockIco = f => PL.has(f, plan()) ? '' : '<span class="lock" aria-label="Pro">🔒</span>';
function gate(feature) { if (PL.has(feature, plan())) return true; haptic(10); upgradeModal(feature); return false; }
function planLabel(cur = plan()) {
  if (cur.via === 'trial') return `Pro preview (trial) until ${day(cur.until)}`;
  if (cur.via === 'licence') return `${cur.tier === 'dealer' ? 'Dealer' : 'Pro'} (licence)${cur.until ? ' · renews/ends ' + day(cur.until) : ''}`;
  return 'Free';
}
function renderPlan() {
  const cur = plan(), el = $('#planNow'); if (el) el.textContent = planLabel(cur);
  const pill = $('#planPill'); if (pill) { pill.textContent = cur.tier === 'free' ? 'Free' : cur.tier === 'dealer' ? 'Dealer' : 'Pro'; pill.dataset.tier = cur.tier; }
  const lic = PL.load().license; const li = $('#planLic'); if (li) li.textContent = lic?.valid ? `Licence ${lic.key} · last checked ${when(lic.checkedAt)}` : '';
  const ap = $('#aboutPay'); if (ap) ap.textContent = PL.checkoutLive() ? '' : ' Paid checkout isn\u2019t live yet, so nothing can be bought or charged.';
  const as = $('#affState'); if (as) as.textContent = affiliateOn() ? 'Affiliate tracking is on.' : 'Affiliate tracking is currently off.';
  const jb = $('#jtBuiltIn'); if (jb) jb.hidden = !proxyUrl();
  const ai = $('#aInterest'), iu = String(LAUNCH.interestUrl || '').trim(); if (ai && /^https:\/\//.test(iu)) { ai.href = iu; ai.target = '_blank'; ai.rel = 'noopener'; }
  ['#chipHF', '#chipTrade'].forEach(s => { const b = $(s); if (b) b.dataset.locked = !PL.has(b.dataset.f, cur); });
}
function upgradeModal(feature = null) {
  const cur = plan(), live = PL.checkoutLive(), pr = PAY.prices, p0 = PL.load();
  const L = PL.LIMITS, inf = n => n === Infinity ? 'Unlimited' : n;
  const row = (name, f, pro, dealer) => `<tr><td>${name}</td><td>${f}</td><td>${pro}</td><td>${dealer}</td></tr>`;
  const buy = (k, label) => PL.checkoutUrl(k) ? `<a class="btn primary small buy" data-k="${k}" href="${esc(PL.checkoutUrl(k))}" target="_blank" rel="noopener">${label}</a>` : `<button class="btn small" disabled title="Checkout not connected yet">${label}</button>`;
  openModal(`<h3>Holowise Pro</h3>
    ${feature ? `<p class="meta"><b>${esc(PL.FEATURE_NAMES[feature] || 'This feature')}</b> is part of ${PL.FEATURES[feature] === 'dealer' ? 'Dealer' : 'Pro'}.</p>` : ''}
    <p class="meta">You're on: <b id="upNow">${esc(planLabel(cur))}</b></p>
    <div class="tablewrap"><table class="tiers"><thead><tr><th></th><th>Free</th><th>Pro</th><th>Dealer</th></tr></thead><tbody>
      ${row('Price (AUD, incl. GST)', 'A$0', `A$${pr.proMonthly}/mo<br>or A$${pr.proYearly}/yr`, `A$${pr.dealerMonthly}/mo<br>or A$${pr.dealerYearly}/yr`)}
      ${row('Scans, AUD prices, deal verdicts', '✓ unlimited', '✓', '✓')}
      ${row('Collection cards', inf(L.free.collection), inf(L.pro.collection), inf(L.dealer.collection))}
      ${row('Watchlist cards', inf(L.free.watchlist), inf(L.pro.watchlist), inf(L.dealer.watchlist))}
      ${row('Price history', `${L.free.historyDays} days`, '1 year + all', '1 year + all')}
      ${row('Batch session size', inf(L.free.batch), inf(L.pro.batch), inf(L.dealer.batch))}
      ${row('Hands-free voice mode', '—', '✓', '✓')}
      ${row('Centering check, "Should I grade it?"', '—', '✓', '✓')}
      ${row('AU net proceeds by channel', '—', '✓', '✓')}
      ${row('Trade calculator, price alerts', '—', '✓', '✓')}
      ${row('Offline show mode', '—', '✓', '✓')}
      ${row('Buy-offer sheet for walk-up sellers', '—', '—', '✓')}
    </tbody></table></div>
    ${live ? '' : '<p class="warn" id="upNotLive"><b>Checkout isn\u2019t live yet.</b> Payments haven\u2019t been connected, so nothing can be bought and you won\u2019t be charged. You can try every Pro feature free with the preview below.</p>'}
    <div class="row-gap wrap">${buy('proMonthly', `Pro A$${pr.proMonthly}/mo`)}${buy('proYearly', `Pro A$${pr.proYearly}/yr`)}${buy('dealerMonthly', `Dealer A$${pr.dealerMonthly}/mo`)}${buy('dealerYearly', `Dealer A$${pr.dealerYearly}/yr`)}</div>
    <div class="row-gap wrap" style="margin-top:10px">${p0.trialStart ? `<span class="meta">Preview ${cur.via === 'trial' ? 'active until ' + day(cur.until) : 'already used on this device'}.</span>` : `<button class="btn" id="upTrial">Start ${PAY.trialDays}-day Pro preview (free, no card)</button>`}</div>
    <details style="margin-top:10px"${live ? ' open' : ''}><summary>Have a licence key?</summary>
      <div class="row-gap" style="margin-top:8px"><input id="upKey" placeholder="Licence key from your receipt" spellcheck="false" autocapitalize="off"><button class="btn small" id="upAct">Activate</button></div>
      <p class="meta" id="upMsg"></p></details>
    <p class="meta">${live ? 'Prices in AUD incl. GST. Billed by Lemon Squeezy (merchant of record). Your licence key arrives by email: paste it above. Cancel any time from your receipt email.' : 'Prices shown are proposed and may change before launch. Subscriptions will be billed by the payment provider; cancel any time from your receipt email.'} Pro doesn\u2019t change how prices are worked out: they\u2019re still estimates, not financial advice. <a href="terms.html" target="_blank" rel="noopener">Terms</a> · <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p>
    <div class="row-gap"><button class="btn ghost" id="upClose">Close</button></div>`, box => {
    box.querySelector('#upClose').onclick = closeModal;
    box.querySelector('#upTrial')?.addEventListener('click', () => { if (PL.startTrial()) { toast(`Pro preview on for ${PAY.trialDays} days`); haptic([10, 40, 10]); } closeModal(); renderPlan(); if (state.current && $('#sheet').classList.contains('show')) renderDetail(); });
    box.querySelector('#upAct').onclick = async () => {
      const msg = box.querySelector('#upMsg'); msg.textContent = 'Checking licence…';
      try { const l = await PL.activateLicense(box.querySelector('#upKey').value, { proxyUrl: proxyUrl() }); msg.textContent = `Activated: ${l.tier === 'dealer' ? 'Dealer' : 'Pro'} ✓`; renderPlan(); box.querySelector('#upNow').textContent = planLabel(); toast('Licence activated'); }
      catch (e) { msg.textContent = e.message || 'Could not check the licence.'; }
    };
  });
}
async function recheckLicence() { // weekly re-validation; 14-day offline grace is handled in plan.js
  const l = PL.load().license; if (!l?.valid || !l.full || Date.now() - (l.checkedAt || 0) < 7 * 864e5 || !navigator.onLine) return;
  try { await PL.validateLicense(l.full, { proxyUrl: proxyUrl() }); } catch (e) { if (/not valid|different|expired|disabled|not found|instance/i.test(e.message)) { PL.clearLicense(); toast('Your Holowise licence is no longer active'); } }
  renderPlan();
}

// ---------- pro tools on the card sheet ----------
function toolsHTML() {
  return `<section class="tools" id="proTools"><div class="row-between"><b>Pro tools</b><span class="meta">${plan().tier === 'free' ? '<a href="#" id="toolsUp">See plans</a>' : esc(planLabel())}</span></div>
    <div class="toolgrid"><button class="btn small" id="tCenter">🎯 Centering${lockIco('centering')}</button><button class="btn small" id="tGrade">🏅 Grade it?${lockIco('grading')}</button>
    <button class="btn small" id="tSell">🇦🇺 Where to sell${lockIco('sell')}</button><button class="btn small" id="tTrade">⇄ Trade${lockIco('trade')}</button></div></section>`;
}
function bindTools() {
  $('#toolsUp')?.addEventListener('click', e => { e.preventDefault(); upgradeModal(); });
  $('#tCenter')?.addEventListener('click', () => gate('centering') && centeringModal());
  $('#tGrade')?.addEventListener('click', () => gate('grading') && gradeModal());
  $('#tSell')?.addEventListener('click', () => gate('sell') && sellModal());
  $('#tTrade')?.addEventListener('click', () => { if (!gate('trade')) return; addToTrade('theirs', state.current, currentAud()); tradeModal(); });
}
const affNote = () => affiliateOn() ? '<p class="meta aff">eBay links are affiliate links: Holowise may earn a small commission at no cost to you. It never changes the prices or verdicts shown. <a href="terms.html#affiliate" target="_blank" rel="noopener">Disclosure</a></p>' : '';

// Centering: uses the last scanned crop (or a photo you pick). Lines are auto-placed and adjustable.
function scanCrop(rect) {
  try { const W = 420, H = Math.round(W * rect.h / rect.w), c = mkCanvas(W, H); c.getContext('2d').drawImage(rect.src, rect.x, rect.y, rect.w, rect.h, 0, 0, W, H); return c; } catch { return null; }
}
function centerInput(c) {
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, ch = [0, 1, 2].map(() => new Float32Array(n));
  for (let i = 0, j = 0; j < n; i += 4, j++) { ch[0][j] = d[i]; ch[1][j] = d[i + 1]; ch[2][j] = d[i + 2]; }
  return { w: c.width, h: c.height, ch };
}
function centeringModal(img = state.scanImg) {
  const forThis = img && state.scanFor === state.current?.id;
  if (!img) {
    openModal(`<h3>Centering check</h3><p class="meta">Scan the card with the camera or a photo first, square-on and filling the frame, then open this again. Or pick a photo of the front now.</p>
      <label class="btn" for="cenPhoto">Pick a photo</label><input type="file" id="cenPhoto" accept="image/*" hidden> <button class="btn ghost" id="cenX">Close</button>`, box => {
      box.querySelector('#cenX').onclick = closeModal;
      box.querySelector('#cenPhoto').onchange = async e => { const f = e.target.files?.[0]; if (!f) return; const im = new Image(); im.src = URL.createObjectURL(f); await im.decode().catch(() => {}); const r = cardRectInImage(im); const c = scanCrop(r); URL.revokeObjectURL(im.src); if (c) { state.scanImg = c; state.scanFor = state.current?.id; centeringModal(c); } };
    });
    return;
  }
  const m = CE.measureCentering(centerInput(img));
  const L = { xo: m.lines.x[0], xi: m.lines.x[1], xj: m.lines.x[2], xp: m.lines.x[3], yo: m.lines.y[0], yi: m.lines.y[1], yj: m.lines.y[2], yp: m.lines.y[3] };
  const sl = (k, label, max) => `<label>${label}<input type="range" min="0" max="${max}" step="1" value="${L[k]}" data-k="${k}"></label>`;
  openModal(`<h3>Centering check <span class="chip conv">Estimate</span></h3>
    ${forThis ? '' : '<p class="warn">This image is from your last scan, which may not be the card open now.</p>'}
    <div class="cenwrap"><canvas id="cenCv" width="${img.width}" height="${img.height}"></canvas></div>
    <div id="cenOut"></div>
    <details><summary>Adjust lines (drag until they sit on the card edge and the inner border)</summary><div class="grid2 cens">
      ${sl('xo', 'Card edge left', img.width / 3)}${sl('xi', 'Border left', img.width / 2)}${sl('xj', 'Border right', img.width)}${sl('xp', 'Card edge right', img.width)}
      ${sl('yo', 'Card edge top', img.height / 3)}${sl('yi', 'Border top', img.height / 2)}${sl('yj', 'Border bottom', img.height)}${sl('yp', 'Card edge bottom', img.height)}</div></details>
    <p class="meta">Compared with PSA front limits (10: 55/45, 9: 60/40, 8: 65/35, 7: 70/30, 6: 80/20; <a href="https://www.psacard.com/gradingstandards" target="_blank" rel="noopener">PSA standards</a>) and BGS (10: 50/50, 9.5: 50/50 one way and 55/45 the other; <a href="https://binder-ai.com/guides/bgs-centering-requirements" target="_blank" rel="noopener">BGS guide</a>), checked ${SE.FEES_CHECKED}. Front only, from one photo: angle, lens distortion, sleeves and full-art designs throw it off. Corners, edges and surface also decide the grade. Not a grade and not financial advice.</p>
    <div class="row-gap wrap"><label class="btn small ghost" for="cenPhoto2">Use another photo</label><input type="file" id="cenPhoto2" accept="image/*" hidden><button class="btn small" id="cenGrade">Use in "Grade it?"</button><button class="btn small ghost" id="cenX">Close</button></div>`, box => {
    delete box.dataset.adj;
    const cv = box.querySelector('#cenCv'), g = cv.getContext('2d');
    const draw = () => {
      g.drawImage(img, 0, 0); g.lineWidth = 2;
      const v = (x, col) => { g.strokeStyle = col; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, cv.height); g.stroke(); };
      const hz = (y, col) => { g.strokeStyle = col; g.beginPath(); g.moveTo(0, y + .5); g.lineTo(cv.width, y + .5); g.stroke(); };
      v(L.xo, '#ff4d6d'); v(L.xp, '#ff4d6d'); v(L.xi, '#3ad29f'); v(L.xj, '#3ad29f'); hz(L.yo, '#ff4d6d'); hz(L.yp, '#ff4d6d'); hz(L.yi, '#3ad29f'); hz(L.yj, '#3ad29f');
      const l = L.xi - L.xo, r = L.xp - L.xj, t = L.yi - L.yo, b = L.yp - L.yj;
      const ratio = (a, c) => a + c > 0 ? Math.round(Math.max(a, c) / (a + c) * 1000) / 10 : null;
      const mm = { lr: ratio(l, r), tb: ratio(t, b) }; mm.worse = Math.max(mm.lr ?? 100, mm.tb ?? 100);
      const caps = l > 0 && r > 0 && t > 0 && b > 0 ? CE.centeringCaps(mm) : null;
      const adj = box.dataset.adj === '1', conf = adj ? 'your lines' : m.confidence;
      state.centering = caps ? { ...mm, caps, conf, id: state.current?.id } : null;
      const half = x => x == null ? '—' : `${x}/${(100 - x).toFixed(1).replace(/\.0$/, '')}`;
      box.querySelector('#cenOut').innerHTML = caps ? `<div class="verdict ${conf === 'low' ? 'warn' : 'ok'}"><div class="vl">L/R ${half(mm.lr)} · T/B ${half(mm.tb)}</div>
        <div>Best front-centering grade not ruled out: <b>PSA ${caps.psa}</b> · <b>BGS ${esc(caps.bgs)}</b></div>
        <div class="meta">Borders (px): left ${l}, right ${r}, top ${t}, bottom ${b} · confidence: <b>${esc(conf)}</b>${conf === 'low' ? '. The automatic lines look unreliable here: check them and adjust before trusting this.' : ''}</div></div>`
        : '<p class="warn">Couldn\u2019t find all four borders. Full-art cards often have none to measure. Otherwise, adjust the lines by hand or retake the photo square-on against a plain background.</p>';
    };
    box.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { L[r.dataset.k] = +r.value; box.dataset.adj = '1'; draw(); });
    box.querySelector('#cenX').onclick = closeModal;
    box.querySelector('#cenGrade').onclick = () => { closeModal(); gate('grading') && gradeModal(); };
    box.querySelector('#cenPhoto2').onchange = async e => { const f = e.target.files?.[0]; if (!f) return; const im = new Image(); im.src = URL.createObjectURL(f); await im.decode().catch(() => {}); const c = scanCrop(cardRectInImage(im)); URL.revokeObjectURL(im.src); if (c) { state.scanImg = c; state.scanFor = state.current?.id; centeringModal(c); } };
    draw();
  });
}

// "Should I grade it?" — sourced AU costs, your odds and your graded-sale prices.
function gradeModal() {
  const c = state.current, m = currentAud(), saved = loadJSON('hw:grade', { grader: 'psa-jtoys', customs: 0, batchN: 1, custom: 0 });
  const k = m != null ? C.calc(m, state.calc) : null;
  const cen = state.centering?.id === c.id ? state.centering : null;
  const rows = [['10', 'PSA 10 / BGS 9.5+'], ['9', 'PSA 9'], ['8', 'PSA 8 or lower']];
  openModal(`<h3>Should I grade it? <span class="chip conv">Estimate</span></h3>
    <p class="meta">${esc(c.name)} · raw market ${aud(m)}${k ? ` · you'd net about ${aud(k.sellNet)} selling raw (your fee settings)` : ''}</p>
    ${cen ? `<p class="meta">Your centering check: L/R ${cen.lr} · T/B ${cen.tb} → best not ruled out PSA ${cen.caps.psa} (${esc(cen.conf)} confidence).</p>` : ''}
    <label class="meta" style="display:grid;gap:4px">Grading route (published AU prices, checked ${SE.FEES_CHECKED})<select id="gR">${SE.GRADERS.map(g => `<option value="${g.id}" ${g.id === saved.grader ? 'selected' : ''}>${esc(g.name)}${g.fee ? ` · A$${g.fee}${g.gst ? ' + GST' : ''}` : ''}</option>`).join('')}</select></label>
    <p class="meta" id="gNote"></p>
    <div class="grid2"><label>Your all-in quote A$ (custom)<input id="gCustom" type="number" min="0" step="1" value="${saved.custom || ''}"></label>
      <label>Customs/duty per card A$ (often 3–12)<input id="gCus" type="number" min="0" step="1" value="${saved.customs}"></label>
      <label>Cards sharing return post<input id="gN" type="number" min="1" step="1" value="${saved.batchN}"></label>
      <label>Raw net if you sell now A$<input id="gRaw" type="number" min="0" step="0.5" value="${k ? k.sellNet.toFixed(2) : ''}"></label></div>
    <h4 style="margin:12px 0 4px">Your odds and graded prices</h4>
    <p class="meta">Only you can judge the card in hand. Check graded sold prices: ${rows.map(([g]) => `<a target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c, { graded: true, grade: g === '8' ? 'PSA 8' : 'PSA ' + g }))}">PSA ${g} sold ↗</a>`).join(' · ')}</p>
    <table class="gtab"><thead><tr><th>Outcome</th><th>Chance %</th><th>Sells for A$</th></tr></thead><tbody>
      ${rows.map(([g, n]) => `<tr><td>${n}</td><td><input type="number" min="0" max="100" step="5" data-p="${g}" inputmode="decimal"></td><td><input type="number" min="0" step="1" data-v="${g}" inputmode="decimal"></td></tr>`).join('')}</tbody></table>
    <div id="gOut"></div>
    <p class="meta">Graded sale assumes your selling fee (${state.calc.feePct}%). Turnaround is weeks to months; values can move meanwhile. Not financial advice.</p>
    <div class="row-gap"><button class="btn ghost" id="gX">Close</button></div>`, box => {
    const q = s => box.querySelector(s);
    const run = () => {
      const g = SE.GRADERS.find(x => x.id === q('#gR').value) || SE.GRADERS[0];
      const custom = parseFloat(q('#gCustom').value) || 0;
      q('#gNote').innerHTML = `${esc(g.note)}${g.src ? ` <a href="${esc(g.src)}" target="_blank" rel="noopener">source</a>` : ''}`;
      const cost = g.id === 'custom' ? custom + (parseFloat(q('#gCus').value) || 0) : SE.gradingCost(g, { customs: parseFloat(q('#gCus').value) || 0, cardsInBatch: parseInt(q('#gN').value, 10) || 1 });
      localStorage.setItem('hw:grade', JSON.stringify({ grader: g.id, customs: parseFloat(q('#gCus').value) || 0, batchN: parseInt(q('#gN').value, 10) || 1, custom }));
      const outcomes = rows.map(([gr, n]) => ({ grade: n, p: parseFloat(q(`[data-p="${gr}"]`).value) || 0, value: parseFloat(q(`[data-v="${gr}"]`).value) || 0 }));
      const raw = parseFloat(q('#gRaw').value) || 0;
      const r = SE.gradeEV({ outcomes, cost, rawNet: raw, sellPct: 100 - state.calc.feePct });
      const out = q('#gOut');
      if (!r) { out.innerHTML = `<p class="meta">Cost to grade: <b>${aud(cost)}</b> per card. Enter your chances and the graded sale prices to see if it pays.</p>`; return; }
      if (r.missing) { out.innerHTML = `<p class="meta">Cost to grade: <b>${aud(cost)}</b>. Add a sale price for each outcome you gave a chance to.</p>`; return; }
      out.innerHTML = `<div class="verdict ${r.worth ? 'good' : 'bad'}"><div class="vl">${r.worth ? 'Grading looks worth it' : 'Selling raw looks better'}</div>
        <div>Expected graded net ${aud(r.ev)} − grading ${aud(cost)} = ${r.ev - cost < 0 ? '−' : ''}${aud(Math.abs(r.ev - cost))} vs ${aud(raw)} raw · ${r.gain >= 0 ? '+' : '−'}${aud(Math.abs(r.gain))} expected</div>
        <div class="meta">Breakeven: graded copies need to sell for about ${aud(r.breakeven)} on average.${r.probTotal !== 100 ? ` Your chances add to ${r.probTotal}%, so they were scaled to 100%.` : ''} Estimate from your inputs, not financial advice.</div></div>`;
    };
    box.querySelectorAll('input,select').forEach(i => i.addEventListener('input', run)); q('#gR').onchange = run;
    q('#gX').onclick = closeModal; run();
  });
}

// Where to sell in Australia — net proceeds per channel.
function sellModal() {
  const c = state.current, m = currentAud(), s = loadJSON('hw:sell', { lgsPct: 50, showPct: 75, postCharged: null, showTable: 0, showCards: 0 });
  openModal(`<h3>Where to sell (AU) <span class="chip conv">Estimate</span></h3>
    <p class="meta">${esc(c.name)} · selling at ${m != null ? '' : 'a price you enter'}</p>
    <div class="grid2"><label>Sale price A$<input id="sP" type="number" min="0" step="0.5" value="${m != null ? m.toFixed(2) : ''}"></label>
      <label>Your postage cost A$<input id="sPo" type="number" min="0" step="0.1" value="${state.calc.fixedCost}"></label>
      <label>Postage you charge A$<input id="sPc" type="number" min="0" step="0.1" value="${s.postCharged ?? state.calc.fixedCost}"></label>
      <label>Store buylist % of market<input id="sL" type="number" min="0" max="100" step="5" value="${s.lgsPct}"></label>
      <label>Card show: % of market you get<input id="sS" type="number" min="0" max="100" step="5" value="${s.showPct}"></label>
      <label>Show table fee A$ (blank = sell to a dealer)<input id="sT" type="number" min="0" step="5" value="${s.showTable || ''}"></label>
      <label>Cards you sell per show<input id="sN" type="number" min="0" step="1" value="${s.showCards || ''}"></label></div>
    <div id="sOut"></div>
    <p class="meta">eBay and Facebook rules checked ${SE.FEES_CHECKED}. Store and show percentages are <b>your</b> assumptions. Ignores payment-transfer fees, tax and your time. Not financial advice.</p>
    ${affNote()}
    <div class="row-gap"><a class="btn small ghost" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c))}">eBay AU sold ↗</a><button class="btn ghost" id="sX">Close</button></div>`, box => {
    const q = s2 => box.querySelector(s2), n = s2 => parseFloat(q(s2).value);
    const run = () => {
      const price = n('#sP'); const o = { postage: n('#sPo') || 0, postCharged: isNaN(n('#sPc')) ? null : n('#sPc'), lgsPct: n('#sL') || 0, showPct: n('#sS') || 0, showTable: n('#sT') || 0, showCards: n('#sN') || 0 };
      localStorage.setItem('hw:sell', JSON.stringify(o));
      if (!(price > 0)) { q('#sOut').innerHTML = '<p class="meta">Enter a sale price.</p>'; return; }
      const list = SE.channels(price, o).sort((a, b) => b.net - a.net);
      q('#sOut').innerHTML = `<table class="chtab"><thead><tr><th>Channel</th><th>Fees</th><th>You keep</th></tr></thead><tbody>${list.map(x => `<tr class="${x.best ? 'best' : ''}"><td><b>${esc(x.name)}</b>${x.best ? ' <span class="tag hold">Best</span>' : ''}<div class="meta">${esc(x.note)}${x.src ? ` <a href="${esc(x.src)}" target="_blank" rel="noopener">source</a>` : ''}</div></td><td>${aud(x.fee)}</td><td><b>${aud(x.net)}</b></td></tr>`).join('')}</tbody></table>`;
    };
    box.querySelectorAll('input').forEach(i => i.addEventListener('input', run)); q('#sX').onclick = closeModal; run();
  });
}

// Trade calculator — two piles, priced from the app (or by hand).
state.trade = loadJSON('hw:trade', { mine: [], theirs: [] });
const saveTrade = () => localStorage.setItem('hw:trade', JSON.stringify(state.trade));
function addToTrade(side, card, a) {
  if (!card) return;
  state.trade[side].push({ uid: Date.now() + Math.random().toString(36).slice(2, 5), name: card.name, set: card.setName || '', number: card.number || '', thumb: card.thumb || card.image || '', aud: a ?? null, qty: 1 });
  saveTrade();
}
function tradeModal() {
  openModal(`<h3>Trade check <span class="chip conv">Estimate</span></h3><div id="trBody"></div>`, box => {
    const draw = async () => {
      const t = SE.tradeTotals(state.trade.mine, state.trade.theirs);
      const pile = (side, title) => `<div class="pile"><div class="row-between"><b>${title}</b><span>${aud(t[side])}</span></div><ul class="list mini">${state.trade[side].map(x => `<li><img alt="" src="${esc(x.thumb)}"><div><div class="t">${esc(x.name)}</div><div class="s">${esc(x.set)} ${esc(x.number)}</div></div><div class="r"><input type="number" min="0" step="0.5" value="${x.aud != null ? x.aud.toFixed(2) : ''}" data-side="${side}" data-uid="${x.uid}" aria-label="Value A$"><button class="btn icon ghost" data-del="${side}:${x.uid}" aria-label="Remove">✕</button></div></li>`).join('') || '<li class="empty">Nothing yet</li>'}</ul>
        <div class="row-gap wrap"><button class="btn small ghost" data-add="${side}">＋ From collection</button><button class="btn small ghost" data-man="${side}">＋ By hand</button>${state.current ? `<button class="btn small ghost" data-cur="${side}">＋ ${esc(state.current.name.slice(0, 18))}</button>` : ''}</div></div>`;
      const fav = t.favours === 'even' ? 'Even trade' : t.favours === 'you' ? `You gain about ${aud(Math.abs(t.diff))}` : `You give up about ${aud(Math.abs(t.diff))}`;
      box.querySelector('#trBody').innerHTML = `${pile('mine', 'You give')}${pile('theirs', 'You get')}
        <div class="verdict ${t.favours === 'them' && t.fairPct < 90 ? 'bad' : t.fairPct >= 95 || t.favours === 'you' ? 'good' : 'warn'}"><div class="vl">${fav}</div><div>Fairness ${t.fairPct ?? '—'}% (smaller side ÷ bigger side)${t.unpriced ? ` · ${t.unpriced} card${t.unpriced > 1 ? 's' : ''} without a value` : ''}</div>
        <div class="meta">Uses the converted market values shown in Holowise (or what you type). Condition, language and graded copies change real values. Not financial advice.</div></div>
        <div class="row-gap"><button class="btn small ghost" id="trClear">Clear</button><button class="btn ghost" id="trX">Close</button></div>`;
      box.querySelectorAll('input[data-uid]').forEach(i => i.onchange = () => { const x = state.trade[i.dataset.side].find(y => y.uid === i.dataset.uid); if (x) { x.aud = parseFloat(i.value) || null; saveTrade(); draw(); } });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const [s, u] = b.dataset.del.split(':'); state.trade[s] = state.trade[s].filter(y => y.uid !== u); saveTrade(); draw(); });
      box.querySelectorAll('[data-cur]').forEach(b => b.onclick = () => { addToTrade(b.dataset.cur, state.current, currentAud()); draw(); });
      box.querySelectorAll('[data-man]').forEach(b => b.onclick = () => { const nm = prompt('Card name'); if (!nm) return; const v = parseFloat(prompt('Value A$') || ''); addToTrade(b.dataset.man, { name: nm }, v > 0 ? v : null); draw(); });
      box.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
        const items = (await DB.all('collection').catch(() => [])).sort((x, y) => (y.lastAud || 0) - (x.lastAud || 0));
        if (!items.length) { toast('Your collection is empty'); return; }
        const side = b.dataset.add, holder = document.createElement('div'); holder.className = 'pickl';
        holder.innerHTML = `<select size="6" style="width:100%">${items.map((x, i) => `<option value="${i}">${esc(x.name)} · ${esc(x.number)} · ${aud(x.manualAud ?? x.lastAud)}</option>`).join('')}</select>`;
        b.parentElement.after(holder);
        holder.querySelector('select').onchange = e => { const x = items[+e.target.value]; addToTrade(side, x, x.manualAud ?? x.lastAud); draw(); };
      });
      box.querySelector('#trClear').onclick = () => { state.trade = { mine: [], theirs: [] }; saveTrade(); draw(); };
      box.querySelector('#trX').onclick = closeModal;
    };
    draw();
  });
}

// ---------- hands-free (glasses-ready) mode ----------
const HF = { on: false, rec: null, last: '', listening: false };
function speak(text) {
  HF.last = text; const hud = $('#hudSay'); if (hud) hud.textContent = text;
  try { const s = window.speechSynthesis; if (!s) return; s.cancel(); const u = new SpeechSynthesisUtterance(text);
    const v = s.getVoices().find(x => /en-AU/i.test(x.lang)) || s.getVoices().find(x => /^en/i.test(x.lang)); if (v) u.voice = v; u.lang = v?.lang || 'en-AU'; u.rate = 1.05; s.speak(u); } catch {}
}
function hudCard() {
  const c = state.current; if (!c) return;
  const m = currentAud(), k = m != null ? C.calc(m, state.calc) : null, a = parseFloat(state.asking);
  const v = a > 0 && m != null ? dealVerdict(m, a, state.calc) : null;
  $('#hudName').textContent = c.name; $('#hudSub').textContent = `${c.setName || ''} · ${c.number || ''}`;
  $('#hudPrice').textContent = m != null ? aud(m) : 'No price'; $('#hudBuy').textContent = k ? `Max buy ${aud(k.buyMax)}` : '';
  $('#hudVerdict').textContent = v ? `${v.label} at ${aud(a)}` : 'Say "deal 50" with the asking price';
  $('#hudVerdict').className = 'hv ' + (v?.tone || '');
  const sig = state.lastAn?.ok ? state.lastAn.signal : null;
  return spokenCard({ name: c.name, number: c.number, aud: m, buyMax: k?.buyMax ?? null, verdict: v ? { label: v.label, short: `asking ${Math.round(a)}` } : null, signal: sig });
}
function hfAnnounce() { if (!HF.on) return; const t = hudCard(); if (t) speak(t); }
function setHandsFree(on) {
  if (on && !gate('handsfree')) return;
  HF.on = on; $('#chipHF').setAttribute('aria-pressed', on); $('#hud').hidden = !on; document.body.classList.toggle('hf', on);
  if (on) {
    if (!state.prefs.auto && state.stream) setAuto(true);
    if (state.current) hudCard();
    speak('Hands-free on. Show me a card. Say scan, deal and a price, add, watch, repeat, next, or stop.');
    startListening();
  } else { stopListening(); try { speechSynthesis.cancel(); } catch {} }
}
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $('#hudMic').textContent = SR ? '🎙 listening…' : '⌨ voice not supported here: type commands below';
  if (!SR || HF.rec) return;
  try {
    const r = new SR(); r.lang = 'en-AU'; r.continuous = true; r.interimResults = false;
    r.onresult = e => { const t = e.results[e.results.length - 1][0].transcript; runCommand(t); };
    r.onend = () => { HF.rec = null; if (HF.on) setTimeout(startListening, 400); };
    r.onerror = e => { if (e.error === 'not-allowed') { $('#hudMic').textContent = '⌨ microphone blocked: type commands below'; HF.on && (HF.denied = true); } };
    if (HF.denied) return; r.start(); HF.rec = r;
  } catch {}
}
function stopListening() { try { HF.rec?.stop(); } catch {} HF.rec = null; }
async function runCommand(text) {
  const c = parseCommand(text); $('#hudHeard').textContent = `“${text}”`;
  if (!c) { speak('Sorry, I didn\u2019t get that. Say help for commands.'); return; }
  haptic(8);
  switch (c.cmd) {
    case 'scan': if (state.stream) $('#scanBtn').click(); else speak('Camera is off. Tap start camera.'); break;
    case 'deal': state.asking = String(c.value); if ($('#dealAsk')) $('#dealAsk').value = state.asking; renderDeal(); {
      const m = currentAud(); if (m == null) { speak('No card or price yet.'); break; }
      const v = dealVerdict(m, c.value, state.calc); hudCard(); speak(`${v.label}. Asking ${Math.round(c.value)}, market about ${Math.round(m)}, max buy ${Math.round(v.buyMax)}.`); } break;
    case 'add': if (!state.current) { speak('Scan a card first.'); break; } if (await quickAdd(state.current)) speak(`Added ${state.current.name} to your collection.`); break;
    case 'watch': if (!state.current) { speak('Scan a card first.'); break; } if (await quickWatch(state.current)) speak(`Watching ${state.current.name}.`); break;
    case 'repeat': speak(HF.last || 'Nothing yet.'); break;
    case 'next': state.autoPaused = false; closeSheet(); speak('Ready. Show the next card.'); break;
    case 'batch': setBatch(!state.prefs.batch); speak(`Batch ${state.prefs.batch ? 'on' : 'off'}.`); break;
    case 'sell': { const m = currentAud(); if (m == null) { speak('No price yet.'); break; } const s = loadJSON('hw:sell', { lgsPct: 50, showPct: 75 }); const b = SE.channels(m, { postage: state.calc.fixedCost, ...s }).sort((x, y) => y.net - x.net)[0]; speak(`Best: ${b.name}, you keep about ${Math.round(b.net)} dollars. Estimate.`); break; }
    case 'grade': speak('Open grade it on the card screen to enter your odds.'); break;
    case 'help': speak('Say scan. Deal, then the asking price. Add. Watch. Sell. Repeat. Next. Batch. Or stop.'); break;
    case 'stop': setHandsFree(false); toast('Hands-free off'); break;
  }
}
async function quickAdd(card) {
  const n = (await DB.all('collection').catch(() => [])).length;
  if (n >= PL.limit('collection', plan())) { upgradeModal(); return false; }
  const p = card.prices?.[state.priceIdx]; const usable = p && !p.au && p.source !== 'ximilar' ? p : card.prices?.find(x => !x.au && x.source !== 'ximilar');
  await DB.put('collection', collectionItem(card, { priceLabel: usable?.label || '', lastPrice: usable?.value ?? null, currency: usable?.currency || '', lastAud: usable ? C.toAUD(usable.value, usable.currency, state.fx) : null, buyAud: parseFloat(state.asking) > 0 ? parseFloat(state.asking) : null }));
  toast(`Added ${card.name}`); return true;
}
async function quickWatch(card) {
  const ws = await DB.all('watchlist').catch(() => []);
  if (!ws.some(w => w.key === wKey(card)) && ws.length >= PL.limit('watchlist', plan())) { upgradeModal(); return false; }
  const m = currentAud(), p = card.prices?.find(x => !x.au && x.source !== 'ximilar');
  await DB.put('watchlist', { key: wKey(card), ...cardRef(card), addedAt: Date.now(), priceLabel: p?.label || '', lastPrice: p?.value ?? null, currency: p?.currency || '', lastAud: m, lastAt: Date.now(), priceLog: p ? [{ d: today(), v: p.value }] : [], jt: null, sig: null, alerted: {}, targetBuy: m ? Math.floor(m * 0.85) : null, targetSell: m ? Math.ceil(m * 1.2) : null });
  updateBadge(); toast(`Watching ${card.name}`); return true;
}
$('#chipHF').onclick = () => { haptic(); setHandsFree(!HF.on); };
$('#hudForm').onsubmit = e => { e.preventDefault(); const i = $('#hudCmd'); if (i.value.trim()) runCommand(i.value.trim()); i.value = ''; };
$('#hudCard').onclick = () => { if (state.current) openSheet(); };
$('#hudOff').onclick = () => setHandsFree(false);
$('#chipTrade').onclick = () => { if (gate('trade')) tradeModal(); };
$('#planPill').onclick = () => upgradeModal();
$('#planUp').onclick = () => upgradeModal();

// ---------- offline show mode ----------
const packKey = c => `pack:${c.game}:${c.id}`;
let PACK = null;
async function loadPack() { if (PACK) return PACK; const kv = await DB.all('kv').catch(() => []); PACK = new Map(kv.filter(x => x.k.startsWith('pack:')).map(x => [x.k, x.v])); return PACK; }
async function packLookup(p) {
  const pk = await loadPack(); const all = [...pk.values()].map(x => x.card);
  if (p.opCode) return all.filter(c => c.game === 'onepiece' && (c.code || c.number || '').toUpperCase() === p.opCode.toUpperCase());
  const num = String(parseInt(p.pkNumber.number, 10));
  return all.filter(c => c.game === 'pokemon' && String(parseInt(c.number, 10)) === num && (!p.pkNumber.total || !c.setTotal || +c.setTotal === +p.pkNumber.total));
}
async function packFull(card) { const pk = await loadPack(); const x = pk.get(packKey(card)); if (!x) return null; if (!state.fx && x.fx) state.fx = x.fx; return { ...x.card, offlineAt: x.at }; }
async function downloadPack() {
  if (!gate('show')) return;
  const out = $('#packMsg'); const items = [...await DB.all('collection').catch(() => []), ...await DB.all('watchlist').catch(() => [])];
  const seen = new Set(), list = items.filter(c => c.id && !seen.has(packKey(c)) && seen.add(packKey(c)));
  if (!list.length) { out.textContent = 'Add cards to your Collection or Watchlist first: the pack holds those.'; return; }
  let done = 0, failed = 0; $('#packBtn').disabled = true;
  loadOCR(0).catch(() => {}); loadOCR(1).catch(() => {}); // keeps the OCR engine and language data in the browser cache
  for (const c of list) {
    out.textContent = `Saving ${done + 1} of ${list.length}…`;
    try { const full = await getFull(c); const card = { ...cardRef(full), prices: full.prices.filter(p => !p.au) }; // AU (TCG Prices AU) prices are never stored offline
      await DB.kvSet(packKey(c), { card, at: Date.now(), fx: state.fx }); if (card.image) fetch(card.image, { mode: 'no-cors' }).catch(() => {}); done++; }
    catch { failed++; }
  }
  PACK = null; await loadPack(); await DB.kvSet('packAt', Date.now());
  $('#packBtn').disabled = false; out.textContent = `Offline pack ready: ${done} card${done === 1 ? '' : 's'} saved ${when(Date.now())}${failed ? ` · ${failed} failed` : ''}. Prices are frozen at this time.`; toast('Show mode pack saved');
}
async function clearPack() { const pk = await loadPack(); for (const k of pk.keys()) await DB.del('kv', k).catch(() => {}); await DB.del('kv', 'packAt').catch(() => {}); PACK = null; $('#packMsg').textContent = 'Offline pack cleared.'; }
async function renderPack() { const pk = await loadPack(), at = await DB.kvGet('packAt'); const m = $('#packMsg'); if (m && !m.dataset.busy) m.textContent = pk.size ? `${pk.size} cards saved for offline use · ${when(at)}` : 'No offline pack yet.'; $('#packLock').innerHTML = lockIco('show'); }
$('#packBtn').onclick = () => downloadPack();
$('#packClear').onclick = () => clearPack();
const netState = () => { const off = !navigator.onLine; $('#offPill').hidden = !off; document.body.classList.toggle('offline', off); };
addEventListener('online', netState); addEventListener('offline', netState);

// ---------- dealer: buy-offer sheet for walk-up sellers ----------
$('#bOfferSheet').onclick = () => {
  if (!state.batch.length) { toast('Scan some cards first'); return; }
  if (PL.TIERS[plan().tier] < PL.TIERS.dealer) { upgradeModal('batchBig'); return; }
  const rows = state.batch.map(it => ({ it, offer: it.aud ? C.calc(it.aud, state.calc).buyMax * (it.qty || 1) : null }));
  const tot = rows.reduce((s, r) => s + (r.offer || 0), 0);
  openModal(`<h3>Buy offer</h3><p class="meta">${day(Date.now())} · offers from your margin settings (${state.calc.marginPct}% target).</p>
    <table class="chtab"><thead><tr><th>Card</th><th>Qty</th><th>Offer</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.it.ref.name)}<div class="meta">${esc(r.it.ref.setName)} ${esc(r.it.ref.number)}</div></td><td>${r.it.qty}</td><td>${r.offer != null ? aud(r.offer) : '—'}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td><b>Total offer</b></td><td></td><td><b>${aud(tot)}</b></td></tr></tfoot></table>
    <p class="meta">Based on converted market estimates. Not financial advice.</p><div class="row-gap"><button class="btn" id="ofPrint">Print / save PDF</button><button class="btn ghost" id="ofX">Close</button></div>`, box => {
    box.querySelector('#ofX').onclick = closeModal; box.querySelector('#ofPrint').onclick = () => window.print();
  });
};

// ---------- init ----------
(async function init() {
  applyTheme(); setMode(state.mode);
  $$('#gameSeg button').forEach(b => b.onclick = () => { haptic(6); setMode(b.dataset.mode); });
  $('#chipAuto').setAttribute('aria-pressed', !!state.prefs.auto); $('#chipDeal').setAttribute('aria-pressed', !!state.prefs.deal);
  $('#chipBatch').setAttribute('aria-pressed', !!state.prefs.batch); $('#batchPanel').hidden = !state.prefs.batch;
  try { const s = await DB.get('sessions', 'current'); if (s?.items) state.batch = s.items; } catch {}
  renderBatch(); renderSettings(); netState(); recheckLicence();
  const h0 = (location.hash || '#scan').slice(1);
  showView(h0, { push: false });
  if (/^(plans|licen[cs]e|upgrade)$/.test(h0)) setTimeout(() => { upgradeModal(); const d = $('#modalBox details'); if (d && h0 !== 'plans') d.open = true; }, 300);
  if (!localStorage.getItem('hw:onboarded')) showOnboarding();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=7').catch(() => {});
  await migrate();
  updateBadge();
  setTimeout(() => { if (PL.has('alerts', plan()) && navigator.onLine) refreshWatch({ auto: true }); if (navigator.onLine) refreshCollection({ auto: true }); }, 1500);
  C.tcgdexSets().catch(() => {});
})();
