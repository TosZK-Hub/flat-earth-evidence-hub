// Holowise — price-history statistics: trend, volatility, projection band and a keep/sell signal.
// Pure functions (no DOM, no network) so they run the same in the browser and in Node tests.
// Method (shown to the user in the app):
//   1. Take the last W days of real price points (W = min(lookback, span of the data)).
//   2. Fit a straight line to ln(price) against time (ordinary least squares). The slope b is the trend per day.
//   3. Volatility σ = standard deviation of log price changes between points, scaled to one day (√Δt).
//   4. Projection for H days: central = last × e^(b·H); band = last × e^(b·H ± z·σ·√H)  (z = 1.28 ≈ 80% band).
//   5. Signal: if the expected move b·H is smaller than the noise σ·√H, or smaller than your threshold → Watch.
//      Otherwise uptrend → Hold, downtrend → Sell. Too little history → no signal at all.
// This is a naive random-walk-with-drift model. Card prices jump on reprints, bans, hype and grading news, which no
// history-only model can see. It is an estimate, not a forecast you can rely on, and not financial advice.

export const DEFAULT_SIGNAL = { horizonDays: 30, thresholdPct: 10, lookbackDays: 90, minPoints: 20, minSpanDays: 30, z: 1.28, maxAgeDays: 21 };
const DAY = 864e5;

export function cleanSeries(points) {
  const m = new Map();
  for (const x of points || []) {
    const t = typeof x.t === 'number' ? (x.t < 1e12 ? x.t * 1000 : x.t) : Date.parse(x.t);
    const p = +x.p;
    if (!isFinite(t) || !isFinite(p) || p <= 0) continue;
    m.set(Math.floor(t / DAY), { t, p }); // one point per day (last wins)
  }
  return [...m.values()].sort((a, b) => a.t - b.t);
}

function ols(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const b = sxx ? sxy / sxx : 0, a = my - b * mx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { a, b, r2 };
}

const pct = x => (Math.exp(x) - 1) * 100;

// Simple stats any series can show, even when too short for a signal.
export function summarize(points) {
  const s = cleanSeries(points);
  if (!s.length) return { n: 0 };
  const first = s[0], last = s[s.length - 1];
  const ps = s.map(x => x.p);
  const spanDays = (last.t - first.t) / DAY;
  const changePct = s.length > 1 ? (last.p / first.p - 1) * 100 : null;
  return { n: s.length, spanDays, first, last, min: Math.min(...ps), max: Math.max(...ps), changePct };
}

export function analyze(points, opts = {}) {
  const o = { ...DEFAULT_SIGNAL, ...opts };
  const all = cleanSeries(points);
  const sum = summarize(all);
  const base = { ...sum, method: 'log-linear trend + volatility band', opts: o };
  if (all.length < 2) return { ...base, ok: false, reason: 'No price history for this card from the connected sources.' };
  const end = all[all.length - 1].t;
  const ageDays = ((o.now ?? Date.now()) - end) / DAY;
  if (ageDays > o.maxAgeDays) return { ...base, ok: false, ageDays, reason: `The latest price in this history is ${Math.round(ageDays)} days old, so it can't say where the price is heading now. No signal shown.` };
  const s = all.filter(x => x.t >= end - o.lookbackDays * DAY);
  const spanDays = (s[s.length - 1].t - s[0].t) / DAY;
  if (s.length < o.minPoints || spanDays < o.minSpanDays) {
    return { ...base, ok: false, window: { n: s.length, spanDays },
      reason: `Not enough history for a signal: ${s.length} price point${s.length === 1 ? '' : 's'} over ${Math.round(spanDays)} days (need at least ${o.minPoints} points over ${o.minSpanDays} days). No signal shown rather than a guess.` };
  }
  const xs = s.map(x => (x.t - end) / DAY), ys = s.map(x => Math.log(x.p));
  const { b, r2 } = ols(xs, ys);
  const rets = [];
  for (let i = 1; i < s.length; i++) { const dt = Math.max((s[i].t - s[i - 1].t) / DAY, 1); rets.push((ys[i] - ys[i - 1]) / Math.sqrt(dt)); }
  const mr = rets.reduce((a, c) => a + c, 0) / rets.length;
  const sigma = Math.sqrt(rets.reduce((a, c) => a + (c - mr) ** 2, 0) / Math.max(rets.length - 1, 1));
  const H = Math.min(o.horizonDays, Math.round(spanDays)); // never project further ahead than the history reaches back
  const last = s[s.length - 1].p;
  const drift = b * H, noise = sigma * Math.sqrt(H);
  const proj = { days: H, mid: last * Math.exp(drift), low: last * Math.exp(drift - o.z * noise), high: last * Math.exp(drift + o.z * noise),
    midPct: pct(drift), lowPct: pct(drift - o.z * noise), highPct: pct(drift + o.z * noise), bandPct: Math.round(erfApproxPct(o.z)) };
  const snr = noise ? Math.abs(drift) / noise : 0;
  let signal, why;
  if (Math.abs(proj.midPct) < o.thresholdPct) { signal = 'Watch'; why = `The trend projects ${fmtPct(proj.midPct)} over ${H} days, inside your ±${o.thresholdPct}% threshold. No clear direction.`; }
  else if (snr < 1) { signal = 'Watch'; why = `The trend (${fmtPct(proj.midPct)} over ${H} days) is smaller than normal price noise (±${pct(noise).toFixed(0)}%), so it may not be real.`; }
  else if (drift > 0) { signal = 'Hold'; why = `Steady uptrend: ${fmtPct(proj.midPct)} projected over ${H} days, larger than the usual noise. History favours keeping it, if the trend continues.`; }
  else { signal = 'Sell'; why = `Steady downtrend: ${fmtPct(proj.midPct)} projected over ${H} days, larger than the usual noise. History favours selling sooner rather than later, if the trend continues.`; }
  let confidence = 'Low';
  if (s.length >= 40 && spanDays >= 60 && r2 >= 0.4 && snr >= 1) confidence = 'Medium'; // never "High": history can't see reprints or hype
  return { ...base, ok: true, window: { n: s.length, spanDays, from: s[0].t, to: s[s.length - 1].t }, trendPctPer30d: pct(b * 30), r2, sigmaDailyPct: sigma * 100, snr, proj, signal, why, confidence };
}

