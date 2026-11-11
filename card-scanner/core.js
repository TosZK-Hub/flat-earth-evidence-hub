// CardLens AU — core logic (parsing, lookup, pricing). Runs in browser and Node 18+.
export const TCGDEX = 'https://api.tcgdex.net/v2/en';
export const PTCG = 'https://api.pokemontcg.io/v2';
export const OPTCG = 'https://optcgapi.com/api';
export const FX = 'https://api.frankfurter.dev/v1/latest';

const store = (typeof localStorage !== 'undefined') ? localStorage : null;
const mem = new Map();

async function getJSON(url, { retries = 0, timeout = 12000 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeout);
    try {
      const r = await fetch(url, { signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
      return await r.json();
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (i < retries) await new Promise(res => setTimeout(res, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

function cached(key, ttlMs, fn) {
  const now = Date.now();
  if (mem.has(key)) { const v = mem.get(key); if (now - v.t < ttlMs) return Promise.resolve(v.d); }
  if (store) {
    try { const v = JSON.parse(store.getItem('cl:' + key)); if (v && now - v.t < ttlMs) { mem.set(key, v); return Promise.resolve(v.d); } } catch {}
  }
  return fn().then(d => {
    const v = { t: now, d }; mem.set(key, v);
    if (store) { try { store.setItem('cl:' + key, JSON.stringify(v)); } catch {} }
    return d;
  });
}

// ---------- OCR text parsing ----------
export function parseOnePieceCode(text) {
  if (!text) return null;
  const t = text.toUpperCase().replace(/[|]/g, 'I').replace(/\b0P/g, 'OP').replace(/\bS7/g, 'ST');
  let m = t.match(/\b(OP|ST|EB|PRB)\s?[-–]?\s?([0-9OIL]{2})\s?[-–]\s?([0-9OIL]{3})\b/);
  if (m) {
    const fix = s => s.replace(/O/g, '0').replace(/[IL]/g, '1');
    return `${m[1]}${fix(m[2])}-${fix(m[3])}`;
  }
  m = t.match(/\bP\s?[-–]\s?(\d{3})\b/);
  if (m) return `P-${m[1]}`;
  m = t.match(/\b(\d{2})\s?[-–]\s?(\d{3})\b/);
  if (m && +m[1] >= 1 && +m[1] <= 20) return `OP${m[1]}-${m[2]}`; // guess: set prefix lost by OCR
  return null;
}

export function parsePokemonNumber(text) {
  if (!text) return null;
  const t = text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[Il|](?=\d{2}\b)/g, '1');
  // e.g. 199/165, 025/198, 4/102
  const re = /(\d{1,3})\s*[\/⁄\\]\s*(\d{2,3})(?!\d)/g;
  let best = null, m;
  while ((m = re.exec(t))) {
    const num = parseInt(m[1], 10), total = parseInt(m[2], 10);
    if (total < 10 || num === 0) continue;
    if (num > total * 2.2) continue; // implausible
    best = { number: String(num), total, raw: m[0] };
  }
  return best;
}

const STOP = new Set(['BASIC', 'STAGE', 'STAGE1', 'STAGE2', 'HP', 'EX', 'GX', 'VMAX', 'VSTAR', 'TRAINER', 'ITEM', 'SUPPORTER',
  'EVOLVES', 'FROM', 'POKEMON', 'POKÉMON', 'ENERGY', 'TERA', 'STADIUM', 'TOOL', 'THE', 'AND', 'PUT', 'CARD', 'LEADER', 'CHARACTER', 'EVENT', 'LIFE']);
export function parseNameWords(text) {
  if (!text) return [];
  // drop "Evolves from X" / "Put X on the Stage..." which name the previous evolution, not this card
  const t = text.replace(/evolves\s+from\s+\S+/gi, ' ').replace(/put\s+\S+\s+on\s+the\s+\S+/gi, ' ');
  const words = (t.match(/[A-Za-zÀ-ÿ'’.-]{3,}/g) || [])
    .map(w => w.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '').replace(/(VMAX|VSTAR|V|GX|EX)$/,''))
    .filter(w => w.length >= 3 && !STOP.has(w.toUpperCase()) && /[aeiouy]/i.test(w));
  // keep reading order but put Capitalised words (real names) first
  const caps = words.filter(w => /^[A-Z][a-zà-ÿ'’.-]{2,}/.test(w));            // Charizard
  const lower = words.filter(w => /^[a-zà-ÿ'’.-]{5,}$/.test(w));               // harizard (first letter lost)
  const rest = words.filter(w => w.length >= 5);
  return [...new Set([...caps, ...lower, ...rest])].slice(0, 4);
}

export function parseOCR(text, mode = 'auto') {
  const op = (mode === 'pokemon') ? null : parseOnePieceCode(text);
  const pk = (mode === 'onepiece') ? null : parsePokemonNumber(text);
  return { opCode: op, pkNumber: pk };
}

// ---------- Pokémon lookup (TCGdex primary, pokemontcg.io fallback) ----------
export function tcgdexSets() {
  return cached('tcgdex-sets', 7 * 864e5, () => getJSON(`${TCGDEX}/sets`, { retries: 2 }));
}

function pad3(n) { return String(n).padStart(3, '0'); }

export async function tcgdexCard(id) {
  return cached('tcgdex-card:' + id, 6 * 36e5, () => getJSON(`${TCGDEX}/cards/${encodeURIComponent(id)}`, { retries: 1 }));
}

export function normPokemonFromTcgdex(c) {
  if (!c) return null;
  return {
    game: 'pokemon', id: c.id, name: c.name, number: c.localId,
    setName: c.set?.name, setTotal: c.set?.cardCount?.official, rarity: c.rarity || '',
    image: c.image ? c.image + '/high.webp' : null, thumb: c.image ? c.image + '/low.webp' : null,
    prices: pricesFromTcgdex(c.pricing), pricing: c.pricing || null, source: 'TCGdex'
  };
}

export function pricesFromTcgdex(p) {
  const out = [];
  if (!p) return out;
  const tp = p.tcgplayer;
  if (tp) {
    for (const [k, v] of Object.entries(tp)) {
      if (!v || typeof v !== 'object') continue;
      const val = v.marketPrice ?? v.midPrice;
      if (val) out.push({ label: `TCGplayer market · ${k}`, value: val, currency: 'USD', updated: tp.updated, low: v.lowPrice, high: v.highPrice });
    }
  }
  const cm = p.cardmarket;
  if (cm) {
    if (cm.trend) out.push({ label: 'Cardmarket trend', value: cm.trend, currency: 'EUR', updated: cm.updated, low: cm.low });
    if (cm.avg30) out.push({ label: 'Cardmarket 30-day avg', value: cm.avg30, currency: 'EUR', updated: cm.updated });
    if (cm['trend-holo']) out.push({ label: 'Cardmarket trend · holo', value: cm['trend-holo'], currency: 'EUR', updated: cm.updated });
  }
  return out;
}

export function pricesFromPtcg(c) {
  const out = [];
  const tp = c.tcgplayer;
  if (tp?.prices) for (const [k, v] of Object.entries(tp.prices)) {
    const val = v.market ?? v.mid; if (val) out.push({ label: `TCGplayer market · ${k}`, value: val, currency: 'USD', updated: tp.updatedAt, low: v.low, high: v.high });
  }
  const cm = c.cardmarket;
  if (cm?.prices) {
    if (cm.prices.trendPrice) out.push({ label: 'Cardmarket trend', value: cm.prices.trendPrice, currency: 'EUR', updated: cm.updatedAt, low: cm.prices.lowPrice });
    if (cm.prices.avg30) out.push({ label: 'Cardmarket 30-day avg', value: cm.prices.avg30, currency: 'EUR', updated: cm.updatedAt });
  }
  return out;
}

// Same shape as TCGdex "pricing" so history.js / signal.js can read either source.
export function pricingFromPtcg(c) {
  const cm = c.cardmarket?.prices, tp = c.tcgplayer?.prices;
  const out = {};
  if (cm) out.cardmarket = { unit: 'EUR', updated: c.cardmarket.updatedAt ? c.cardmarket.updatedAt.replace(/\//g, '-') : null, avg: cm.averageSellPrice, low: cm.lowPrice, trend: cm.trendPrice,
    avg1: cm.avg1, avg7: cm.avg7, avg30: cm.avg30, 'avg1-holo': cm.reverseHoloAvg1, 'avg7-holo': cm.reverseHoloAvg7, 'avg30-holo': cm.reverseHoloAvg30, 'trend-holo': cm.reverseHoloTrend };
  if (tp) { out.tcgplayer = { unit: 'USD', updated: c.tcgplayer.updatedAt ? c.tcgplayer.updatedAt.replace(/\//g, '-') : null };
    for (const [k, v] of Object.entries(tp)) out.tcgplayer[k.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()] = { lowPrice: v.low, midPrice: v.mid, highPrice: v.high, marketPrice: v.market }; }
  return out;
}

function normPokemonFromPtcg(c) {
  return {
    pricing: pricingFromPtcg(c),
    game: 'pokemon', id: c.id, name: c.name, number: c.number, setName: c.set?.name, setTotal: c.set?.printedTotal,
    rarity: c.rarity || '', image: c.images?.large, thumb: c.images?.small, prices: pricesFromPtcg(c), source: 'Pokémon TCG API'
  };
}

// Find candidates from collector number + printed total (+ optional name words)
export async function pokemonByNumber(number, total, nameWords = []) {
  const results = [];
  try {
    const sets = await tcgdexSets();
    const matches = sets.filter(s => s.cardCount?.official === total);
    const ids = [];
    for (const s of matches) { ids.push(`${s.id}-${number}`); if (pad3(number) !== String(number)) ids.push(`${s.id}-${pad3(number)}`); }
    const cards = await Promise.all(ids.map(id => tcgdexCard(id).catch(() => null)));
    for (const c of cards) if (c) results.push(normPokemonFromTcgdex(c));
  } catch (e) { console.warn('TCGdex failed', e); }
  if (!results.length) {
    try {
      const q = `number:${number} set.printedTotal:${total}`;
      const d = await getJSON(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=12`, { retries: 3 });
      for (const c of d?.data || []) results.push(normPokemonFromPtcg(c));
    } catch (e) { console.warn('pokemontcg.io failed', e); }
  }
  return rankByName(results, nameWords, await setIndex());
}

let setOrder = null, setNames = new Map();
async function setIndex() {
  if (!setOrder) { try { const sets = await tcgdexSets(); setOrder = new Map(sets.map((s, i) => [s.id, i])); setNames = new Map(sets.map(s => [s.id, s.name])); } catch { setOrder = new Map(); } }
  return setOrder;
}
function setIdOf(cardId) { const i = cardId.lastIndexOf('-'); return i > 0 ? cardId.slice(0, i) : cardId; }

function rankByName(list, words, order = new Map()) {
  const hit = (name, w) => { name = name.toLowerCase(); w = w.toLowerCase();
    return [w, w.slice(1), w.slice(0, -1), w.slice(1, -1)].some((v, i) => (i === 0 || v.length >= 4) && name.includes(v)); };
  const score = c => (words || []).reduce((s, w) => s + (hit(c.name, w) ? 1 : 0), 0);
  const rec = c => order.get(setIdOf(c.id)) ?? -1; // newer sets first on ties
  return list.map(c => ({ c, s: score(c), r: rec(c) })).sort((a, b) => (b.s - a.s) || (b.r - a.r)).map(x => x.c);
}

// Name search (manual or OCR fallback). Returns lightweight results; call pokemonDetails for prices.
export async function pokemonSearch(name, number = '') {
  name = name.trim();
  if (!name && !number) return [];
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  if (number) params.set('localId', number);
  params.set('pagination:itemsPerPage', '250');
  try {
    const list = await getJSON(`${TCGDEX}/cards?${params}`, { retries: 1 });
    if (list?.length) {
      const order = await setIndex();
      const q = name.toLowerCase();
      const scored = list.map(c => ({ c, s: (c.name.toLowerCase() === q ? 2 : c.name.toLowerCase().startsWith(q) ? 1 : 0), r: order.get(setIdOf(c.id)) ?? -1 }))
        .sort((a, b) => (b.s - a.s) || (b.r - a.r)).slice(0, 30).map(x => x.c);
      return scored.map(c => ({ game: 'pokemon', id: c.id, name: c.name, number: c.localId, setName: setNames.get(setIdOf(c.id)), thumb: c.image ? c.image + '/low.webp' : null, image: c.image ? c.image + '/high.webp' : null, partial: true, source: 'TCGdex' }));
    }
    if (Array.isArray(list)) return [];
  } catch (e) { console.warn('TCGdex search failed', e); }
  const q = [name ? `name:"${name.replace(/"/g, '')}*"` : '', number ? `number:${number}` : ''].filter(Boolean).join(' ');
  const d = await getJSON(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=30&orderBy=-set.releaseDate`, { retries: 3 });
  return (d?.data || []).map(normPokemonFromPtcg);
}

// OCR names are often missing a first/last letter ("ikachu", "NolcanionV"): try trimmed variants.
export async function pokemonFuzzySearch(word) {
  if (Array.isArray(word)) { for (const w of word.slice(0, 3)) { const r = await pokemonFuzzySearch(w); if (r.length) return r; } return []; }
  const v = [word, ...[word.slice(1), word.slice(0, -1), word.slice(1, -1), word.slice(2), word.slice(0, -2)].filter(x => x.length >= 4)];
  for (const w of [...new Set(v)]) { const r = await pokemonSearch(w); if (r.length) return r; }
  return [];
}

export async function pokemonDetails(card) {
  if (!card.partial) return card;
  const c = await tcgdexCard(card.id);
  const n = normPokemonFromTcgdex(c);
  if (n && !n.prices.length) {
    // fallback: try pokemontcg.io by name+number for prices
    try {
      const q = `name:"${n.name.replace(/"/g, '')}" number:${parseInt(n.number, 10) || n.number}` + (n.setTotal ? ` set.printedTotal:${n.setTotal}` : '');
      const d = await getJSON(`${PTCG}/cards?q=${encodeURIComponent(q)}&pageSize=3`, { retries: 2 });
      const hit = d?.data?.[0]; if (hit) { n.prices = pricesFromPtcg(hit); n.pricing = pricingFromPtcg(hit); n.source = 'TCGdex + Pokémon TCG API'; }
    } catch {}
  }
  return n;
}

// ---------- One Piece (OPTCG API) ----------
function normOP(c) {
  return {
    game: 'onepiece', id: c.card_image_id, code: c.card_set_id, name: c.card_name, number: c.card_set_id,
    setName: c.set_name, rarity: c.rarity || '', image: c.card_image, thumb: c.card_image,
    prices: c.market_price ? [{ label: 'Market price (TCGplayer, via OPTCG API)', value: c.market_price, currency: 'USD', updated: c.date_scraped, low: c.inventory_price }] : [],
    source: 'OPTCG API'
  };
}

export async function onePieceByCode(code) {
  code = code.toUpperCase();
  const kind = code.startsWith('ST') ? 'decks' : code.startsWith('P-') ? 'promos' : 'sets';
  const order = [kind, ...['sets', 'decks', 'promos'].filter(k => k !== kind)];
  for (const k of order) {
    try {
      const d = await getJSON(`${OPTCG}/${k}/card/${encodeURIComponent(code)}/`, { retries: 1 });
      if (Array.isArray(d) && d.length) return d.map(normOP);
    } catch (e) { console.warn('OPTCG', k, e); }
  }
  return [];
}

export async function onePieceSearch(name) {
  name = name.trim(); if (!name) return [];
  const code = parseOnePieceCode(name);
  if (code) return onePieceByCode(code);
  const out = [];
  for (const k of ['sets', 'decks']) {
    try {
      const d = await getJSON(`${OPTCG}/${k}/filtered/?card_name=${encodeURIComponent(name)}`, { retries: 1 });
      if (Array.isArray(d)) out.push(...d.map(normOP));
    } catch (e) { console.warn('OPTCG search', k, e); }
  }
  return out.slice(0, 40);
}

// ---------- FX + pricing ----------
export async function fxRates() {
  return cached('fx', 6 * 36e5, async () => {
    const [usd, eur] = await Promise.all([
      getJSON(`${FX}?base=USD&symbols=AUD`, { retries: 2 }),
      getJSON(`${FX}?base=EUR&symbols=AUD`, { retries: 2 })
    ]);
    return { USD: usd.rates.AUD, EUR: eur.rates.AUD, date: usd.date, source: 'Frankfurter (ECB reference rates)' };
  });
}

export function toAUD(value, currency, fx) {
  if (currency === 'AUD') return value;
  const r = fx?.[currency];
  return r ? value * r : null;
}

export const DEFAULT_CALC = { feePct: 13, fixedCost: 0, marginPct: 30 };

export function calc(marketAUD, opts = DEFAULT_CALC) {
  const fee = Math.min(Math.max(+opts.feePct || 0, 0), 100) / 100;
  const margin = Math.min(Math.max(+opts.marginPct || 0, 0), 100) / 100;
  const fixed = Math.max(+opts.fixedCost || 0, 0);
  const sellNet = Math.max(marketAUD * (1 - fee) - fixed, 0);
  const buyMax = sellNet * (1 - margin);
  return { marketAUD, sellNet, buyMax, feesAUD: marketAUD * fee + fixed, profitAtBuy: sellNet - buyMax };
}

// ---------- v2 fuzzy parsing (returns ALL plausible candidates; caller validates against the APIs) ----------
const OP_PREFIX = { OP: 'OP', '0P': 'OP', QP: 'OP', DP: 'OP', OW: 'OP', ST: 'ST', S7: 'ST', '5T': 'ST', SI: 'ST', EB: 'EB', E8: 'EB', PRB: 'PRB', PR8: 'PRB' };
const d0 = s => s.replace(/[OQD]/g, '0').replace(/[IL|]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2');
export function parseAllOnePiece(text) {
  if (!text) return [];
  const t = text.toUpperCase().replace(/[^A-Z0-9\-–—~+.\s]/g, ' ');
  const out = new Set();
  // with prefix, hyphen optional (OCR often drops or mangles it), trailing junk digits ignored
  const re = /(PRB|PR8|OP|0P|QP|DP|OW|ST|S7|5T|SI|EB|E8)\s?([0-9OQDILSBZ]{2})\s?[-–—~+.]{0,2}\s?([0-9OQDILSBZ]{3})/g;
  let m; while ((m = re.exec(t))) {
    const pre = OP_PREFIX[m[1]]; const a = d0(m[2]), b = d0(m[3]);
    if (/^\d{2}$/.test(a) && /^\d{3}$/.test(b) && +b > 0) out.add(`${pre}${a}-${b}`);
  }
  // prefix lost but hyphenated: "P02-013" / "02-013"
  const re2 = /P?([0-9OQDILS]{2})\s?[-–—~]\s?([0-9OQDILS]{3})/g;
  const guessed = new Set();
  while ((m = re2.exec(t))) { const a = d0(m[1]), b = d0(m[2]); if (/^\d{2}$/.test(a) && /^\d{3}$/.test(b) && +a >= 1 && +a <= 20 && +b > 0) for (const pre of ['OP', 'ST', 'EB']) { const k = `${pre}${a}-${b}`; if (!out.has(k)) guessed.add(k); } }
  const p = t.match(/\bP\s?[-–]\s?(\d{3})\b/); if (p) out.add(`P-${p[1]}`);
  // prefix-lost guesses come last and are flagged so they only count if the card name agrees
  return [...[...out].map(code => ({ code, guessed: false })), ...[...guessed].map(code => ({ code, guessed: true }))];
}

const CONF = { '0': '869', '1': '74', '2': '7', '3': '85', '4': '1', '5': '638', '6': '58', '7': '1', '8': '6309', '9': '80' };
export function parseAllPokemon(text, validTotals = null) {
  if (!text) return [];
  const t = text.replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, '0').replace(/[Il|](?=\d{2}\b)/g, '1');
  const re = /(\d{1,3})\s*[\/⁄\\]\s*(\d{2,3})(?!\d)/g;
  const out = []; const seen = new Set(); let m;
  const push = (num, total, repaired) => { const k = num + '/' + total; if (seen.has(k)) return; seen.add(k); out.push({ number: String(num), total, raw: m[0], repaired }); };
  // slash misread as a digit/letter in 3+1+3 runs, e.g. "1994165" -> 199/165 (only kept if the total is a real set size)
  if (validTotals) { const re3 = /(?<!\d)(\d{3})[147lI|](\d{3})(?!\d)/g; let k;
    while ((k = re3.exec(t))) { const num = parseInt(k[1], 10), total = parseInt(k[2], 10); m = k;
      if (num > 0 && validTotals.has(total) && num <= total * 2.2) push(num, total, true); } }
  while ((m = re.exec(t))) {
    const num = parseInt(m[1], 10), total = parseInt(m[2], 10);
    if (total < 10 || num === 0) continue;
    if (!validTotals || validTotals.has(total)) { if (num <= total * 2.2) push(num, total, false); continue; }
    // repair one commonly-confused digit in the printed total (e.g. 1/742 -> 1/142)
    const s = String(total);
    for (let i = 0; i < s.length; i++) for (const c of CONF[s[i]] || '') {
      const v = parseInt(s.slice(0, i) + c + s.slice(i + 1), 10);
      if (validTotals.has(v) && num <= v * 2.2) push(num, v, true);
    }
  }
  return out;
}

export async function validPokemonTotals() {
  try { const sets = await tcgdexSets(); return new Set(sets.map(s => s.cardCount?.official).filter(Boolean)); } catch { return null; }
}

// fuzzy "does this OCR word appear in the card name"
export function nameMatches(cardName, words) {
  const n = String(cardName).toLowerCase().replace(/[^a-z0-9]/g, '');
  return (words || []).some(w0 => { const w = w0.toLowerCase().replace(/[^a-z0-9]/g, ''); if (w.length < 3) return false;
    return [w, w.slice(1), w.slice(0, -1), w.slice(1, -1)].some((v, i) => (i === 0 || v.length >= 4) && n.includes(v)); });
}
