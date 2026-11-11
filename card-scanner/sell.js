// Holowise — AU selling, grading and trade maths (pure). Fee schedules are dated and sourced; everything else is the
// user's own assumption and is labelled that way in the UI. All results are estimates, not financial advice.
export const FEES_CHECKED = '11 Nov 2026';
export const SOURCES = {
  ebayFree: 'https://pages.ebay.com.au/sell-on-ebay/',
  ebayPro: 'https://www.ebay.com.au/help/selling/fees-credits-invoices/ebay-stores-selling-fees?id=4809',
  fbm: 'https://sendaparcel.com.au/news/facebook-marketplace-shipping',
  cardRevive: 'https://www.cardrevive.com.au/grading',
  pregrade: 'https://pregradecards.com/blog/card-grading-australia-2026-psa-cgc-costs-routes'
};
const r2 = n => Math.round(n * 100) / 100;

// eBay AU Buyer Protection fee, paid by the BUYER on listings from sellers without a Pro plan (incl. GST).
export function ebayBuyerProtection(price) {
  const band = (lo, hi, pct) => Math.max(0, Math.min(price, hi) - lo) * pct;
  return r2(0.30 + band(0, 20, 0.08) + band(20, 500, 0.06) + band(500, 5000, 0.04));
}
// eBay AU Pro Starter transaction fee: 13.4% of (item + postage charged) up to A$4,000, 2.5% above, + A$0.30 per order.
export function ebayProStarterFee(total) {
  return r2(0.30 + Math.min(total, 4000) * 0.134 + Math.max(0, total - 4000) * 0.025);
}

// Net proceeds across AU channels for one card at `price` (A$). o: { postage: what posting costs you, postCharged: what
// you charge the buyer for postage, lgsPct: your local store's buylist %, showPct: what a show dealer typically pays you
// as % of market, showTable: table fee per show, showCards: cards you expect to sell per show }.
export function channels(price, o = {}) {
  const post = +o.postage || 0, charged = o.postCharged != null ? +o.postCharged : post;
  const out = [];
  out.push({ id: 'ebay-private', name: 'eBay AU (private seller)', fee: 0, net: r2(price + charged - post),
    note: `No selling fee for eligible private sellers up to A$25,000 sales a year. The buyer pays a Buyer Protection fee of ${money(ebayBuyerProtection(price))} on top, so they see ${money(price + ebayBuyerProtection(price))}.`, src: SOURCES.ebayFree });
  const pf = ebayProStarterFee(price + charged);
  out.push({ id: 'ebay-pro', name: 'eBay AU (Pro Starter, or over A$25k/yr)', fee: pf, net: r2(price + charged - pf - post),
    note: '13.4% of item + postage (to A$4,000) + A$0.30 per order, incl. GST.', src: SOURCES.ebayPro });
  out.push({ id: 'fbm', name: 'Facebook Marketplace (local pickup)', fee: 0, net: r2(price),
    note: 'No fees for local pickup. Shipping/checkout isn\u2019t offered to Australian sellers, so this assumes cash or bank transfer in person.', src: SOURCES.fbm });
  if (o.lgsPct > 0) out.push({ id: 'lgs', name: 'Local game store buylist', fee: r2(price * (1 - o.lgsPct / 100)), net: r2(price * o.lgsPct / 100),
    note: `Your setting: the store pays ${o.lgsPct}% of market. Ask your store; many pay more in store credit.`, user: true });
  if (o.showPct > 0) { const tf = o.showTable > 0 && o.showCards > 0 ? o.showTable / o.showCards : 0;
    out.push({ id: 'show', name: tf ? 'Card show (your own table)' : 'Card show (sell to a dealer)', fee: r2(price * (1 - o.showPct / 100) + tf), net: r2(price * o.showPct / 100 - tf),
      note: tf ? `Your settings: you sell at ${o.showPct}% of market and share a A$${o.showTable} table across ${o.showCards} cards.` : `Your setting: a dealer pays ${o.showPct}% of market.`, user: true }); }
  const best = out.reduce((a, b) => (b.net > a.net ? b : a), out[0]);
  return out.map(c => ({ ...c, best: c === best }));
}
const money = n => 'A$' + (+n).toFixed(2);

