import * as C from './core.js?v=1';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const aud = n => (n == null || isNaN(n)) ? '—' : 'A$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, cur) => (cur === 'EUR' ? '€' : cur === 'USD' ? 'US$' : '') + (+n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = d => { if (!d) return 'unknown date'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' }); };

const state = {
  mode: localStorage.getItem('cl:mode') || 'auto',
  calc: { ...C.DEFAULT_CALC, ...JSON.parse(localStorage.getItem('cl:calc') || '{}') },
  stream: null, busy: false, autoTimer: null, autoPaused: false,
  current: null, priceIdx: 0, fx: null
};

// ---------- mode ----------
function setMode(m) {
  state.mode = m; localStorage.setItem('cl:mode', m);
  document.querySelectorAll('.seg button').forEach(b => { const on = b.dataset.mode === m; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
  $('#qNum').placeholder = m === 'onepiece' ? 'OP05-119 / ST01-001' : m === 'pokemon' ? '199/165 or 199' : '199/165 or OP05-119';
}
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
setMode(state.mode);

const status = t => { $('#status').textContent = t || ''; };

// ---------- camera ----------
async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) { status('Camera not available here. Use Photo or Search.'); return; }
  if (!isSecureContext) { status('Camera needs HTTPS.'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } } });
    state.stream = stream;
    const v = $('#video'); v.srcObject = stream; await v.play().catch(() => {});
    const track = stream.getVideoTracks()[0];
    try { // continuous focus where supported (mostly Android Chrome)
      const caps = track.getCapabilities?.() || {};
      if (caps.focusMode?.includes('continuous')) await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
    } catch {}
    $('#camOff').hidden = true; $('#camOff').style.display = 'none';
    $('#scanBtn').disabled = false;
    const s = track.getSettings?.() || {};
    status(`Camera ${s.width || v.videoWidth}×${s.height || v.videoHeight}. Line the card up in the frame.`);
    loadOCR().catch(() => {});
  } catch (e) {
    status('Camera blocked: ' + (e.message || e.name) + '. Use Photo or Search.');
  }
}
$('#startCam').onclick = startCamera;
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAuto(); });

// ---------- OCR ----------
let workerP = null;
function loadOCR() {
  if (workerP) return workerP;
  workerP = (async () => {
    for (let i = 0; i < 50 && !window.Tesseract; i++) await new Promise(r => setTimeout(r, 100));
    if (!window.Tesseract) throw new Error('OCR library failed to load (check your connection).');
    const w = await Tesseract.createWorker('eng');
    await w.setParameters({ tessedit_pageseg_mode: '11' }); // sparse text: finds small bits of text anywhere in the band
    return w;
  })();
  workerP.catch(() => { workerP = null; });
  return workerP;
}

// Map the on-screen frame to video pixel coordinates (video uses object-fit: cover).
function frameRectInVideo() {
  const v = $('#video'), cam = $('#cam').getBoundingClientRect(), f = $('#frame').getBoundingClientRect();
  const vw = v.videoWidth, vh = v.videoHeight;
  const scale = Math.max(cam.width / vw, cam.height / vh);
  const ox = (cam.width - vw * scale) / 2, oy = (cam.height - vh * scale) / 2;
  return { src: v, x: (f.left - cam.left - ox) / scale, y: (f.top - cam.top - oy) / scale, w: f.width / scale, h: f.height / scale };
}

// For a still photo: assume the card fills most of the picture; take the largest centred card-shaped area.
function cardRectInImage(img) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  let w = W * 0.96, h = w * 88 / 63;
  if (h > H * 0.96) { h = H * 0.96; w = h * 63 / 88; }
  return { src: img, x: (W - w) / 2, y: (H - h) / 2, w, h };
}

