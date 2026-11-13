// Holowise price server (Cloudflare Worker). Keeps paid API keys server-side and adds CORS for the app's origin only.
// Routes (all JSON):
//   GET  /health                         → {ok, jt, au, license}: which features are switched on (never returns secrets)
//   GET  /jt/cards?…  POST /jt/cards     → JustTCG /v1/cards with Holowise's key (JUSTTCG_API_KEY). Params/body whitelisted,
//                                           cached 12 h at the edge, JustTCG's usage _metadata stripped.
//   GET  /au-price?q=&graded=            → TCG Prices AU /api/v1/price (country AU). Cached 6 h (their terms: max 24 h).
//   GET  /au-history?q=&number=&days=    → TCG Prices AU /search then /price-history → {cardId, history, soldHistory}
//   POST /license          (license_key[, instance_id]) → Lemon Squeezy /v1/licenses/validate
//   POST /license/activate (license_key, instance_name) → Lemon Squeezy /v1/licenses/activate
//        Both return only {valid|activated, error, tier, meta{ids, customer_email}, license_key{status, expires_at}, instance{id}}
//        and enforce LS_STORE_ID / LS_PRODUCT_IDS; tier comes from LS_DEALER_VARIANTS (else 'pro').
// Secrets (wrangler secret put): JUSTTCG_API_KEY, TCGPRICES_API_KEY (both optional; a missing one switches that feature off).
// Vars (wrangler.toml [vars]): ALLOWED_ORIGIN, LS_STORE_ID, LS_PRODUCT_IDS, LS_DEALER_VARIANTS.
// Rate-limit bindings (wrangler.toml [[ratelimits]]): RL_DATA, RL_LICENSE. Optional: without them the Worker still works.
// Never logs request bodies, licence keys or API keys.
const JT = 'https://api.justtcg.com/v1/cards';
const JT_PARAMS = ['tcgplayerId', 'cardId', 'q', 'game', 'set', 'include_price_history', 'priceHistoryDuration', 'condition', 'printing', 'limit'];
const JT_TTL = 12 * 3600, AU_TTL = 6 * 3600;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGIN || 'https://toszk-hub.github.io').split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Accept', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const url = new URL(request.url), path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: ok ? 204 : 403, headers: cors });
    if (path === '/health' && request.method === 'GET') return json({ ok: true, jt: !!env.JUSTTCG_API_KEY, au: !!env.TCGPRICES_API_KEY, license: true }, 200, cors);
    // Browsers always send Origin on these cross-origin calls; anything else is not the app.
    if (!ok) return json({ error: 'forbidden origin' }, 403, cors);
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    try {
      if (path === '/license' || path === '/license/activate') {
        if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);
        if (!(await allow(env.RL_LICENSE, 'lic:' + ip))) return json({ valid: false, activated: false, error: 'Too many licence checks. Try again in a minute.' }, 429, cors);
        return license(request, env, cors, path.endsWith('/activate'));
      }
      if (path === '/jt/cards') {
        if (!env.JUSTTCG_API_KEY) return json({ data: [], disabled: true, error: 'price history not configured' }, 200, cors);
        if (!(await allow(env.RL_DATA, 'jt:' + ip, request.method === 'POST' ? 3 : 1))) return json({ error: 'rate limited' }, 429, cors);
        return justTcg(request, url, env, ctx, cors);
      }
      if (path === '/au-price' || path === '/au-history') {
        if (request.method !== 'GET') return json({ error: 'method not allowed' }, 405, cors);
        if (!env.TCGPRICES_API_KEY) return json({ disabled: true, error: 'AU sold prices not configured' }, 200, cors);
        if (!(await allow(env.RL_DATA, 'au:' + ip, path === '/au-history' ? 2 : 1))) return json({ error: 'rate limited' }, 429, cors);
        const q = (url.searchParams.get('q') || '').slice(0, 200).trim();
        if (!q) return json({ error: 'missing q' }, 400, cors);
        return path === '/au-history' ? auHistory(url, q, env, ctx, cors) : auPrice(url, q, env, ctx, cors);
      }
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: 'upstream error' }, 502, cors);
    }
  }
};

async function allow(rl, key, delta = 1) {
  if (!rl?.limit) return true; // binding not configured: no limit (set it up in wrangler.toml)
  try { const { success } = await rl.limit({ key, delta }); return success; } catch { return true; }
}
const cache = () => (typeof caches !== 'undefined' ? caches.default : null);
async function cached(keyUrl, ttl, ctx, make) {
  const c = cache(), key = new Request(keyUrl);
  if (c) { const hit = await c.match(key); if (hit) return hit; }
  const res = await make();
  if (c && res.status === 200) { const copy = new Response(res.clone().body, res); copy.headers.set('Cache-Control', `public, max-age=${ttl}`); ctx?.waitUntil?.(c.put(key, copy)); }
  return res;
}
async function sha256(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }

