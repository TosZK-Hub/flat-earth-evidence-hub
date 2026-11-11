import * as C from './core.js?v=3';
import { readCardV2, readNameV2, makeTools } from './ocr.js?v=3';
import * as X from './ximilar.js?v=3';
import { ebaySoldUrl, auSoldPrice, auQuery } from './au.js?v=3';
import * as HI from './history.js?v=3';
import * as S from './signal.js?v=3';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const aud = n => (n == null || isNaN(n)) ? '—' : 'A$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt = (n, cur) => (cur === 'EUR' ? '€' : cur === 'USD' ? 'US$' : '') + (+n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = d => { if (!d) return 'unknown date'; const x = new Date(d); return isNaN(x) ? String(d) : x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' }); };

const state = {
  mode: localStorage.getItem('cl:mode') || 'auto',
  calc: { ...C.DEFAULT_CALC, ...JSON.parse(localStorage.getItem('cl:calc') || '{}') },
  stream: null, busy: false, autoTimer: null, autoPaused: false,
  current: null, priceIdx: 0, fx: null,
  sig: { ...S.DEFAULT_SIGNAL, ...JSON.parse(localStorage.getItem('cl:sig') || '{}') }, hist: null, range: localStorage.getItem('cl:range') || '90', histSeries: 0,
  settings: { ximToken: '', ximSlab: true, ximPrices: true, auProxy: '', jtKey: '', ...JSON.parse(localStorage.getItem('cl:settings') || '{}') }
};
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
let validTotals = null; C.validPokemonTotals().then(v => { validTotals = v; });

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
    w._cur = { psm: '11', wl: '' };
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

async function recognize(canvas, { psm = '11', whitelist = '' } = {}) {
  const w = await loadOCR();
  if (w._cur.psm !== psm || w._cur.wl !== whitelist) { await w.setParameters({ tessedit_pageseg_mode: psm, tessedit_char_whitelist: whitelist }); w._cur = { psm, wl: whitelist }; }
  const { data } = await w.recognize(canvas); return data.text || '';
}

// Glare check: share of blown-out pixels in the number bands (bottom 13% of the card)
function glareRatio(r) {
  const T = makeTools(mkCanvas); const g = T.gray(T.crop(r, 0.86, 1, 0, 1, { scale: 1, maxW: 400 }));
  let n = 0; for (const v of g.y) if (v > 245) n++; return n / g.y.length;
}

async function validateParse(p, names, isOP) {
  const list = p.opCode ? await C.onePieceByCode(p.opCode) : await C.pokemonByNumber(p.pkNumber.number, p.pkNumber.total, names);
  return { list, strong: list.length > 0 && (names.length ? list.some(x => C.nameMatches(x.name, names)) : !p.guessed) };
}