// Crop a band of the card, greyscale, upscale, stretch contrast, optionally invert.
function band(r, top, bottom, left, right, { scale = 3, invert = false, maxW = 1800 } = {}) {
  const sx = r.x + r.w * left, sy = r.y + r.h * top, sw = r.w * (right - left), sh = r.h * (bottom - top);
  let k = scale; if (sw * k > maxW) k = maxW / sw; if (k < 1) k = 1;
  const c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high';
  g.drawImage(r.src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Uint32Array(256);
  for (let i = 0; i < p.length; i += 4) { const y = (p[i] * 299 + p[i + 1] * 587 + p[i + 2] * 114) / 1000 | 0; p[i] = y; hist[y]++; }
  const n = p.length / 4; let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > n * 0.01) break; }
  acc = 0; for (; hi > 0; hi--) { acc += hist[hi]; if (acc > n * 0.01) break; }
  const span = Math.max(hi - lo, 1);
  for (let i = 0; i < p.length; i += 4) { let y = (p[i] - lo) * 255 / span; y = y < 0 ? 0 : y > 255 ? 255 : y; if (invert) y = 255 - y; p[i] = p[i + 1] = p[i + 2] = y; }
  g.putImageData(d, 0, 0);
  return c;
}

async function ocr(canvas) { const w = await loadOCR(); const { data } = await w.recognize(canvas); return data.text || ''; }

// quick=true: only the number bands (used by auto-scan to decide if a card is readable)
async function readCard(r, { quick = false } = {}) {
  const out = { num: '', top: '', mid: '' };
  const BL = [0.885, 0.99, 0, 0.5], BR = [0.885, 0.99, 0.5, 1];
  out.num = (await ocr(band(r, ...BL))) + '\n' + (await ocr(band(r, ...BR)));
  let parsed = C.parseOCR(out.num, state.mode);
  if (!parsed.opCode && !parsed.pkNumber && !quick) {
    status('Trying inverted contrast…');
    out.num += '\n' + (await ocr(band(r, ...BL, { invert: true }))) + '\n' + (await ocr(band(r, ...BR, { invert: true })));
    parsed = C.parseOCR(out.num, state.mode);
  }
  if (quick) return { out, parsed };
  const isOP = state.mode === 'onepiece' || (state.mode === 'auto' && parsed.opCode);
  if (isOP) out.mid = await ocr(band(r, 0.78, 0.9, 0.08, 0.92, { scale: 2 }));
  else out.top = await ocr(band(r, 0.0, 0.12, 0, 1, { scale: 2 }));
  return { out, parsed, isOP };
}

async function scanFrom(rect, label = 'Reading card…') {
  if (state.busy) return; state.busy = true;
  $('#frame').classList.add('busy'); $('#scanBtn').disabled = true;
  try {
    status('Loading OCR (first time only)…'); await loadOCR();
    status(label);
    const t0 = performance.now();
    const { out, parsed, isOP } = await readCard(rect);
    $('#ocrText').textContent = `[bottom bands]\n${out.num.trim()}\n\n[name band]\n${(out.top || out.mid).trim()}\n\nparsed: ${JSON.stringify(parsed)}  (${((performance.now() - t0) / 1000).toFixed(1)}s)`;
    await identify(parsed, C.parseNameWords(isOP ? out.mid : out.top), isOP);
  } catch (e) { status('Scan failed: ' + e.message); console.error(e); }
  finally { state.busy = false; $('#frame').classList.remove('busy'); $('#scanBtn').disabled = !state.stream; }
}

$('#scanBtn').onclick = () => { if (state.stream) { state.autoPaused = false; scanFrom(frameRectInVideo()); } };

$('#photoIn').onchange = async e => {
  const f = e.target.files?.[0]; if (!f) return;
  const img = new Image(); img.src = URL.createObjectURL(f);
  await img.decode().catch(() => {});
  await scanFrom(cardRectInImage(img), 'Reading photo…');
  URL.revokeObjectURL(img.src); e.target.value = '';
};

