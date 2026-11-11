// Holowise — deal verdicts and buy offers. Pure functions. All outputs are estimates from the market price the app shows.
import { calc } from './core.js?v=5';

// market: AUD market estimate for the card. asking: AUD asking price. cfg: {feePct, fixedCost, marginPct}.
// Bands (dealer view, fee-aware):
//   Great deal   asking ≤ max buy             (resale would hit your target margin)
//   Fair         asking ≤ net after fees      (resale still profitable, below your target margin)
//   Collector    asking ≤ market              (fine to keep; reselling would lose money after fees)
//   Overpriced   asking > market
export function dealVerdict(market, asking, cfg) {
  if (!(market > 0) || !(asking > 0)) return null;
  const k = calc(market, cfg);
  const vsMarketPct = (asking / market - 1) * 100;
  const profitIfResold = k.sellNet - asking;
  let band, label, tone;
  if (asking <= k.buyMax) { band = 'great'; label = 'Great deal'; tone = 'good'; }
  else if (asking <= k.sellNet) { band = 'fair'; label = 'Fair'; tone = 'ok'; }
  else if (asking <= market) { band = 'collector'; label = 'Collector price'; tone = 'warn'; }
  else { band = 'over'; label = 'Overpriced'; tone = 'bad'; }
  const why = {
    great: `At or below your max buy (${money(k.buyMax)}). Reselling at market would leave about ${money(profitIfResold)} after fees.`,
    fair: `Below what you'd net after fees (${money(k.sellNet)}), so a resale still makes about ${money(profitIfResold)}, but less than your ${cfg.marginPct}% target.`,
    collector: `Under market (${money(market)}) but above what you'd net after ${cfg.feePct}% fees, so reselling would lose about ${money(-profitIfResold)}. OK if you're keeping it.`,
    over: `${vsMarketPct.toFixed(0)}% above the market estimate (${money(market)}). Try offering ${money(k.buyMax)}.`
  }[band];
  return { band, label, tone, why, vsMarketPct, profitIfResold, sellNet: k.sellNet, buyMax: k.buyMax, counter: k.buyMax };
}
const money = n => 'A$' + (Math.round(n * 100) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Running totals for a batch/bulk-scan session. items: [{aud, qty}]
export function sessionTotals(items, cfg) {
  let market = 0, offer = 0, priced = 0, unpriced = 0;
  for (const it of items) {
    const q = it.qty || 1;
    if (it.aud > 0) { market += it.aud * q; offer += calc(it.aud, cfg).buyMax * q; priced += q; } else unpriced += q;
  }
  return { market, offer, priced, unpriced, count: priced + unpriced };
}