async function scanFrom(rect, label = 'Reading card…') {
  if (state.busy) return; state.busy = true;
  $('#frame').classList.add('busy'); $('#scanBtn').disabled = true;
  const log = [];
  try {
    // 1) Ximilar image recognition (primary, if the user has added a token)
    if (state.settings.ximToken) {
      status('Identifying with Ximilar…');
      try {
        const b64 = X.cardJpegBase64(rect, { mkCanvas });
        const json = await X.ximilarIdentify(b64, state.settings.ximToken, { slab: state.settings.ximSlab, priceStats: state.settings.ximPrices });
        const parsed = X.parseXimilar(json);
        log.push('[ximilar] ' + (parsed.card?.best?.full_name || parsed.error || 'no card found') + (parsed.slab ? ` · slab ${parsed.slab.company} ${parsed.slab.grade}` : ''));
        const list = await X.ximilarToCandidates(parsed);
        if (list.length) {
          $('#ocrText').textContent = log.join('\n');
          status(`Ximilar: ${parsed.card.best.full_name}${parsed.slab ? ` · graded ${parsed.slab.company} ${parsed.slab.grade}` : ''}. Tap another if it's wrong.`);
          showCands(list, 'ximilar', true); select(list[0]);
          return;
        }
        status('Ximilar found no card. Falling back to on-device OCR…');
      } catch (e) {
        log.push('[ximilar] ' + e.message);
        status((e.status === 401 ? 'Ximilar token not accepted. ' : 'Ximilar unavailable. ') + 'Using on-device OCR…');
        console.warn(e);
      }
    }
    // 2) On-device OCR (free fallback)
    const glare = glareRatio(rect);
    if (glare > 0.04) log.push(`[glare] ${(glare * 100).toFixed(0)}% of the number area is blown out`);
    status('Loading OCR (first time only)…'); await loadOCR();
    status(label);
    const t0 = performance.now();
    const isOPmode = state.mode === 'onepiece';
    // read the name first: it's used to confirm number reads (stops false matches like 51/198 vs 81/198)
    let nm = await readNameV2(rect, { recognize, mkCanvas, isOP: isOPmode });
    const res = await readCardV2(rect, { recognize, mkCanvas, mode: state.mode, onStep: status, validTotals,
      validate: p => validateParse(p, (p.opCode && !isOPmode) ? [] : nm.names, !!p.opCode) });
    let isOP = !!res.best?.opCode || isOPmode;
    if (isOP && !isOPmode) { nm = await readNameV2(rect, { recognize, mkCanvas, isOP: true }); }
    log.push(res.text, `[name] ${nm.text.replace(/\s+/g, ' ').trim()}`, `best: ${res.best ? (res.best.opCode || res.best.pkNumber.raw) + (res.strong ? ' (name agrees)' : ' (unconfirmed)') : 'none'} · ${res.calls} OCR passes · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
    $('#ocrText').textContent = log.join('\n');
    await identify(res, nm.names, isOP, glare);
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
      const q = state.settings.ximToken ? { best: glareRatio(r) < 0.04 ? {} : null } // with Ximilar: fire when the card is steady-ish and glare-free
        : await readCardV2(r, { recognize, mkCanvas, mode: state.mode, quick: true, validTotals });
      if (q.best) {
        $('#frame').classList.add('hit'); setTimeout(() => $('#frame').classList.remove('hit'), 800);
        state.busy = false; state.autoPaused = true; // pause until the user taps Scan or picks a card
        await scanFrom(r, 'Card spotted, reading…');
      } else status(state.settings.ximToken ? 'Auto-scan: glare on the card. Tilt it slightly.' : 'Auto-scan: looking for the collector number…');
    } catch (e) { status('Auto-scan error: ' + e.message); }
    finally { state.busy = false; $('#frame').classList.remove('busy'); }
  }
  state.autoTimer = setTimeout(autoTick, state.settings.ximToken ? 2500 : 1200);
}

// ---------- identify + candidates ----------
async function identify(res, names, isOP, glare = 0) {
  let list = [], how = '';
  const best = res.best;
  if (best) {
    const key = best.opCode || `${best.pkNumber.number}/${best.pkNumber.total}`;
    $('#qNum').value = key; $('#qName').value = names[0] || '';
    if (res.strong) { list = best.list; how = `${best.opCode ? 'code' : 'number'} ${key}`; }
    else { // unconfirmed: show everything the number reads matched, so the right card is likely in the grid
      const seen = new Set(); list = res.tried.flatMap(t => t.list || []).filter(c => !seen.has(c.id) && seen.add(c.id));
      how = `${best.opCode ? 'code' : 'number'} ${key} (name not confirmed, so check the card)`;
    }
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
  const glareMsg = glare > 0.04 ? ' Glare on the number: tilt the card or move away from the light.' : '';
  if (!list.length) { status('No match.' + glareMsg + ' Try again closer and flatter, or type it in Search.'); showCands([], ''); return; }
  const byNumber = !how.startsWith('name');
  status(`${list.length} match${list.length > 1 ? 'es' : ''} by ${how}.${byNumber && list.length > 1 ? ' Showing the best one; tap another if it\'s wrong.' : ''}${glareMsg}`);
  showCands(list, how, byNumber);
  if (list.length === 1 || (byNumber && list.length <= 12)) select(list[0]);
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
    const [full0, fx] = await Promise.all([card.game === 'pokemon' ? C.pokemonDetails(card) : card, C.fxRates().catch(() => null)]);
    const full = { ...full0, ximilar: card.ximilar, ximStats: card.ximStats, slab: card.slab, prices: [...(full0.prices || [])] };
    if (card.prices?.some(p => p.source === 'ximilar') && !full.prices.some(p => p.source === 'ximilar')) full.prices.push(...card.prices.filter(p => p.source === 'ximilar'));
    full.auNote = '';
    if (state.settings.auProxy && full.game === 'pokemon') {
      try { const au = await auSoldPrice(state.settings.auProxy, full, { graded: !!full.slab }); if (au) full.prices.unshift(au); else full.auNote = 'No recent AU sales found for this card.'; }
      catch (e) { full.auNote = 'AU sold prices unavailable: ' + e.message; }
    }
    state.current = full; state.fx = fx;
    // default to the highest-confidence source: TCGplayer market (USD) if present, otherwise first
    state.priceIdx = 0;
    renderDetail();
    try { HI.logToday(full, full.prices); } catch {}
    loadHistory(full);
    det.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) { det.innerHTML = `<p class="warn">Couldn't load this card: ${esc(e.message)}. The free API may be busy, so try again in a moment.</p>`; }
}

function renderDetail() {
  const c = state.current, fx = state.fx, det = $('#detail');
  const p = c.prices[state.priceIdx];
  const audVal = p ? (p.au ? p.value : (fx ? C.toAUD(p.value, p.currency, fx) : null)) : null;
  const k = audVal != null ? C.calc(audVal, state.calc) : null; // calculator works on either AU sales or the converted estimate
  const isAU = !!p?.au;
  const slab = c.slab;
  det.innerHTML = `
    <div class="det-head">
      <img src="${esc(c.image || c.thumb || '')}" alt="${esc(c.name)}">
      <div>
        <h3>${esc(c.name)}</h3>
        <div class="meta">${esc(c.setName || '')} · #${esc(c.number || '')}${c.setTotal ? '/' + c.setTotal : ''}${c.rarity ? ' · ' + esc(c.rarity) : ''}</div>
        <div class="meta">${c.game === 'onepiece' ? 'One Piece TCG' : 'Pokémon TCG'} · data: ${esc(c.source)}</div>
        ${p ? `
          ${isAU ? `
          <div class="price-big"><span class="aud">${aud(p.value)}</span></div>
          <div><span class="chip au">AU sales</span> <span class="meta">eBay Australia sold listings</span></div>
          <div class="src">${esc(p.label)} · range ${aud(p.low)}–${aud(p.high)} · checked ${day(p.updated)} · <a href="${esc(p.attribution)}" target="_blank" rel="noopener">Prices from TCG Prices AU</a></div>` : `
          <div class="price-big">${fmt(p.value, p.currency)} <small>${esc(p.currency)}</small></div>
          <div><span class="aud">${aud(audVal)}</span><span class="est">AUD estimate only</span> <span class="chip conv">Converted, not AU sales</span></div>
          <div class="src">${esc(p.label)} · price updated ${day(p.updated)}${fx ? ` · FX 1 ${esc(p.currency)} = ${fx[p.currency]?.toFixed(4)} AUD (${esc(fx.source)}, ${day(fx.date)})` : ' · FX unavailable'}</div>`}
        ` : `<p class="warn">No price data from the free sources for this card. I won't guess. Check the sold listings below.</p>`}
        ${c.auNote ? `<div class="src">${esc(c.auNote)}</div>` : ''}
      </div>
    </div>
    ${slab ? `<div class="slab"><b>Graded slab detected:</b> ${esc(slab.company)} ${esc(slab.grade)}${slab.verbal ? ' (' + esc(slab.verbal) + ')' : ''}${slab.cert ? ` · cert ${slab.certLink ? `<a href="${esc(slab.certLink)}" target="_blank" rel="noopener">${esc(slab.cert)}</a>` : esc(slab.cert)}` : ''}<br><span class="meta">Raw-card prices below do not apply to a graded copy. Use the graded sold link${state.settings.auProxy ? ' or the AU graded price' : ''}.</span></div>` : ''}
    ${c.ximilar ? `<div class="src">Identified by Ximilar: ${esc(c.ximilar.fullName || '')}${c.ximilar.foil ? ' · ' + esc(c.ximilar.foil) : ''}${c.ximilar.rank ? ' · alternative #' + c.ximilar.rank : ''}</div>` : ''}
    ${c.ximStats?.length ? `<div class="xstats"><div class="meta">Ximilar sold stats (currency not stated by Ximilar; treat as indicative):</div>${c.ximStats.map(x => `<div>${esc(x.type)}: median ${x.median ?? '—'} · ${x.volume ?? 0} sales · last ${esc(x.latestDate || '—')}${x.daysToSell ? ` · ~${x.daysToSell} days to sell` : ''}</div>`).join('')}</div>` : ''}
    ${c.prices.length > 1 ? `<label class="meta" style="display:block;margin-top:12px">Price source / variant
      <select id="priceSel">${c.prices.map((x, i) => `<option value="${i}" ${i === state.priceIdx ? 'selected' : ''}>${x.au ? '[AU sales] ' : '[converted] '}${esc(x.label)}: ${x.au ? aud(x.value) : fmt(x.value, x.currency)}</option>`).join('')}</select></label>` : ''}
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
    <section id="histBox" class="histbox"></section>
    <div class="links">
      ${p ? '<button class="btn primary" id="saveBtn">Save to My scans</button>' : ''}
      <a class="btn ghost" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c))}">eBay AU sold · raw ↗</a>
      <a class="btn ghost" target="_blank" rel="noopener" href="${esc(ebaySoldUrl(c, { graded: true, grade: slab ? `${slab.company} ${slab.grade}`.trim() : '' }))}">eBay AU sold · ${slab ? esc(`${slab.company} ${slab.grade}`) : 'graded'} ↗</a>
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
  renderHistory();
}