// ---------- auto-scan ----------
function stopAuto() { clearTimeout(state.autoTimer); state.autoTimer = null; $('#auto').checked = false; }
$('#auto').onchange = e => {
  if (!e.target.checked) return stopAuto();
  if (!state.stream) { e.target.checked = false; status('Start the camera first.'); return; }
  state.autoPaused = false; autoTick();
};
async function autoTick() {
  if (!$('#auto').checked) return;
  if (!state.busy && !state.autoPaused && state.stream) {
    state.busy = true; $('#frame').classList.add('busy');
    try {
      await loadOCR();
      const r = frameRectInVideo();
      const { parsed } = await readCard(r, { quick: true });
      if (parsed.opCode || parsed.pkNumber) {
        $('#frame').classList.add('hit'); setTimeout(() => $('#frame').classList.remove('hit'), 800);
        state.busy = false; state.autoPaused = true; // pause until the user taps Scan or picks a card
        await scanFrom(r, 'Card spotted, reading…');
      } else status('Auto-scan: looking for the collector number…');
    } catch (e) { status('Auto-scan error: ' + e.message); }
    finally { state.busy = false; $('#frame').classList.remove('busy'); }
  }
  state.autoTimer = setTimeout(autoTick, 1200);
}

// ---------- identify + candidates ----------
async function identify(parsed, names, isOP) {
  let list = [], how = '';
  if (parsed.opCode && state.mode !== 'pokemon') {
    $('#qNum').value = parsed.opCode; $('#qName').value = '';
    status(`Read ${parsed.opCode}. Looking it up…`);
    list = await C.onePieceByCode(parsed.opCode); how = `code ${parsed.opCode}`;
  } else if (parsed.pkNumber && state.mode !== 'onepiece') {
    const { number, total } = parsed.pkNumber;
    $('#qNum').value = `${number}/${total}`; $('#qName').value = names[0] || '';
    status(`Read ${number}/${total}. Looking it up…`);
    list = await C.pokemonByNumber(number, total, names); how = `number ${number}/${total}`;
  }
  if (!list.length && names.length) {
    status(`Couldn't read a number. Searching by name…`);
    let used = names[0];
    if (isOP || state.mode === 'onepiece') { for (const n of names.slice(0, 3)) { list = await C.onePieceSearch(n); if (list.length) { used = n; break; } } }
    else list = await C.pokemonFuzzySearch(names);
    if (list.length && !isOP && state.mode !== 'onepiece') used = list[0].name;
    $('#qName').value = used;
    how = `name "${used}" (number not read, so check the set and variant)`;
  }
  if (!list.length) { status('No match. Try again closer and flatter, or type it in Search.'); showCands([], ''); return; }
  const byNumber = !how.startsWith('name');
  status(`${list.length} match${list.length > 1 ? 'es' : ''} by ${how}.${byNumber && list.length > 1 ? ' Showing the best one; tap another if it\'s wrong.' : ''}`);
  showCands(list, how, byNumber);
  if (list.length === 1 || (byNumber && list.length <= 6)) select(list[0]);
}