// ---- JustTCG ----
async function justTcg(request, url, env, ctx, cors) {
  const up = new URL(JT);
  for (const k of JT_PARAMS) { const v = url.searchParams.get(k); if (v != null && v !== '') up.searchParams.set(k, v.slice(0, 120)); }
  let init = { headers: { 'x-api-key': env.JUSTTCG_API_KEY, Accept: 'application/json' } }, keyUrl;
  if (request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return json({ error: 'bad body' }, 400, cors); }
    if (!Array.isArray(body) || !body.length || body.length > 20) return json({ error: 'body must be an array of 1-20 cards' }, 400, cors);
    const clean = body.map(x => { const o = {}; for (const k of ['cardId', 'tcgplayerId', 'variantId', 'condition', 'printing']) if (x && x[k] != null) o[k] = String(x[k]).slice(0, 120); return o; });
    const s = JSON.stringify(clean);
    init = { method: 'POST', headers: { ...init.headers, 'Content-Type': 'application/json' }, body: s };
    keyUrl = 'https://cache.local/jt-batch/' + (await sha256(up.search + s));
  } else if (request.method === 'GET') {
    if (![...up.searchParams.keys()].some(k => ['tcgplayerId', 'cardId', 'q'].includes(k))) return json({ error: 'missing card' }, 400, cors);
    up.searchParams.sort(); keyUrl = 'https://cache.local/jt' + up.search;
  } else return json({ error: 'method not allowed' }, 405, cors);
  const res = await cached(keyUrl, JT_TTL, ctx, async () => {
    const r = await fetch(up, init);
    const j = await r.json().catch(() => null);
    if (!r.ok || !j) return json({ error: `JustTCG ${r.status}` }, r.status === 429 ? 429 : 502, {});
    delete j._metadata; // usage of Holowise's account is not the client's business
    return json({ ...j, via: 'holowise' }, 200, {});
  });
  return withCors(res, cors);
}

// ---- TCG Prices AU ----
const tpHeaders = env => ({ 'X-API-Key': env.TCGPRICES_API_KEY, Accept: 'application/json' });
async function auPrice(url, q, env, ctx, cors) {
  const up = new URL('https://tcgprices.com.au/api/v1/price');
  up.searchParams.set('q', q); up.searchParams.set('country', 'AU');
  const g = url.searchParams.get('graded'); if (g === 'true' || g === 'false') up.searchParams.set('graded', g);
  const res = await cached('https://cache.local/au-price?' + up.searchParams.toString(), AU_TTL, ctx, async () => {
    const r = await fetch(up, { headers: tpHeaders(env) });
    return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
  return withCors(res, cors);
}
async function tp(upstream, env, ctx) {
  return cached('https://cache.local' + upstream.pathname + '?' + upstream.searchParams.toString(), AU_TTL, ctx, async () => {
    const r = await fetch(upstream, { headers: tpHeaders(env) });
    return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  });
}
async function auHistory(url, q, env, ctx, cors) {
  const num = (url.searchParams.get('number') || '').replace(/^0+(?=\d)/, '');
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '365', 10) || 365));
  const su = new URL('https://tcgprices.com.au/api/v1/search'); su.searchParams.set('q', q);
  const sr = await tp(su, env, ctx);
  if (!sr.ok) return withCors(sr, cors);
  const list = (await sr.json()).data || [];
  const hit = list.find(c => num && String(c.number).replace(/^0+(?=\d)/, '') === num) || (num ? null : list[0]);
  if (!hit) return json({ cardId: null, history: [], soldHistory: [], note: 'no matching card' }, 200, cors);
  const hu = new URL('https://tcgprices.com.au/api/v1/price-history'); hu.searchParams.set('cardId', hit.id); hu.searchParams.set('days', String(days));
  const hr = await tp(hu, env, ctx);
  if (!hr.ok) return withCors(hr, cors);
  const body = await hr.json();
  return json({ cardId: hit.id, name: hit.name, set: hit.set?.name, history: body.history || [], soldHistory: body.soldHistory || [] }, 200, cors);
}

// ---- Lemon Squeezy licences (public licence API: the licence key is the credential, no LS API key needed) ----
async function license(request, env, cors, activate) {
  let key = '', inst = '', name = '';
  try { const f = await request.formData(); key = String(f.get('license_key') || '').trim().slice(0, 100); inst = String(f.get('instance_id') || '').trim().slice(0, 100); name = String(f.get('instance_name') || 'Holowise').trim().slice(0, 60); } catch {}
  if (!key) return json({ valid: false, activated: false, error: 'Enter your licence key.' }, 400, cors);
  const params = activate ? { license_key: key, instance_name: name } : inst ? { license_key: key, instance_id: inst } : { license_key: key };
  const r = await fetch('https://api.lemonsqueezy.com/v1/licenses/' + (activate ? 'activate' : 'validate'), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({}));
  const m = j.meta || {}, st = j.license_key?.status;
  let good = activate ? !!j.activated : !!j.valid, error = j.error || null;
  const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  if (good && (st === 'expired' || st === 'disabled')) { good = false; error = `licence ${st}`; }
  if (good && env.LS_STORE_ID && String(m.store_id) !== String(env.LS_STORE_ID)) { good = false; error = 'That key is for a different store.'; }
  const pids = list(env.LS_PRODUCT_IDS);
  if (good && pids.length && !pids.includes(String(m.product_id))) { good = false; error = 'That key is for a different product.'; }
  const tier = list(env.LS_DEALER_VARIANTS).includes(String(m.variant_id)) ? 'dealer' : 'pro';
  const out = { error, tier: good ? tier : null, meta: { store_id: m.store_id, product_id: m.product_id, variant_id: m.variant_id, customer_email: m.customer_email },
    license_key: { status: st, expires_at: j.license_key?.expires_at || null }, instance: j.instance?.id ? { id: j.instance.id } : null };
  out[activate ? 'activated' : 'valid'] = good;
  return json(out, 200, cors);
}

function json(o, status, cors) { return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...cors } }); }
function withCors(res, cors) { const h = new Headers(res.headers); for (const [k, v] of Object.entries(cors)) h.set(k, v); return new Response(res.body, { status: res.status, headers: h }); }
