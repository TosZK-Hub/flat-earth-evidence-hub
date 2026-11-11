// Holowise — Ximilar Collectibles Recognition (tcg_id) integration.
// Docs: https://docs.ximilar.com/collectibles/recognition  (POST /v2/tcg_id, header "Authorization: Token <token>")
// The token is supplied by the user at runtime (Settings, stored in localStorage on their device). Never hardcoded.
import * as C from './core.js?v=5';

export const XIM_URL = 'https://api.ximilar.com/collectibles/v2/tcg_id';

export async function ximilarIdentify(base64Jpeg, token, { slab = false, priceStats = true, timeout = 25000 } = {}) {
  const body = { records: [{ _base64: base64Jpeg }], rotate: true, lang: true, price_stats: !!priceStats };
  if (slab) { body.slab_id = true; body.slab_grade = true; }
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  let r;
  try {
    r = await fetch(XIM_URL, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', Authorization: 'Token ' + String(token).trim().replace(/^token\s+/i, '') }, body: JSON.stringify(body) });
  } finally { clearTimeout(t); }
  let j = null; try { j = await r.json(); } catch {}
  if (!r.ok) {
    const e = new Error(r.status === 401
      ? "Ximilar refused the request (401). The token is wrong, it's out of credits, or the plan doesn't include Collectibles recognition (it needs a Business plan or temporary access from Ximilar)."
      : `Ximilar error ${r.status}: ${j?.status?.text || r.statusText}`);
    e.status = r.status; throw e;
  }
  return j;
}

const top = arr => (Array.isArray(arr) && arr.length ? arr[0] : null);

export function parseXimilar(json) {
  const rec = json?.records?.[0];
  if (!rec) return { error: 'No record in response' };
  if (rec._status && rec._status.code >= 300) return { error: rec._status.text || 'Record error' };
  const objs = rec._objects || [];
  const cardObj = objs.find(o => o.name === 'Card' && o._identification) || objs.find(o => o.name === 'Card');
  const slabObj = objs.find(o => o.name === 'Slab Label');
  const out = { card: null, slab: null };
  if (cardObj) {
    const id = cardObj._identification || {};
    out.card = {
      best: id.best_match || null, alternatives: id.alternatives || [], distances: id.distances || [],
      subcategory: top(cardObj._tags?.Subcategory)?.name || id.best_match?.subcategory || '',
      foil: top(cardObj._tags?.['Foil/Holo'])?.name || '', alphabet: top(cardObj._tags?.Alphabet)?.name || '',
      prob: cardObj.prob
    };
  }
  if (slabObj) {
    const b = slabObj._identification?.best_match || {};
    out.slab = {
      company: top(slabObj._tags?.Company)?.name || b.company || '', grade: b.grade || top(slabObj._tags?.Grade)?.name || '',
      verbal: b.verbal_grade || '', cert: b.certificate_number || '', certLink: Object.values(b.links || {})[0] || '',
      graded: top(slabObj._tags?.Graded)?.name || ''
    };
  }
  return out;
}

// Ximilar price_stats → marketplace price options (have explicit currency) + sold-stat summaries (currency not stated by the API)
export function ximilarPrices(best) {
  const opts = [], stats = [];
  for (const s of best?.price_stats || []) {
    const v = s.value || {};
    if (v.sold) stats.push({ type: s.stats_type, median: v.sold.median, mean: v.sold.mean, volume: v.sold.volume, latest: v.sold.latest, latestDate: v.sold.latest_date, daysToSell: v.sold.median_days_to_sell });
    for (const [mk, arr] of Object.entries(v.marketplaces || {})) for (const m of arr || []) {
      if (m.price && m.currency) opts.push({ label: `Ximilar · ${mk}${m.variation ? ' · ' + m.variation : ''}`, value: m.price, currency: m.currency, updated: m.date_of_check, source: 'ximilar' });
    }
  }
  // de-dup identical marketplace rows across stats types
  const seen = new Set();
  return { opts: opts.filter(o => { const k = o.label + o.value; if (seen.has(k)) return false; seen.add(k); return true; }), stats };
}

function onePieceCodeFrom(m) {
  const cn = String(m.card_number || '').toUpperCase().trim();
  if (/^[A-Z]{2,3}\d{2}-\d{3}$/.test(cn)) return cn;
  if (/^P-\d{3}$/.test(cn)) return cn;
  const sc = String(m.set_code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const n = cn.replace(/\D/g, '');
  if (/^[A-Z]{2,3}\d{2}$/.test(sc) && n) return `${sc}-${n.padStart(3, '0')}`;
  return C.parseAllOnePiece(m.full_name || '').map(x => x.code)[0] || null;
}

function bareCandidate(m, game) {
  return { game, id: 'xim:' + (m.full_name || m.name), name: m.name, number: m.card_number, setName: m.set, setTotal: m.out_of ? parseInt(m.out_of, 10) : undefined,
    rarity: m.rarity || '', image: null, thumb: null, prices: [], source: 'Ximilar (no free price match)' };
}

// Map Ximilar matches into the app's candidate format, pulling free prices from TCGdex / OPTCG.
export async function ximilarToCandidates(parsed) {
  const card = parsed.card; if (!card?.best) return [];
  const sub = (card.subcategory || card.best.subcategory || '').toLowerCase();
  const game = sub.includes('one piece') ? 'onepiece' : sub.includes('pok') ? 'pokemon' : 'other';
  const matches = [card.best, ...card.alternatives].slice(0, 4);
  const out = [], ids = new Set();
  const setOk = (c, m) => { if (!m.set || !c.setName) return true; const a = c.setName.toLowerCase(), b = String(m.set).toLowerCase(); return a.includes(b) || b.includes(a); };
  for (const [i, m] of matches.entries()) {
    let found = [];
    try {
      if (game === 'pokemon') {
        const num = String(m.card_number || '').replace(/^0+(?=\d)/, '');
        const total = parseInt(m.out_of, 10);
        if (num && total) found = (await C.pokemonByNumber(num, total, [m.name])).filter(c => C.nameMatches(c.name, [m.name]) && setOk(c, m) && !ids.has(c.id));
        if (!found.length && m.name) { // promos / odd numbering: search by name + number and prefer the same set
          const list = (await C.pokemonSearch(m.name, num)).filter(c => !ids.has(c.id));
          const pick = list.find(c => setOk(c, m)) || (m.set ? null : list[0]);
          if (pick) found = [await C.pokemonDetails(pick)];
        }
      } else if (game === 'onepiece') {
        const code = onePieceCodeFrom(m);
        if (code) found = await C.onePieceByCode(code);
      }
    } catch (e) { console.warn('free lookup for Ximilar match failed', e); }
    if (!found.length) found = [bareCandidate(m, game)];
    for (const f of found.filter(f => !ids.has(f.id)).slice(0, game === 'onepiece' ? 12 : 1)) {
      ids.add(f.id);
      f.ximilar = { fullName: m.full_name, rank: i, links: m.links || {}, foil: card.foil, alphabet: card.alphabet };
      if (i === 0) { const xp = ximilarPrices(m); f.prices = [...(f.prices || []), ...xp.opts]; f.ximStats = xp.stats; }
      if (parsed.slab) f.slab = parsed.slab;
      out.push(f);
    }
  }
  return out;
}

// Crop the framed card region (with a margin so Ximilar can find the card/slab edges) to a JPEG base64 string.
export function cardJpegBase64(rect, { margin = 0.12, maxSide = 1280, quality = 0.85, mkCanvas } = {}) {
  const srcW = rect.src.videoWidth || rect.src.naturalWidth || rect.src.width, srcH = rect.src.videoHeight || rect.src.naturalHeight || rect.src.height;
  const x = Math.max(0, rect.x - rect.w * margin), y = Math.max(0, rect.y - rect.h * margin);
  const w = Math.min(srcW - x, rect.w * (1 + 2 * margin)), h = Math.min(srcH - y, rect.h * (1 + 2 * margin));
  const k = Math.min(1, maxSide / Math.max(w, h));
  const c = mkCanvas(Math.round(w * k), Math.round(h * k));
  c.getContext('2d').drawImage(rect.src, x, y, w, h, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality).split(',')[1];
}
