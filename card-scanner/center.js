// Holowise — front centering estimate from a card photo (pure; browser + Node).
// Finds the outer card edge and the inner printed border on each side from gradient profiles, then reports
// left/right and top/bottom ratios. It is a measurement aid, not a grade: photos with perspective, glare,
// borderless/full-art designs or a loose crop can mislead it. Confidence says how clear the edges were.
//
// Published front-centering tolerances (checked 11 Nov 2026):
//  PSA (psacard.com/gradingstandards; per-grade limits as summarised by centeringcheck.com/grading-standards):
//    10 ≈ 55/45, 9 ≈ 60/40, 8 ≈ 65/35, 7 ≈ 70/30, 6 ≈ 80/20, 5 ≈ 85/15 (front; graders may allow small variance)
//  BGS centering subgrade (binder-ai.com/guides/bgs-centering-requirements):
//    10 Pristine = 50/50 both ways, 9.5 = 50/50 one way and 55/45 the other, 9 = 55/45 both ways
export const PSA_FRONT = [[10, 55], [9, 60], [8, 65], [7, 70], [6, 80], [5, 85]];
export const BGS_FRONT = [{ g: '10', a: 50, b: 50 }, { g: '9.5', a: 50, b: 55 }, { g: '9', a: 55, b: 55 }];

function profile(img, axis, from, to) { // mean colour gradient across a band, as a function of position along the axis
  const { w, h } = img, chans = img.ch || [img.y], n = axis === 'x' ? w : h, p = new Float32Array(n);
  const a0 = Math.floor((axis === 'x' ? h : w) * from), a1 = Math.floor((axis === 'x' ? h : w) * to);
  for (let i = 1; i < n - 1; i++) {
    let s = 0;
    for (let j = a0; j < a1; j++) {
      let g = 0;
      for (const y of chans) { const d = axis === 'x' ? Math.abs(y[j * w + i + 1] - y[j * w + i - 1]) : Math.abs(y[(i + 1) * w + j] - y[(i - 1) * w + j]); if (d > g) g = d; }
      s += g;
    }
    p[i] = s / Math.max(1, a1 - a0);
  }
  return p;
}
function argmax(p, a, b) { let k = -1, m = -1; for (let i = Math.max(1, a); i <= Math.min(p.length - 2, b); i++) if (p[i] > m) { m = p[i]; k = i; } return { i: k, v: m }; }
function median(p) { const a = Array.from(p).sort((x, y) => x - y); return a[a.length >> 1] || 1e-6; }

// One side. Edges = local maxima of the gradient profile in the outer 18%. If the first edge is near the photo edge
// and is followed by a flat run (the printed border) before the next edge, it is the card edge and the next one is the
// inner border; otherwise the photo is cropped to the card, so the card edge is the photo edge.
function side(p, n, fromEnd) {
  const q = fromEnd ? Array.from(p).reverse() : Array.from(p), lim = Math.round(n * 0.2), med = median(q);
  let mx = 0; for (let i = 1; i < lim; i++) mx = Math.max(mx, q[i]);
  const thr = Math.max(med * 2.5, mx * 0.35), peaks = [];
  for (let i = 1; i < lim; i++) if (q[i] >= thr && q[i] >= q[i - 1] && q[i] >= q[i + 1]) { if (peaks.length && i - peaks[peaks.length - 1] <= 2) { if (q[i] > q[peaks[peaks.length - 1]]) peaks[peaks.length - 1] = i; } else peaks.push(i); }
  if (!peaks.length) return { width: 0, contrast: 0, outer: 0, inner: 0 };
  let outer = 0, inner = peaks[0];
  if (peaks.length > 1 && peaks[0] <= n * 0.08) {
    const a = peaks[0] + 2, b = peaks[1] - 2; let s = 0, c = 0; for (let i = a; i <= b; i++) { s += q[i]; c++; }
    const flat = c > 0 && s / c < 0.25 * Math.min(q[peaks[0]], q[peaks[1]]);
    if (flat && b - a >= n * 0.008) { outer = peaks[0]; inner = peaks[1]; }
  }
  return { width: inner - outer, contrast: q[inner] / med, outer, inner };
}
export function measureCentering(img) {
  const px = profile(img, 'x', 0.25, 0.75), py = profile(img, 'y', 0.25, 0.75);
  const L = side(px, img.w, false), R = side(px, img.w, true), T = side(py, img.h, false), B = side(py, img.h, true);
  const ratio = (a, b) => { const s = a + b; return s > 0 ? Math.round((Math.max(a, b) / s) * 1000) / 10 : null; };
  const lr = ratio(L.width, R.width), tb = ratio(T.width, B.width);
  const minC = Math.min(L.contrast, R.contrast, T.contrast, B.contrast);
  const bordersOk = [L, R].every(s => s.width >= img.w * 0.012) && [T, B].every(s => s.width >= img.h * 0.012);
  const confidence = !bordersOk || minC < 2.2 ? 'low' : minC < 4 ? 'medium' : 'good';
  return {
    lr, tb, worse: Math.max(lr ?? 100, tb ?? 100), confidence,
    left: L.width, right: R.width, top: T.width, bottom: B.width,
    lines: { x: [L.outer, L.inner, img.w - 1 - R.inner, img.w - 1 - R.outer], y: [T.outer, T.inner, img.h - 1 - B.inner, img.h - 1 - B.outer] },
    leftHeavy: L.width >= R.width, topHeavy: T.width >= B.width
  };
}
// Best grade that the measured front centering alone would not rule out (other factors can still lower it).
export function centeringCaps(m) {
  if (!m || m.lr == null || m.tb == null) return null;
  const psa = (PSA_FRONT.find(([, lim]) => m.worse <= lim) || [4])[0];
  const lo = Math.min(m.lr, m.tb), hi = Math.max(m.lr, m.tb);
  const bgs = (BGS_FRONT.find(t => lo <= t.a && hi <= t.b) || { g: '8.5 or lower' }).g;
  return { psa, bgs };
}
