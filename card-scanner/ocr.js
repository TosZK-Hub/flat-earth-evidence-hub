// CardLens AU — OCR pipeline v2 (browser + Node via injected canvas factory).
// Multi-pass: contrast stretch → adaptive threshold (both polarities) → italic de-shear → tight OP code crop with whitelist.
import { parseAllOnePiece, parseAllPokemon, parseNameWords } from './core.js?v=3';

// ---------- image helpers (operate on canvases) ----------
export function makeTools(mkCanvas) {
  function crop(r, top, bottom, left, right, { scale = 3, maxW = 1800, shear = 0, rotate = 0 } = {}) {
    const sx = r.x + r.w * left, sy = r.y + r.h * top, sw = r.w * (right - left), sh = r.h * (bottom - top);
    let k = scale; if (sw * k > maxW) k = maxW / sw; if (k < 1) k = 1;
    const W = Math.round(sw * k), H = Math.round(sh * k);
    const pad = Math.ceil(Math.abs(shear) * H);
    const c = mkCanvas(W + pad, H), g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.save();
    if (rotate) { g.translate(c.width / 2, H / 2); g.rotate(rotate * Math.PI / 180); g.translate(-c.width / 2, -H / 2); }
    if (shear) g.transform(1, 0, -shear, 1, shear > 0 ? pad : 0, 0); // x' = x - shear*y (undo forward italic slant)
    g.drawImage(r.src, sx, sy, sw, sh, 0, 0, W, H);
    g.restore();
    return c;
  }
  function gray(c) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), p = d.data, n = p.length / 4, y = new Float32Array(n);
    for (let i = 0, j = 0; j < n; i += 4, j++) y[j] = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    return { w: c.width, h: c.height, y };
  }
  function put(img, c) {
    c = c || mkCanvas(img.w, img.h); c.width = img.w; c.height = img.h;
    const g = c.getContext('2d'), d = g.createImageData(img.w, img.h), p = d.data;
    for (let j = 0, i = 0; j < img.y.length; j++, i += 4) { const v = img.y[j] < 0 ? 0 : img.y[j] > 255 ? 255 : img.y[j]; p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  }
  function stretch(img, invert = false) {
    const hist = new Uint32Array(256); for (const v of img.y) hist[v | 0]++;
    const n = img.y.length; let lo = 0, hi = 255, a = 0;
    for (; lo < 255; lo++) { a += hist[lo]; if (a > n * 0.01) break; }
    a = 0; for (; hi > 0; hi--) { a += hist[hi]; if (a > n * 0.01) break; }
    const s = Math.max(hi - lo, 1), y = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = (img.y[i] - lo) * 255 / s; if (invert) v = 255 - v; y[i] = v; }
    return { ...img, y };
  }
  function sharpen(img, amt = 0.8) { // unsharp mask, 3x3 box blur
    const { w, h } = img, s = img.y, o = new Float32Array(s.length);
    for (let yy = 0; yy < h; yy++) for (let x = 0; x < w; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -1; dy <= 1; dy++) { const r = yy + dy; if (r < 0 || r >= h) continue; for (let dx = -1; dx <= 1; dx++) { const q = x + dx; if (q < 0 || q >= w) continue; sum += s[r * w + q]; cnt++; } }
      const i = yy * w + x; o[i] = s[i] + amt * (s[i] - sum / cnt);
    }
    return { ...img, y: o };
  }
  // Bradley/Sauvola-style mean adaptive threshold using an integral image. Output: text black on white.
  function adaptive(img, { win = 0, C = 12, polarity = 'dark' } = {}) {
    const { w, h } = img, s = img.y; win = win || Math.max(15, Math.round(h / 3) | 1);
    const I = new Float64Array((w + 1) * (h + 1));
    for (let yy = 0; yy < h; yy++) { let row = 0; for (let x = 0; x < w; x++) { row += s[yy * w + x]; I[(yy + 1) * (w + 1) + x + 1] = I[yy * (w + 1) + x + 1] + row; } }
    const o = new Float32Array(s.length), r = win >> 1;
    for (let yy = 0; yy < h; yy++) for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1), y0 = Math.max(0, yy - r), y1 = Math.min(h, yy + r + 1);
      const m = (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0));
      const v = s[yy * w + x];
      const isText = polarity === 'dark' ? v < m - C : v > m + C; // dark text on light, or light text (e.g. white numbers) on dark
      o[yy * w + x] = isText ? 0 : 255;
    }
    return { ...img, y: o };
  }
  return { crop, gray, put, stretch, sharpen, adaptive };
}

