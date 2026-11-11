// CardLens AU — price history sources. Every point comes from a real source with its date; nothing is invented.
//  Free, no key:
//   • One Piece: OPTCG API "twoweeks" endpoint: ~14 daily TCGplayer market prices (USD) per variant.
//   • Pokémon: TCGdex Cardmarket rolling averages (1/7/30-day + trend, EUR) and TCGplayer low/mid/market/high (USD).
//   • On-device log: each time you open a card, today's free prices are saved locally (one point per day), so a real
//     history builds up on your phone over time.
//  Optional, needs your key or your proxy:
//   • JustTCG (Settings key): daily TCGplayer prices up to 1 year, Pokémon and One Piece.
//   • TCG Prices AU (via your proxy): eBay Australia individual sales, raw vs graded, and up to 365 days of history.
const OPTCG = 'https://optcgapi.com/api';
const DAY = 864e5;

async function getJSON(url, init = {}, timeout = 15000) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeout);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal });
    if (!r.ok) { const e = new Error(`HTTP ${r.status}`); e.status = r.status; throw e; }
    return await r.json();
  } finally { clearTimeout(t); }
}

// ----- One Piece: OPTCG two-week daily history -----
// Field naming is DayN_Market_Price. DayN = N days before date_scraped. The OPTCG docs don't spell this out; we checked it
// against TCGCSV's dated TCGplayer archives for OP05-119 (6 of 7 dates matched exactly, Nov 2026).
export function parseTwoWeeks(row) {
  const asOf = Date.parse(row.date_scraped + 'T00:00:00Z');
  if (!isFinite(asOf)) return null;
  const market = [], listed = [];
  if (row.market_price) market.push({ t: asOf, p: +row.market_price });
  if (row.inventory_price) listed.push({ t: asOf, p: +row.inventory_price });
  for (let n = 1; n <= 31; n++) {
    const m = row[`Day${n}_Market_Price`], inv = row[`Day${n}_Inventory_Price`];
    if (m != null && +m > 0) market.push({ t: asOf - n * DAY, p: +m });
    if (inv != null && +inv > 0) listed.push({ t: asOf - n * DAY, p: +inv });
  }
  market.sort((a, b) => a.t - b.t); listed.sort((a, b) => a.t - b.t);
  return { asOf: row.date_scraped, market, listed };
}

export async function opTwoWeeks(card) {
  const code = (card.code || card.number || '').toUpperCase();
  if (!code) return null;
  const kind = code.startsWith('ST') ? 'decks' : code.startsWith('P-') ? 'promos' : 'sets';
  const rows = await getJSON(`${OPTCG}/${kind}/card/twoweeks/${encodeURIComponent(code)}/`);
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows.find(r => r.card_image_id === card.id) || rows.find(r => r.card_image_id === code) || rows[0];
  const h = parseTwoWeeks(row);
  if (!h || h.market.length < 2) return null;
  const ageDays = Math.round((Date.now() - Date.parse(h.asOf)) / DAY);
  return { key: 'optcg', name: 'TCGplayer market (OPTCG API, daily)', kind: 'raw', currency: 'USD', points: h.market,
    extra: { name: 'TCGplayer lowest listing', points: h.listed }, asOf: h.asOf, stale: ageDays > 3, ageDays,
    note: 'Daily market prices for this exact variant (about 2 weeks).',
    source: 'OPTCG API', link: 'https://optcgapi.com/' };
}

// ----- Pokémon: TCGplayer snapshot (low/mid/market/high) -----
export function tcgplayerSnapshot(pricing) {
  const tp = pricing?.tcgplayer; if (!tp) return [];
  return Object.entries(tp).filter(([, v]) => v && typeof v === 'object').map(([k, v]) => ({ variant: k, low: v.lowPrice, mid: v.midPrice, market: v.marketPrice, high: v.highPrice, productId: v.productId, updated: tp.updated }));
}

// ----- On-device daily log (free sources only; never TCG Prices AU data, per their terms) -----
const LKEY = c => `cl:ph:${c.game}:${c.id}`;
export function logToday(card, prices, store = globalThis.localStorage) {
  if (!store || !card?.id) return;
  let o; try { o = JSON.parse(store.getItem(LKEY(card)) || '{}'); } catch { o = {}; }
  const d = new Date().toISOString().slice(0, 10);
  for (const p of prices || []) {
    if (p.au || p.source === 'ximilar' || !p.value) continue; // AU data must not be stored long-term; Ximilar currency unknown
    const k = `${p.label}|${p.currency}`;
    const arr = o[k] || (o[k] = []);
    const at = arr.findIndex(x => x.d === d);
    const rec = { d, v: +p.value, u: p.updated ? String(p.updated).slice(0, 10) : '' };
    if (at >= 0) arr[at] = rec; else arr.push(rec);
    if (arr.length > 400) arr.splice(0, arr.length - 400);
  }
  try { store.setItem(LKEY(card), JSON.stringify(o)); } catch { /* storage full: skip */ }
}
export function localSeries(card, store = globalThis.localStorage) {
  let o; try { o = JSON.parse(store?.getItem(LKEY(card)) || '{}'); } catch { o = {}; }
  return Object.entries(o).map(([k, arr]) => {
    const [label, currency] = k.split('|');
    return { key: 'local:' + k, name: `${label} (saved on this phone)`, kind: 'raw', currency, source: 'On-device log',
      points: arr.map(x => ({ t: Date.parse(x.d + 'T00:00:00Z'), p: x.v })) };
  }).filter(s => s.points.length);
}

