// Holowise — tiny RFC-4180 CSV reader/writer.
export function toCSV(rows, cols) {
  const q = v => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => q(r[c])).join(','))].join('\n');
}
export function parseCSV(text) {
  const rows = []; let row = [], f = '', i = 0, inq = false;
  text = String(text).replace(/^\uFEFF/, '');
  while (i < text.length) {
    const ch = text[i];
    if (inq) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else inq = false; } else f += ch; }
    else if (ch === '"') inq = true;
    else if (ch === ',') { row.push(f); f = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += ch;
    i++;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const clean = rows.filter(r => r.some(x => x.trim() !== ''));
  if (!clean.length) return [];
  const head = clean[0].map(h => h.trim());
  return clean.slice(1).map(r => Object.fromEntries(head.map((h, k) => [h, (r[k] ?? '').trim()])));
}
