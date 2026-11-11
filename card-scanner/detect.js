// Holowise — lightweight card-frame detector (no OpenCV; ~1 ms per frame on a phone at 200 px).
export const TUNE = { PCT: 0.7, FLOOR: 30, SIDE: 0.5, BIG: 3 }; // tuned on test/det, checked on a held-out set
// Idea: a card is a bright/dark rectangle with strong straight edges, ~63:88. On a small grayscale thumbnail we
// compute Sobel gradients, then column/row "edge energy" profiles. The card's left/right edges are the column pair with
// the strongest vertical-edge energy (and top/bottom the row pair with the strongest horizontal energy) whose box has a
// card-like aspect ratio. A second pass re-measures each profile only inside the found box to tighten it.
// Pure functions on {w, h, y:Float32Array|Uint8ClampedArray} so they run in Node tests too.

export const CARD_RATIO = 88 / 63; // height / width

export function sobel(img) {
  const { w, h, y } = img, gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  for (let r = 1; r < h - 1; r++) for (let c = 1; c < w - 1; c++) {
    const i = r * w + c;
    const a = y[i - w - 1], b = y[i - w], d = y[i - w + 1], e = y[i - 1], f = y[i + 1], g = y[i + w - 1], k = y[i + w], m = y[i + w + 1];
    gx[i] = Math.abs((d + 2 * f + m) - (a + 2 * e + g));
    gy[i] = Math.abs((g + 2 * k + m) - (a + 2 * b + d));
  }
  return { gx, gy };
}

// Fraction of positions along a line where a strong edge is present (tolerates ±tol px, so slight tilt is OK).
function vCoverage(w, gx, thr, c, y0, y1, tol) {
  let hit = 0;
  for (let r = y0; r < y1; r++) { let ok = false; for (let d = -tol; d <= tol && !ok; d++) { const q = c + d; if (q > 0 && q < w - 1 && gx[r * w + q] > thr) ok = true; } if (ok) hit++; }
  return hit / Math.max(1, y1 - y0);
}
function hCoverage(w, h, gy, thr, r, x0, x1, tol) {
  let hit = 0;
  for (let c = x0; c < x1; c++) { let ok = false; for (let d = -tol; d <= tol && !ok; d++) { const q = r + d; if (q > 0 && q < h - 1 && gy[q * w + c] > thr) ok = true; } if (ok) hit++; }
  return hit / Math.max(1, x1 - x0);
}
function peaks(p, minV, gap) { // local maxima above minV, at least `gap` apart (keep the stronger)
  const out = [];
  for (let i = 1; i < p.length - 1; i++) if (p[i] >= minV && p[i] >= p[i - 1] && p[i] >= p[i + 1]) {
    const last = out[out.length - 1];
    if (last && i - last.i < gap) { if (p[i] > last.v) out[out.length - 1] = { i, v: p[i] }; } else out.push({ i, v: p[i] });
  }
  return out;
}
function threshold(gx, gy) { // ~85th percentile of gradient magnitude, floor 40
  const s = []; for (let i = 0; i < gx.length; i += 7) s.push(Math.max(gx[i], gy[i]));
  s.sort((a, b) => a - b); return Math.max(TUNE.FLOOR, s[Math.floor(s.length * TUNE.PCT)] || 40);
}

// Returns { found, x, y, w, h, score, ratio } in thumbnail pixels.
export function detectCard(img, { minFrac = 0.4, minCov = 0.4 } = {}) {
  const { w, h } = img;
  const { gx, gy } = sobel(img);
  const thr = threshold(gx, gy), tol = Math.max(1, Math.round(w / 90));
  const colCov = new Float32Array(w), rowCov = new Float32Array(h);
  const yb0 = Math.round(h * 0.38), yb1 = Math.round(h * 0.62), xb0 = Math.round(w * 0.36), xb1 = Math.round(w * 0.64);
  for (let c = 1; c < w - 1; c++) colCov[c] = vCoverage(w, gx, thr, c, yb0, yb1, tol);
  for (let r = 1; r < h - 1; r++) rowCov[r] = hCoverage(w, h, gy, thr, r, xb0, xb1, tol);
  const gap = Math.max(3, Math.round(w * 0.03));
  const V = peaks(colCov, minCov, gap), Hh = peaks(rowCov, minCov, gap);
  // min card width relative to the largest card that fits (landscape frames are limited by height)
  const minW = Math.min(w, h / CARD_RATIO) * minFrac;
  let best = null;
  for (let i = 0; i < V.length; i++) for (let j = i + 1; j < V.length; j++) {
    const L = V[i], R = V[j], bw = R.i - L.i; if (bw < minW) continue;
    const expH = bw * CARD_RATIO;
    for (let a = 0; a < Hh.length; a++) for (let b = a + 1; b < Hh.length; b++) {
      const T = Hh[a], B = Hh[b], bh = B.i - T.i, err = Math.abs(bh / expH - 1);
      if (err > 0.12) continue;
      // check that all four sides really run along the box (not just through the middle band)
      const sides = [vCoverage(w, gx, thr, L.i, T.i + 2, B.i - 2, tol), vCoverage(w, gx, thr, R.i, T.i + 2, B.i - 2, tol),
        hCoverage(w, h, gy, thr, T.i, L.i + 2, R.i - 2, tol), hCoverage(w, h, gy, thr, B.i, L.i + 2, R.i - 2, tol)];
      const minSide = Math.min(...sides);
      if (minSide < TUNE.SIDE) continue;
      const score = sides.reduce((s, v) => s + v, 0) + (bw / w) * TUNE.BIG - err * 4; // prefer complete, larger (outer) boxes
      if (!best || score > best.score) best = { x: L.i, y: T.i, w: bw, h: bh, score, minSide, ratio: bh / bw };
    }
  }
  if (!best) return { found: false, score: 0 };
  return { found: true, ...best };
}

// Mean absolute difference between two same-size thumbnails (0–255). Used for "is the phone steady?".
export function frameDiff(a, b) {
  if (!a || !b || a.y.length !== b.y.length) return 255;
  let s = 0; const n = a.y.length; for (let i = 0; i < n; i += 2) s += Math.abs(a.y[i] - b.y[i]); return s / (n / 2);
}
export function iou(a, b) {
  if (!a || !b) return 0;
  const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0); return inter / (a.w * a.h + b.w * b.h - inter || 1);
}

// Tracks steadiness across frames. push() each frame; returns {state:'none'|'moving'|'steady', box}.
export function makeSteadyTracker({ need = 4, maxDiff = 6, minIoU = 0.9 } = {}) {
  let prev = null, prevBox = null, count = 0;
  return {
    push(img, det) {
      const d = frameDiff(prev, img); prev = img;
      const box = det?.found ? det : null;
      const same = box && prevBox && iou(box, prevBox) >= minIoU;
      prevBox = box;
      if (box && same && d <= maxDiff) count++; else count = box ? 1 : 0;
      return { state: !box ? (d <= maxDiff ? 'still-nocard' : 'none') : count >= need ? 'steady' : 'moving', box, diff: d, count };
    },
    reset() { prev = null; prevBox = null; count = 0; }
  };
}