// Grading presets: published AU starting rates (per card) as checked on FEES_CHECKED. gst: price excludes GST.
export const GRADERS = [
  { id: 'psa-jtoys', name: 'PSA Standard via JToys', fee: 120, gst: true, ret: 0, src: SOURCES.pregrade, note: 'Published A$120 + GST (via PreGradeCards, Nov 2026). Return post may be extra.' },
  { id: 'psa-slabbys', name: 'PSA Standard via Slabbys', fee: 130, gst: false, ret: 0, src: SOURCES.pregrade, note: 'Published A$130, stated all-in (via PreGradeCards, Nov 2026).' },
  { id: 'psa-cr', name: 'PSA via Card Revive (from)', fee: 172, gst: true, ret: 19.99, src: SOURCES.cardRevive, note: 'From A$172 + GST; return post A$19.99 + GST; customs A$3–12/card may apply.' },
  { id: 'bgs-cr', name: 'BGS via Card Revive (from)', fee: 55, gst: true, ret: 19.99, src: SOURCES.cardRevive, note: 'From A$55 + GST; return post A$19.99 + GST; customs A$3–12/card may apply.' },
  { id: 'cgc-cr', name: 'CGC via Card Revive (from)', fee: 40, gst: true, ret: 19.99, src: SOURCES.cardRevive, note: 'From A$40 + GST; return post A$19.99 + GST; customs A$3–12/card may apply.' },
  { id: 'pcg-cr', name: 'PCG (Australian) via Card Revive (from)', fee: 30, gst: true, ret: 19.99, src: SOURCES.cardRevive, note: 'From A$30 + GST; domestic, 1–3 weeks; return post A$19.99 + GST.' },
  { id: 'custom', name: 'Custom (your quote)', fee: 0, gst: false, ret: 0, note: 'Enter your own all-in cost.' }
];
export function gradingCost(g, { customs = 0, extra = 0, cardsInBatch = 1 } = {}) {
  const fee = g.fee * (g.gst ? 1.1 : 1), ret = (g.ret * (g.ret ? 1.1 : 1)) / Math.max(1, cardsInBatch);
  return r2(fee + ret + (+customs || 0) + (+extra || 0));
}
// Expected value of grading. outcomes: [{ grade, p (0–100), value (A$ sale price) }]. sellPct: share of a sale you keep
// after selling fees (e.g. 100 for private eBay, 86.6 for Pro). rawNet: what selling raw would net you today.
export function gradeEV({ outcomes, cost, rawNet, sellPct = 100 }) {
  const ps = outcomes.reduce((s, o) => s + (+o.p || 0), 0);
  if (ps <= 0) return null;
  const known = outcomes.filter(o => +o.p > 0);
  if (known.some(o => !(+o.value > 0))) return { missing: true, probTotal: ps };
  const ev = known.reduce((s, o) => s + (o.p / ps) * o.value * (sellPct / 100), 0);
  const gain = ev - cost - rawNet;
  const breakeven = (cost + rawNet) / (sellPct / 100); // average graded sale price needed to match selling raw
  const best = outcomes.find(o => +o.value > 0 && +o.p > 0 && o.value * sellPct / 100 - cost > rawNet);
  return { ev: r2(ev), gain: r2(gain), breakeven: r2(breakeven), probTotal: ps, worth: gain > 0, best: best?.grade ?? null };
}
// Trade fairness between two piles of { aud, qty }.
export function tradeTotals(mine, theirs) {
  const sum = l => l.reduce((s, x) => s + (x.aud > 0 ? x.aud * (x.qty || 1) : 0), 0);
  const a = sum(mine), b = sum(theirs), diff = b - a, base = Math.max(a, b);
  const fair = base ? Math.round((Math.min(a, b) / base) * 1000) / 10 : null;
  const unpriced = [...mine, ...theirs].filter(x => !(x.aud > 0)).length;
  return { mine: r2(a), theirs: r2(b), diff: r2(diff), fairPct: fair, favours: Math.abs(diff) < 0.005 ? 'even' : diff > 0 ? 'you' : 'them', unpriced };
}