function calcNote(k) {
  return `Market ${aud(k.marketAUD)} minus ${state.calc.feePct}% fees${state.calc.fixedCost ? ` and A$${(+state.calc.fixedCost).toFixed(2)} postage` : ''} = ${aud(k.sellNet)} net. Buying at ${aud(k.buyMax)} leaves about ${aud(k.profitAtBuy)} (${state.calc.marginPct}%) before your time and risk.`;
}

// ---------- price history + keep/sell ----------
const COLORS = { main: '#5cc8ff', extra: '#8a93b8', auRaw: '#3ad29f', auGraded: '#ffb84d', auMedian: '#3ad29f' };
async function loadHistory(card) {
  const h = state.hist = { id: card.id, loading: true, series: [], graded: [], momentum: null, snapshot: [], au: null, notes: [] };
  state.histSeries = 0; renderHistory();
  const st = state.settings, jobs = [];
  if (card.game === 'onepiece') jobs.push(HI.opTwoWeeks(card).then(s => { if (s) h.series.push(s); else h.notes.push('OPTCG API has no two-week history for this variant.'); }).catch(e => h.notes.push('OPTCG history unavailable: ' + e.message)));
  if (card.game === 'pokemon') {
    h.momentum = S.windowsMomentum(card.pricing?.cardmarket); if (h.momentum) h.momentum.updated = card.pricing.cardmarket.updated;
    h.snapshot = HI.tcgplayerSnapshot(card.pricing);
  }
  if (st.jtKey) jobs.push(HI.justTcgHistory(card, st.jtKey).then(list => { if (list.length) h.series.unshift(...list); else h.notes.push('JustTCG found no history for this card.'); }).catch(e => h.notes.push('JustTCG unavailable: ' + (e.status === 401 || e.status === 403 ? 'key rejected' : e.message))));
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
  if (p.au) { // TCG Prices AU terms: no storing their data beyond 24 h, so save the converted price instead
    const alt = c.prices.find(x => !x.au); if (!alt) { status('AU sale prices are not saved (data terms).'); return; }
    p = alt; audVal = C.toAUD(alt.value, alt.currency, state.fx);
  }
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

// ---------- settings ----------
function renderSettings() {
  const st = state.settings;
  $('#sTok').value = st.ximToken; $('#sSlab').checked = st.ximSlab; $('#sXP').checked = st.ximPrices; $('#sProxy').value = st.auProxy; $('#sJt').value = st.jtKey || '';
  $('#ximState').textContent = st.ximToken ? 'Ximilar: on (primary). OCR is the fallback.' : 'Ximilar: off. Using free on-device OCR.';
}
$('#settingsForm').onsubmit = e => {
  e.preventDefault();
  const proxy = $('#sProxy').value.trim();
  if (proxy && !/^https:\/\//.test(proxy)) { $('#sMsg').textContent = 'Proxy URL must start with https://'; return; }
  state.settings = { ximToken: $('#sTok').value.trim().replace(/^token\s+/i, ''), ximSlab: $('#sSlab').checked, ximPrices: $('#sXP').checked, auProxy: proxy, jtKey: $('#sJt').value.trim() };
  localStorage.setItem('cl:settings', JSON.stringify(state.settings));
  $('#sMsg').textContent = 'Saved on this device only.'; renderSettings();
};
$('#sClear').onclick = () => { localStorage.removeItem('cl:settings'); state.settings = { ximToken: '', ximSlab: true, ximPrices: true, auProxy: '', jtKey: '' }; renderSettings(); $('#sMsg').textContent = 'Cleared.'; };
$('#sShow').onclick = () => { const i = $('#sTok'); i.type = i.type === 'password' ? 'text' : 'password'; };
$('#sTest').onclick = async () => {
  const tok = $('#sTok').value.trim(); if (!tok) { $('#sMsg').textContent = 'Paste a token first.'; return; }
  $('#sMsg').textContent = 'Testing Ximilar…';
  try { // tiny blank image: checks the token and plan access without identifying anything useful
    const c = mkCanvas(64, 90); const g = c.getContext('2d'); g.fillStyle = '#888'; g.fillRect(0, 0, 64, 90);
    await X.ximilarIdentify(c.toDataURL('image/jpeg', 0.6).split(',')[1], tok, { priceStats: false });
    $('#sMsg').textContent = 'Ximilar accepted the token ✓';
  } catch (e) { $('#sMsg').textContent = e.message; }
};
renderSettings();

// ---------- PWA ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js?v=3').catch(() => {});
// warm caches in the background
C.tcgdexSets().catch(() => {}); C.fxRates().catch(() => {});
