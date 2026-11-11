// CardLens AU — optional AU price proxy (Cloudflare Worker). NOT deployed by default.
// Holds your TCG Prices AU API key server-side (their terms forbid client-side keys) and adds CORS for your site.
//   GET /au-price?q=<search>&graded=true|false  →  TCG Prices AU /api/v1/price?q=...&country=AU[&graded=...]
//   GET /au-history?q=<name>&number=<n>&days=<1-365>  →  /api/v1/search?q=... (picks the card whose number matches),
//        then /api/v1/price-history?cardId=...&days=...   (returns {cardId, history, soldHistory})
// Secrets / vars:  TCGPRICES_API_KEY (secret, required)   ALLOWED_ORIGIN (var, e.g. https://toszk-hub.github.io)
// Caches each query at the edge for 6 hours (their terms allow up to 24 h).
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || 'https://toszk-hub.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (!['/au-price', '/au-history'].includes(url.pathname) || request.method !== 'GET') return new Response('Not found', { status: 404, headers: cors });
    if (origin && !allowed.includes(origin)) return new Response('Forbidden origin', { status: 403, headers: cors });
    const q = (url.searchParams.get('q') || '').slice(0, 200).trim();
    if (!q) return json({ error: 'missing q' }, 400, cors);
    if (!env.TCGPRICES_API_KEY) return json({ error: 'proxy not configured' }, 500, cors);
    if (url.pathname === '/au-history') return auHistory(url, q, env, ctx, cors);
    const up = new URL('https://tcgprices.com.au/api/v1/price');
    up.searchParams.set('q', q); up.searchParams.set('country', 'AU');
    const g = url.searchParams.get('graded'); if (g === 'true' || g === 'false') up.searchParams.set('graded', g);
    const cache = typeof caches !== 'undefined' ? caches.default : null;
    const key = new Request('https://cache.local/au-price?' + up.searchParams.toString());
    if (cache) { const hit = await cache.match(key); if (hit) return withCors(hit, cors); }
    const r = await fetch(up, { headers: { 'X-API-Key': env.TCGPRICES_API_KEY, Accept: 'application/json' } });
    const body = await r.text();
    const res = new Response(body, { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' } });
    if (cache && r.ok) ctx.waitUntil(cache.put(key, res.clone()));
    return withCors(res, cors);
  }
};
async function cachedFetch(upstream, env, ctx) {
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const key = new Request('https://cache.local/' + upstream.pathname + '?' + upstream.searchParams.toString());
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  const r = await fetch(upstream, { headers: { 'X-API-Key': env.TCGPRICES_API_KEY, Accept: 'application/json' } });
  const res = new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600' } });
  if (cache && r.ok) ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}
async function auHistory(url, q, env, ctx, cors) {
  const num = (url.searchParams.get('number') || '').replace(/^0+(?=\d)/, '');
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '365', 10) || 365));
  const su = new URL('https://tcgprices.com.au/api/v1/search'); su.searchParams.set('q', q);
  const sr = await cachedFetch(su, env, ctx);
  if (!sr.ok) return withCors(sr, cors);
  const list = (await sr.json()).data || [];
  const hit = list.find(c => num && String(c.number).replace(/^0+(?=\d)/, '') === num) || (num ? null : list[0]);
  if (!hit) return json({ cardId: null, history: [], soldHistory: [], note: 'no matching card' }, 200, cors);
  const hu = new URL('https://tcgprices.com.au/api/v1/price-history'); hu.searchParams.set('cardId', hit.id); hu.searchParams.set('days', String(days));
  const hr = await cachedFetch(hu, env, ctx);
  if (!hr.ok) return withCors(hr, cors);
  const body = await hr.json();
  return json({ cardId: hit.id, name: hit.name, set: hit.set?.name, history: body.history || [], soldHistory: body.soldHistory || [] }, 200, cors);
}
function json(o, status, cors) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } }); }
function withCors(res, cors) { const h = new Headers(res.headers); for (const [k, v] of Object.entries(cors)) h.set(k, v); return new Response(res.body, { status: res.status, headers: h }); }
