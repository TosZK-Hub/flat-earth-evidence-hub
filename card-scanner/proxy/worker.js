// CardLens AU — optional AU price proxy (Cloudflare Worker). NOT deployed by default.
// Holds your TCG Prices AU API key server-side (their terms forbid client-side keys) and adds CORS for your site.
//   GET /au-price?q=<search>&graded=true|false  →  TCG Prices AU /api/v1/price?q=...&country=AU[&graded=...]
// Secrets / vars:  TCGPRICES_API_KEY (secret, required)   ALLOWED_ORIGIN (var, e.g. https://toszk-hub.github.io)
// Caches each query at the edge for 6 hours (their terms allow up to 24 h).
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || 'https://toszk-hub.github.io').split(',').map(s => s.trim());
    const cors = { 'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (url.pathname !== '/au-price' || request.method !== 'GET') return new Response('Not found', { status: 404, headers: cors });
    if (origin && !allowed.includes(origin)) return new Response('Forbidden origin', { status: 403, headers: cors });
    const q = (url.searchParams.get('q') || '').slice(0, 200).trim();
    if (!q) return json({ error: 'missing q' }, 400, cors);
    if (!env.TCGPRICES_API_KEY) return json({ error: 'proxy not configured' }, 500, cors);
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
function json(o, status, cors) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } }); }
function withCors(res, cors) { const h = new Headers(res.headers); for (const [k, v] of Object.entries(cors)) h.set(k, v); return new Response(res.body, { status: res.status, headers: h }); }
