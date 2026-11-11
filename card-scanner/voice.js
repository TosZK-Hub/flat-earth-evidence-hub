// Holowise — hands-free command parsing and spoken summaries (pure). Works with the Web Speech API where the browser
// has it; the same text commands can be typed, and a glasses app can send them too.
const WORDS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export function parseAmount(t) {
  t = String(t).toLowerCase().replace(/,/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|thousand|hundred)?/);
  if (m) { let v = parseFloat(m[1]); if (m[2] === 'k' || m[2] === 'thousand') v *= 1000; if (m[2] === 'hundred') v *= 100; return v; }
  let total = 0, cur = 0, any = false;
  for (const w of t.split(/[\s-]+/)) {
    if (w in WORDS) { cur += WORDS[w]; any = true; }
    else if (w === 'hundred' && any) cur *= 100;
    else if ((w === 'thousand' || w === 'grand') && any) { total += cur * 1000; cur = 0; }
  }
  return any ? total + cur : null;
}
// Returns { cmd, value? } or null. Commands: scan, add, watch, deal <amount>, repeat, next, batch, stop, help, sell, grade.
export function parseCommand(text) {
  const t = String(text || '').toLowerCase().trim().replace(/^(hey |ok |okay )?(holo ?wise[,]? )?/, '');
  if (!t) return null;
  if (/\b(deal|offer|asking|they want|price is|for)\b/.test(t)) { const v = parseAmount(t); if (v != null) return { cmd: 'deal', value: v }; }
  if (/^\$?\d/.test(t)) { const v = parseAmount(t); if (v != null) return { cmd: 'deal', value: v }; }
  const map = [[/\b(scan|capture|snap|read (it|this))\b/, 'scan'], [/\b(add|collect|save)\b/, 'add'], [/\bwatch\b/, 'watch'], [/\b(repeat|again|say that)\b/, 'repeat'],
    [/\b(next|continue|resume)\b/, 'next'], [/\bbatch\b/, 'batch'], [/\b(stop|quiet|exit|cancel|off)\b/, 'stop'], [/\b(help|commands)\b/, 'help'],
    [/\b(sell|where)\b/, 'sell'], [/\bgrade\b/, 'grade']];
  for (const [re, cmd] of map) if (re.test(t)) return { cmd };
  return null;
}
const say$ = n => n == null ? 'no price' : n >= 100 ? `${Math.round(n)} dollars` : `${n.toFixed(2).replace(/\.00$/, '')} dollars`;
export function spokenCard({ name, number, aud, buyMax, verdict, signal }) {
  const parts = [`${String(name).replace(/\(.*?\)/g, '').trim()}${number ? ', ' + number : ''}.`];
  parts.push(aud != null ? `Market about ${say$(aud)}, estimate.` : 'No price found.');
  if (buyMax != null) parts.push(`Max buy ${say$(buyMax)}.`);
  if (verdict) parts.push(`${verdict.label}: ${verdict.short}.`);
  if (signal) parts.push(`Trend: ${signal}.`);
  return parts.join(' ');
}