function showCands(list, how, preselect = false) {
  $('#detail').hidden = true; state.current = null;
  $('#candPanel').hidden = !list.length;
  $('#candTitle').textContent = list.length === 1 ? 'Match' : `Is it one of these? (${list.length})`;
  const box = $('#cands'); box.innerHTML = '';
  list.slice(0, 30).forEach(c => {
    const b = document.createElement('button'); b.className = 'cand'; b.type = 'button';
    b.innerHTML = `<img loading="lazy" alt="" src="${esc(c.thumb || '')}"><div class="n">${esc(c.name)}</div><div class="m">${esc(c.setName || c.id)} · ${esc(c.number || '')}${c.rarity ? ' · ' + esc(c.rarity) : ''}</div>`;
    b.onclick = () => { box.querySelectorAll('.cand').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); select(c); };
    box.appendChild(b);
  });
  if (preselect) box.querySelector('.cand')?.classList.add('sel');
  else if (list.length > 1) $('#candPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function select(card) {
  const det = $('#detail'); det.hidden = false; det.innerHTML = '<p class="meta">Loading prices…</p>';
  try {
    const [full, fx] = await Promise.all([card.game === 'pokemon' ? C.pokemonDetails(card) : card, C.fxRates().catch(() => null)]);
    state.current = full; state.fx = fx;
    // default to the highest-confidence source: TCGplayer market (USD) if present, otherwise first
    state.priceIdx = 0;
    renderDetail();
    det.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { det.innerHTML = `<p class="warn">Couldn't load this card: ${esc(e.message)}. The free API may be busy, so try again in a moment.</p>`; }
}

function renderDetail() {
  const c = state.current, fx = state.fx, det = $('#detail');
  const p = c.prices[state.priceIdx];
  const audVal = p && fx ? C.toAUD(p.value, p.currency, fx) : null;
  const k = audVal != null ? C.calc(audVal, state.calc) : null;
  const ebayQ = encodeURIComponent(c.game === 'onepiece' ? `${c.code} ${c.name.replace(/\(.*?\)/g, '')}` : `${c.name} ${c.number}${c.setTotal ? '/' + c.setTotal : ''} ${c.setName || ''}`);
  det.innerHTML = `
    <div class="det-head">
      <img src="${esc(c.image || c.thumb || '')}" alt="${esc(c.name)}">
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="meta">${esc(c.setName || '')} · #${esc(c.number || '')}${c.setTotal ? '/' + c.setTotal : ''}${c.rarity ? ' · ' + esc(c.rarity) : ''}</div>
        <div class="meta">${c.game === 'onepiece' ? 'One Piece TCG' : 'Pokémon TCG'} · data: ${esc(c.source)}</div>
        ${p ? `
          <div class="price-big">${fmt(p.value, p.currency)} <small>${esc(p.currency)}</small></div>
          <div><span class="aud">${aud(audVal)}</span><span class="est">AUD estimate only</span></div>
          <div class="src">${esc(p.label)} · price updated ${day(p.updated)}${fx ? ` · FX 1 ${esc(p.currency)} = ${fx[p.currency]?.toFixed(4)} AUD (${esc(fx.source)}, ${day(fx.date)})` : ' · FX unavailable'}</div>
        ` : `<p class="warn">No price data from the free sources for this card. I won't guess. Check the sold listings below.</p>`}
      </div>
    </div>
    ${c.prices.length > 1 ? `<label class="meta" style="display:block;margin-top:12px">Price source / variant
      <select id="priceSel">${c.prices.map((x, i) => `<option value="${i}" ${i === state.priceIdx ? 'selected' : ''}>${esc(x.label)}: ${fmt(x.value, x.currency)}</option>`).join('')}</select></label>` : ''}
    ${k ? `
    <div class="calc">
      <label>Selling fees %<input id="cFee" type="number" inputmode="decimal" step="0.5" min="0" max="100" value="${state.calc.feePct}"></label>
      <label>Postage/fixed A$<input id="cFix" type="number" inputmode="decimal" step="0.5" min="0" value="${state.calc.fixedCost}"></label>
      <label>Target margin %<input id="cMar" type="number" inputmode="decimal" step="1" min="0" max="100" value="${state.calc.marginPct}"></label>
    </div>
    <div class="out">
      <div class="sell"><div class="k">Suggested sell (net after fees)</div><div class="v" id="oSell">${aud(k.sellNet)}</div></div>
      <div class="buy"><div class="k">Suggested max buy</div><div class="v" id="oBuy">${aud(k.buyMax)}</div></div>
    </div>
    <p class="note" id="oNote">${calcNote(k)}</p>` : ''}
    <p class="warn">Prices are for the variant and condition shown in the source (usually near-mint, raw, English). Graded slabs, Japanese prints, alt arts and damaged cards can be worth far more or less. Confirm the exact card and check AU sold prices. Not financial advice.</p>
    <div class="links">
      ${p ? '<button class="btn primary" id="saveBtn">Save to My scans</button>' : ''}
      <a class="btn ghost" target="_blank" rel="noopener" href="https://www.ebay.com.au/sch/i.html?_nkw=${ebayQ}&LH_Sold=1&LH_Complete=1">eBay AU sold ↗</a>
      ${state.stream ? '<button class="btn ghost" id="nextBtn">Scan next</button>' : ''}
    </div>`;
  $('#priceSel')?.addEventListener('change', e => { state.priceIdx = +e.target.value; renderDetail(); });
  ['#cFee', '#cFix', '#cMar'].forEach(id => $(id)?.addEventListener('input', () => {
    state.calc = { feePct: +$('#cFee').value, fixedCost: +$('#cFix').value, marginPct: +$('#cMar').value };
    localStorage.setItem('cl:calc', JSON.stringify(state.calc));
    const k2 = C.calc(audVal, state.calc);
    $('#oSell').textContent = aud(k2.sellNet); $('#oBuy').textContent = aud(k2.buyMax); $('#oNote').innerHTML = calcNote(k2);
  }));
  $('#saveBtn')?.addEventListener('click', () => { saveScan(c, p, audVal); $('#saveBtn').textContent = 'Saved ✓'; $('#saveBtn').disabled = true; });
  $('#nextBtn')?.addEventListener('click', () => { state.autoPaused = false; window.scrollTo({ top: 0, behavior: 'smooth' }); status('Ready for the next card.'); });
}

function calcNote(k) {
  return `Market ${aud(k.marketAUD)} minus ${state.calc.feePct}% fees${state.calc.fixedCost ? ` and A$${(+state.calc.fixedCost).toFixed(2)} postage` : ''} = ${aud(k.sellNet)} net. Buying at ${aud(k.buyMax)} leaves about ${aud(k.profitAtBuy)} (${state.calc.marginPct}%) before your time and risk.`;
}

// ---------- manual search ----------
$('#searchForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#qName').value.trim(), num = $('#qNum').value.trim();
  if (!name && !num) return;
  status('Searching…'); $('#candPanel').hidden = true;
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
    status(list.length ? `${list.length} result${list.length > 1 ? 's' : ''}.` : 'No results. Check spelling, or try just the name.');
    showCands(list, 'search');
    if (list.length === 1) select(list[0]);
  } catch (err) { status('Search failed: ' + err.message + '. The free API may be busy, so try again.'); }
};

// ---------- history ----------
const H_KEY = 'cl:history';
const getHist = () => { try { return JSON.parse(localStorage.getItem(H_KEY)) || []; } catch { return []; } };
const setHist = h => { localStorage.setItem(H_KEY, JSON.stringify(h)); renderHist(); };
function saveScan(c, p, audVal) {
  const h = getHist();
  h.unshift({ id: c.id, game: c.game, name: c.name, set: c.setName || '', number: c.number || '', thumb: c.thumb || c.image || '', label: p.label, value: p.value, currency: p.currency, aud: audVal, fxDate: state.fx?.date || '', ts: new Date().toISOString() });
  setHist(h.slice(0, 500));
}
function renderHist() {
  const h = getHist(), ul = $('#hist');
  ul.innerHTML = h.length ? '' : '<li class="empty">No saved scans yet.</li>';
  h.forEach((x, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<img alt="" src="${esc(x.thumb)}"><div><b>${esc(x.name)}</b><div class="meta">${esc(x.set)} · ${esc(x.number)}</div></div><div>${aud(x.aud)}</div><button class="x" aria-label="Remove">×</button>`;
    li.querySelector('.x').onclick = () => { const a = getHist(); a.splice(i, 1); setHist(a); };
    ul.appendChild(li);
  });
  const tot = h.reduce((s, x) => s + (x.aud || 0), 0);
  $('#histTotal').textContent = h.length ? `${h.length} cards · ${aud(tot)} est.` : '';
}
$('#clearHist').onclick = () => { if (confirm('Clear all saved scans?')) setHist([]); };
$('#exportCsv').onclick = () => {
  const h = getHist(); if (!h.length) return;
  const cols = ['ts', 'game', 'name', 'set', 'number', 'label', 'value', 'currency', 'aud', 'fxDate', 'id'];
  const csv = [cols.join(',')].concat(h.map(x => cols.map(k => `"${String(x[k] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'cardlens-scans.csv'; a.click();
};
renderHist();

// ---------- PWA ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
// warm caches in the background
C.tcgdexSets().catch(() => {}); C.fxRates().catch(() => {});
