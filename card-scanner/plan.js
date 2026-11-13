// Holowise — plans, limits and licence state (pure where possible; storage passed in for tests).
// Free stays genuinely useful (unlimited scans, prices, deal verdicts, CSV). Pro/Dealer unlock the tools that save
// collectors and dealers money. A trial is a local, no-payment preview: it unlocks Pro for TRIAL days, once.
import { PAY, PROXY } from './config.js?v=7';
export const TIERS = { free: 0, trial: 1, pro: 1, dealer: 2 };
export const LIMITS = {
  free: { collection: 100, watchlist: 3, batch: 10, historyDays: 90 },
  pro: { collection: Infinity, watchlist: 100, batch: 50, historyDays: Infinity },
  dealer: { collection: Infinity, watchlist: 500, batch: Infinity, historyDays: Infinity }
};
// feature -> minimum tier
export const FEATURES = {
  handsfree: 'pro', centering: 'pro', grading: 'pro', sell: 'pro', alerts: 'pro', history1y: 'pro', trade: 'pro',
  show: 'pro', showSets: 'dealer', batchBig: 'dealer'
};
export const FEATURE_NAMES = {
  handsfree: 'Hands-free mode', centering: 'Centering check', grading: '"Should I grade it?" calculator', sell: 'AU net proceeds by channel',
  alerts: 'Price alerts', history1y: '1-year price history', trade: 'Trade calculator', show: 'Offline show mode', showSets: 'Offline set packs', batchBig: 'Unlimited batch sessions'
};
const KEY = 'hw:plan';
export function load(store = globalThis.localStorage) { try { return JSON.parse(store?.getItem(KEY) || '{}'); } catch { return {}; } }
export function save(p, store = globalThis.localStorage) { try { store?.setItem(KEY, JSON.stringify(p)); } catch {} }
export function current(p = load(), now = Date.now()) {
  if (p.license?.valid && p.license.tier) {
    const exp = p.license.expiresAt ? Date.parse(p.license.expiresAt) : null;
    const graceOk = now - (p.license.checkedAt || 0) < 14 * 864e5; // offline grace: 14 days since last good check
    if ((!exp || exp > now) && graceOk) return { tier: p.license.tier, via: 'licence', until: p.license.expiresAt || null };
  }
  if (p.trialStart && now - p.trialStart < PAY.trialDays * 864e5) return { tier: 'pro', via: 'trial', until: new Date(p.trialStart + PAY.trialDays * 864e5).toISOString() };
  return { tier: 'free', via: null, until: null };
}
export const has = (feature, cur = current()) => TIERS[cur.tier] >= TIERS[FEATURES[feature] || 'free'];
export const limit = (k, cur = current()) => (LIMITS[cur.tier === 'trial' ? 'pro' : cur.tier] || LIMITS.free)[k];
// A checkout link counts only if it's a real https URL; anything else keeps its button disabled.
export const checkoutUrl = k => { const u = String(PAY.checkout?.[k] || '').trim(); return /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; };
export const checkoutLive = () => Object.keys(PAY.checkout || {}).some(k => checkoutUrl(k));
export function startTrial(store) { const p = load(store); if (p.trialStart) return false; p.trialStart = Date.now(); save(p, store); return true; }
// Where licence calls go: PAY.licenseApi, else the Worker's /license, else Lemon Squeezy's public licence API (CORS-enabled, no API key).
export function licenseEndpoints(proxyUrl = PROXY.url) {
  const base = (PAY.licenseApi || (proxyUrl ? String(proxyUrl).replace(/\/+$/, '') + '/license' : '')).replace(/\/+$/, '');
  return base ? { validate: base, activate: base + '/activate' } : { validate: 'https://api.lemonsqueezy.com/v1/licenses/validate', activate: 'https://api.lemonsqueezy.com/v1/licenses/activate' };
}
const ids = a => (a || []).map(String);
// Map a Lemon Squeezy response to a tier, enforcing store/product IDs. Throws with a plain message when the key can't be used.
export function tierFrom(j) {
  const m = j.meta || {}, st = j.license_key?.status;
  if (st === 'expired') throw new Error('That licence has expired. Renew it from your receipt email.');
  if (st === 'disabled') throw new Error('That licence has been disabled.');
  if (PAY.store.storeId && String(m.store_id) !== String(PAY.store.storeId)) throw new Error('That key is for a different store.');
  if (PAY.store.productIds.length && !ids(PAY.store.productIds).includes(String(m.product_id))) throw new Error('That key is for a different product.');
  if (j.tier === 'dealer' || j.tier === 'pro') return j.tier;
  return ids(PAY.variants.dealer).includes(String(m.variant_id)) ? 'dealer' : 'pro';
}
const post = (fetchFn, url, params) => fetchFn(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params).toString() });
// Re-check a licence (and its device activation if there is one). Used on startup every 7 days.
export async function validateLicense(key, { fetchFn = fetch, store, instanceId, proxyUrl } = {}) {
  key = String(key || '').trim(); if (!key) throw new Error('Enter your licence key.');
  const p0 = load(store); instanceId = instanceId ?? (p0.license?.full === key ? p0.license.instanceId : undefined);
  const r = await post(fetchFn, licenseEndpoints(proxyUrl).validate, instanceId ? { license_key: key, instance_id: instanceId } : { license_key: key });
  const j = await r.json().catch(() => ({}));
  if (!j.valid) throw new Error(j.error || 'That licence key is not valid.');
  return remember(key, j, instanceId || null, store);
}
// First use on a device: activate (counts against the product's activation limit in Lemon Squeezy, so one key can't unlock
// unlimited phones). Falls back to a plain validate if the store doesn't use activations.
export async function activateLicense(key, { fetchFn = fetch, store, proxyUrl, name = PAY.activationName || 'Holowise' } = {}) {
  key = String(key || '').trim(); if (!key) throw new Error('Enter your licence key.');
  const r = await post(fetchFn, licenseEndpoints(proxyUrl).activate, { license_key: key, instance_name: String(name).slice(0, 60) });
  const j = await r.json().catch(() => ({}));
  if (j.activated) return remember(key, j, j.instance?.id || null, store);
  if (r.status === 404 && !j.error) return validateLicense(key, { fetchFn, store, proxyUrl }); // older Worker without /activate
  throw new Error(j.error || 'That licence key is not valid.');
}
function remember(key, j, instanceId, store) {
  const tier = tierFrom(j), m = j.meta || {};
  const p = load(store); p.license = { valid: true, tier, key: key.slice(0, 4) + '…' + key.slice(-4), full: key, instanceId, expiresAt: j.license_key?.expires_at || null, checkedAt: Date.now(), email: m.customer_email || '' };
  save(p, store); return p.license;
}
export function clearLicense(store) { const p = load(store); delete p.license; save(p, store); }
