// CardLens AU — Australian price helpers.
// 1) Precise eBay AU sold/completed search links (free, always available).
// 2) Optional AU sold prices from TCG Prices AU (tcgprices.com.au, eBay AU sold data) via YOUR OWN proxy.
//    Their API terms forbid putting an API key in client-side code, so the key must live in a server-side proxy
//    (see /card-scanner/proxy/worker.js). Results may be cached for max 24h and must be attributed.

const clean = s => String(s || '').replace(/\(.*?\)/g, ' ').replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim();

export function ebaySoldUrl(card, { graded = false, grade = '' } = {}) {
  let q;
  if (card.game === 'onepiece') {
    const tags = (String(card.name).match(/\(([^)]+)\)/g) || []).map(t => t.slice(1, -1)).filter(t => !/^\d+$|^[A-Z]{2,3}\d{2}-\d{3}$/.test(t));
    q = `"${card.code || card.number}" ${clean(card.name)} ${tags.join(' ')}`.trim();
  }
  else {
    const num = card.setTotal ? `"${String(card.number).replace(/^0+(?=\d)/, '')}/${card.setTotal}"` : `"${card.number}"`;
    q = `"${clean(card.name)}" ${num} ${clean(card.setName)}`;
  }
  if (graded) q += grade ? ` ${grade}` : ' (psa,bgs,cgc,ace)';
  else q += ' -psa -bgs -cgc -graded -slab';
  q += ' -japanese -jpn -proxy -custom';
  const p = new URLSearchParams({ _nkw: q, LH_Sold: '1', LH_Complete: '1', LH_PrefLoc: '1', _sop: '13', _ipg: '120' });
  return 'https://www.ebay.com.au/sch/i.html?' + p.toString();
}

export function auQuery(card) {
  if (card.game === 'onepiece') return `${clean(card.name)} ${card.code || card.number}`;
  return `${clean(card.name)} "${String(card.number).replace(/^0+(?=\d)/, '')}/${card.setTotal || ''}" ${clean(card.setName)}`.replace('/"', '"');
}

// Returns a price option {label, value, currency:'AUD', au:true, ...} or null.
export async function auSoldPrice(proxyBase, card, { graded = false } = {}) {
  if (!proxyBase || card.game !== 'pokemon') return null; // TCG Prices AU covers Pokémon only
  const u = new URL(proxyBase.replace(/\/+$/, '') + '/au-price');
  u.searchParams.set('q', auQuery(card)); u.searchParams.set('graded', graded ? 'true' : 'false');
  const r = await fetch(u, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`AU price proxy ${r.status}`);
  const j = await r.json();
  const v = j.medianPrice ?? j.averagePrice;
  if (!v || !j.sampleSize) return null;
  return { label: `AU eBay sold median (${j.sampleSize} sales, ${graded ? 'graded' : 'raw'})`, value: v, currency: 'AUD', au: true,
    updated: j.cachedAt || new Date().toISOString(), low: j.lowestPrice, high: j.highestPrice, source: 'TCG Prices AU', attribution: 'https://tcgprices.com.au/' };
}