function erfApproxPct(z) { // two-sided normal coverage for z, in %
  const t = 1 / (1 + 0.3275911 * z / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return y * 100;
}
export const fmtPct = x => (x >= 0 ? '+' : '') + x.toFixed(1) + '%';

// Cardmarket only gives rolling averages (1, 7 and 30 days) and its own "trend" price. That is momentum, not a history:
// we show it, but never turn it into a Hold/Sell signal.
export function windowsMomentum(cm) {
  if (!cm) return null;
  const pick = k => cm[k] || null;
  let v = { avg1: pick('avg1'), avg7: pick('avg7'), avg30: pick('avg30'), trend: pick('trend'), avg: pick('avg'), low: pick('low') }, holo = false;
  if (!v.avg7 && !v.avg30 && (cm['avg7-holo'] || cm['avg30-holo'])) { v = { avg1: cm['avg1-holo'], avg7: cm['avg7-holo'], avg30: cm['avg30-holo'], trend: cm['trend-holo'], avg: cm['avg-holo'], low: cm['low-holo'] }; holo = true; }
  const n = ['avg1', 'avg7', 'avg30'].filter(k => v[k]).length;
  if (n < 2) return { ...v, holo, n, text: 'Not enough Cardmarket averages to compare.' };
  const parts = [];
  if (v.avg7 && v.avg30) parts.push(`7-day average is ${fmtPct((v.avg7 / v.avg30 - 1) * 100)} vs the 30-day average`);
  if (v.avg1 && v.avg7) parts.push(`yesterday's average is ${fmtPct((v.avg1 / v.avg7 - 1) * 100)} vs the 7-day`);
  const m = v.avg7 && v.avg30 ? (v.avg7 / v.avg30 - 1) * 100 : 0;
  const dir = Math.abs(m) < 5 ? 'flat' : m > 0 ? 'rising' : 'falling';
  return { ...v, holo, n, dir, momentumPct: m, text: parts.join('; ') + '.' };
}

// ---------- SVG chart (string) ----------
// series: [{name, color, points:[{t,p}], dashed?, dots?}], band: {t0, t1, p0, low, mid, high} (projection fan)
export function chartSVG(series, { width = 340, height = 170, days = null, band = null, cur = '' } = {}) {
  const now = Math.max(...series.flatMap(s => s.points.map(x => x.t)), band ? band.t1 : 0);
  const dataEnd = Math.max(...series.flatMap(s => s.points.map(x => x.t)));
  const minT = Math.min(...series.flatMap(s => s.points.map(x => x.t)));
  const from = days ? Math.max(minT, dataEnd - days * DAY) : minT;
  const vis = series.map(s => ({ ...s, points: s.points.filter(x => x.t >= from) })).filter(s => s.points.length);
  const ps = vis.flatMap(s => s.points.map(x => x.p)).concat(band ? [band.low, band.high, band.p0] : []);
  if (!ps.length) return '';
  let lo = Math.min(...ps), hi = Math.max(...ps); if (hi === lo) { hi *= 1.05; lo *= 0.95; }
  const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad;
  const L = 44, R = 8, T = 8, B = 22, W = width - L - R, Hh = height - T - B;
  const t0 = from, t1 = Math.max(now, from + DAY);
  const X = t => L + ((t - t0) / (t1 - t0)) * W, Y = p => T + (1 - (p - lo) / (hi - lo)) * Hh;
  const f = n => n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  let g = '';
  for (let i = 0; i <= 3; i++) { const p = lo + (hi - lo) * i / 3, y = Y(p).toFixed(1); g += `<line x1="${L}" x2="${width - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 4}" y="${+y + 3}" text-anchor="end" class="ax">${cur}${f(p)}</text>`; }
  const dfmt = t => new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Brisbane' });
  g += `<text x="${L}" y="${height - 6}" class="ax">${dfmt(t0)}</text><text x="${width - R}" y="${height - 6}" text-anchor="end" class="ax">${dfmt(t1)}</text>`;
  if (band) {
    g += `<path d="M${X(band.t0).toFixed(1)},${Y(band.p0).toFixed(1)} L${X(band.t1).toFixed(1)},${Y(band.high).toFixed(1)} L${X(band.t1).toFixed(1)},${Y(band.low).toFixed(1)} Z" class="band"/>`;
    g += `<line x1="${X(band.t0).toFixed(1)}" y1="${Y(band.p0).toFixed(1)}" x2="${X(band.t1).toFixed(1)}" y2="${Y(band.mid).toFixed(1)}" class="projline"/>`;
  }
  for (const s of vis) {
    if (s.dots || s.points.length === 1) g += s.points.map(x => `<circle cx="${X(x.t).toFixed(1)}" cy="${Y(x.p).toFixed(1)}" r="2.6" fill="${s.color}"/>`).join('');
    else g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="4 3"' : ''} points="${s.points.map(x => X(x.t).toFixed(1) + ',' + Y(x.p).toFixed(1)).join(' ')}"/>`;
  }
  return `<svg viewBox="0 0 ${width} ${height}" class="chart" role="img" aria-label="Price history chart">${g}</svg>`;
}
