// Holowise — portfolio maths (pure). Values are AUD estimates from converted market prices unless the user set a value.
export function itemValue(it) {
  // user override wins (e.g. graded slabs, where raw market prices don't apply)
  if (it.manualAud > 0) return { unit: it.manualAud, how: 'your value' };
  if (it.grade && !(it.manualAud > 0)) return { unit: null, how: 'graded: add your own value' };
  if (it.lastAud > 0) return { unit: it.lastAud, how: 'market (NM raw)' };
  return { unit: null, how: 'no price' };
}
export function summarize(items) {
  let value = 0, cost = 0, costOfValued = 0, valued = 0, unvalued = 0, qty = 0;
  const rows = items.map(it => {
    const q = Math.max(1, +it.qty || 1), v = itemValue(it), c = (+it.buyAud || 0) * q;
    qty += q; cost += c;
    const val = v.unit != null ? v.unit * q : null;
    if (val != null) { value += val; valued += q; if (it.buyAud > 0) costOfValued += c; } else unvalued += q;
    const pl = val != null && it.buyAud > 0 ? val - c : null;
    return { ...it, q, val, cost: c, pl, plPct: pl != null && c ? (pl / c) * 100 : null, how: v.how };
  });
  const pl = rows.reduce((s, r) => s + (r.pl ?? 0), 0);
  return { rows, value, cost, pl, plPct: costOfValued ? (pl / costOfValued) * 100 : null, valued, unvalued, qty };
}
// Top movers from each item's own price log ({d:'YYYY-MM-DD', v: price in source currency}); currency-neutral %.
export function movers(items, { days = 7, n = 5, today = new Date().toISOString().slice(0, 10) } = {}) {
  const cut = new Date(Date.parse(today) - days * 864e5).toISOString().slice(0, 10);
  const out = [], seen = new Set();
  for (const it of items) {
    const cid = `${it.game}:${it.id}`; if (seen.has(cid)) continue; // one row per card even if owned in several lots
    const log = (it.priceLog || []).filter(x => x.v > 0);
    if (log.length < 2) continue;
    const base = log.find(x => x.d >= cut) || log[0], last = log[log.length - 1];
    if (base === last || base.d === last.d) continue;
    seen.add(cid);
    out.push({ id: it.key, name: it.name, set: it.setName, thumb: it.thumb, from: base, to: last, pct: (last.v / base.v - 1) * 100, cur: it.currency });
  }
  out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  return out.slice(0, n);
}
export function pushLog(log = [], d, v, cap = 180) {
  const a = log.filter(x => x.d !== d); a.push({ d, v }); a.sort((x, y) => x.d < y.d ? -1 : 1);
  return a.slice(-cap);
}