// ----- JustTCG (optional key; free tier is for personal, non-commercial use) -----
const JT_PRINT = { holofoil: 'Holofoil', normal: 'Normal', 'reverse-holofoil': 'Reverse Holofoil', '1st-edition-holofoil': '1st Edition Holofoil', '1st-edition': '1st Edition', unlimited: 'Unlimited', 'unlimited-holofoil': 'Unlimited Holofoil' };
export async function justTcgHistory(card, key, { duration = '1y', fetchFn = null } = {}) {
  if (!key) return [];
  const u = new URL('https://api.justtcg.com/v1/cards');
  const tps = tcgplayerSnapshot(card.pricing);
  if (card.game === 'pokemon' && tps[0]?.productId) u.searchParams.set('tcgplayerId', String(tps[0].productId));
  else { u.searchParams.set('q', card.game === 'onepiece' ? (card.code || card.number) : `${card.name} ${card.number}`); u.searchParams.set('game', card.game === 'onepiece' ? 'one-piece-card-game' : 'pokemon'); }
  u.searchParams.set('include_price_history', 'true'); u.searchParams.set('priceHistoryDuration', duration); u.searchParams.set('condition', 'NM');
  const j = await (fetchFn || getJSON)(u.toString(), { headers: { 'x-api-key': key } });
  let cards = j?.data || [];
  if (card.game === 'onepiece') {
    const code = (card.code || card.number || '').toUpperCase();
    const want = String(card.name || '').toLowerCase();
    cards = cards.filter(c => String(c.number || '').toUpperCase() === code);
    const exact = cards.filter(c => String(c.name || '').toLowerCase() === want);
    if (exact.length) cards = exact;
  }
  const c = cards[0]; if (!c) return [];
  return (c.variants || []).filter(v => Array.isArray(v.priceHistory) && v.priceHistory.length && /near mint/i.test(v.condition || 'Near Mint')).map(v => ({
    key: 'jt:' + v.id, name: `TCGplayer NM ${v.printing || ''} (JustTCG, daily)`.replace('  ', ' '), kind: 'raw', currency: 'USD', source: 'JustTCG', link: 'https://justtcg.com/',
    printing: v.printing, points: v.priceHistory.map(x => ({ t: x.t < 1e12 ? x.t * 1000 : x.t, p: x.p })), asOf: v.lastUpdated ? new Date(v.lastUpdated * 1000).toISOString() : null,
    match: c.name + (c.set_name ? ' · ' + c.set_name : '')
  })).sort((a, b) => {
    const want = tps.map(t => JT_PRINT[t.variant]).filter(Boolean);
    return (want.includes(b.printing) ? 1 : 0) - (want.includes(a.printing) ? 1 : 0) || b.points.length - a.points.length;
  });
}

// ----- TCG Prices AU via your proxy (Pokémon only). Not stored on the device (24 h cache limit in their terms). -----
const GRADED_RE = /\b(psa|bgs|cgc|sgc|ace|tag|beckett|graded|slab)\b/i;
export async function auSales(proxyBase, query, { fetchFn = null } = {}) {
  const u = new URL(proxyBase.replace(/\/+$/, '') + '/au-price'); u.searchParams.set('q', query);
  const j = await (fetchFn || getJSON)(u.toString());
  const list = (j.listings || []).filter(x => x && x.price > 0).map(x => ({ t: Date.parse(x.soldDate), p: +x.price, title: x.title || '', url: x.url || x.link || '', graded: x.isGraded ?? GRADED_RE.test(x.title || '') }))
    .filter(x => isFinite(x.t)).sort((a, b) => b.t - a.t);
  return { raw: list.filter(x => !x.graded), graded: list.filter(x => x.graded), cachedAt: j.cachedAt || null };
}
export async function auHistory(proxyBase, { q, number }, { days = 365, fetchFn = null } = {}) {
  const u = new URL(proxyBase.replace(/\/+$/, '') + '/au-history'); u.searchParams.set('q', q); if (number) u.searchParams.set('number', number); u.searchParams.set('days', String(days));
  const j = await (fetchFn || getJSON)(u.toString());
  const median = (j.history || []).map(h => ({ t: Date.parse(h.createdAt), p: +(h.medianPrice ?? h.averagePrice), n: h.sampleSize })).filter(x => isFinite(x.t) && x.p > 0);
  const sold = (j.soldHistory || []).map(s => ({ t: Date.parse(s.soldDate), p: +s.price, title: s.title || '', graded: GRADED_RE.test(s.title || '') })).filter(x => isFinite(x.t) && x.p > 0);
  return { cardId: j.cardId || null, median, soldRaw: sold.filter(x => !x.graded), soldGraded: sold.filter(x => x.graded) };
}