// ---------- pipeline ----------
// recognize(canvas, {psm, whitelist}) -> Promise<string>
// validate(parse) -> Promise<{ list, strong }>  (looks the parse up; strong = the OCR'd name agrees, or no name to compare)
// Stops at the first STRONG validated parse; otherwise returns the first weak one. Returns { best, tried, text, calls }.
export async function readCardV2(r, { recognize, mkCanvas, mode = 'auto', quick = false, onStep = () => {}, budget = 16, validate = null, validTotals = null }) {
  const T = makeTools(mkCanvas);
  const texts = [], tried = new Map(); let calls = 0, best = null, weak = null;
  const wantOP = mode !== 'pokemon', wantPK = mode !== 'onepiece';
  const consider = async (t, via) => {
    const cands = [];
    if (wantOP) for (const c of parseAllOnePiece(t)) cands.push({ opCode: c.code, guessed: c.guessed, via });
    if (wantPK) for (const c of parseAllPokemon(t, validTotals)) cands.push({ pkNumber: c, guessed: c.repaired, via });
    for (const c of cands) {
      const key = c.opCode || `${c.pkNumber.number}/${c.pkNumber.total}`;
      if (tried.has(key)) continue;
      if (!validate) { tried.set(key, c); if (!weak) weak = c; best = best || c; continue; }
      const v = await validate(c); c.list = v.list; c.strong = v.strong; tried.set(key, c);
      if (v.list?.length) { if (v.strong) { best = c; return true; } if (!weak) weak = c; }
    }
    return false;
  };
  const run = async (canvas, params, via) => {
    if (calls >= budget || best) return !!best;
    calls++; const t = await recognize(canvas, params); texts.push(`[${via}] ${t.replace(/\s+/g, ' ').trim()}`);
    return consider(t, via);
  };
  const prep = (c, fn) => T.put(fn(T.gray(c)));
  const BL = [0.875, 0.99, 0, 0.55], BR = [0.875, 0.99, 0.45, 1];
  const OPW = [0.9, 0.99, 0.45, 1];
  const L = g => T.adaptive(T.sharpen(g), { polarity: 'light' }), D = g => T.adaptive(T.sharpen(g), { polarity: 'dark' });
  const fin = () => ({ best: best || weak, strong: !!best, tried: [...tried.values()], text: texts.join('\n'), calls });

  onStep('Reading number…');
  if (wantPK && await run(prep(T.crop(r, ...BL), g => T.stretch(g)), { psm: '11' }, 'BL')) return fin();
  if (await run(prep(T.crop(r, ...BR), g => T.stretch(g)), { psm: '11' }, 'BR')) return fin();
  if (quick) return fin();

  if (wantOP) {
    onStep('Looking for a One Piece code…');
    const c = T.crop(r, ...OPW, { scale: 3 });
    for (const [fn, nm] of [[L, 'OP-light'], [g => T.stretch(T.sharpen(g)), 'OP-sharp'], [D, 'OP-dark'], [g => T.stretch(g, true), 'OP-inv']])
      if (await run(prep(c, fn), { psm: '11' }, nm)) return fin();
  }
  if (wantPK) {
    onStep('Trying sharper contrast…');
    for (const [box, nm] of [[BL, 'BL'], [BR, 'BR']]) {
      const c = T.crop(r, ...box, { scale: 3 });
      if (await run(prep(c, L), { psm: '11' }, nm + '-light')) return fin();
      if (await run(prep(c, D), { psm: '11' }, nm + '-dark')) return fin();
    }
    onStep('Trying italic correction…');
    for (const [box, nm] of [[[0.89, 1.0, 0, 0.55], 'BLlow'], [BL, 'BL']]) {
      const c = T.crop(r, ...box, { scale: 3, shear: 0.22 });
      if (await run(prep(c, g => T.adaptive(g, { polarity: 'light', C: 8 })), { psm: '11' }, nm + '-shear-light')) return fin();
      if (await run(prep(c, g => T.stretch(g, true)), { psm: '11' }, nm + '-shear-inv')) return fin();
    }
    for (const rot of [-3, 3]) if (await run(prep(T.crop(r, ...BL, { scale: 3, rotate: rot }), L), { psm: '11' }, `BL-rot${rot}`)) return fin();
  }
  return fin();
}

export async function readNameV2(r, { recognize, mkCanvas, isOP }) {
  const T = makeTools(mkCanvas);
  if (isOP) { // One Piece: name sits in the lower third, above the type line; try normal + inverted (dark name bars)
    const c = T.crop(r, 0.835, 0.935, 0.1, 0.9, { scale: 2 });
    let t = await recognize(T.put(T.stretch(T.gray(c))), { psm: '11' });
    if (!parseNameWords(t).length) t += '\n' + await recognize(T.put(T.stretch(T.gray(c), true)), { psm: '11' });
    return { text: t, names: parseNameWords(t) };
  }
  const c = T.crop(r, 0.0, 0.12, 0, 1, { scale: 2 });
  const t = await recognize(T.put(T.stretch(T.gray(c))), { psm: '11' });
  return { text: t, names: parseNameWords(t) };
}
