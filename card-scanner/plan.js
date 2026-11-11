// Holowise — plans, limits and licence state (pure where possible; storage passed in for tests).
// Free stays genuinely useful (unlimited scans, prices, deal verdicts, CSV). Pro/Dealer unlock the tools that save
// collectors and dealers money. A trial is a local, no-payment preview: it unlocks Pro for TRIAL days, once.
import { PAY } from './config.js?v=6';
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
export const checkoutLive = () => Object.values(PAY.checkout).some(Boolean);
export function startTrial(store) { const p = load(store); if (p.trialStart) return false; p.trialStart = Date.now(); save(p, store); return true; }
// Validate a Lemon Squeezy licence key (through your Worker if PAY.licenseApi is set) and map it to a tier.
export async function validateLicense(key, { fetchFn = fetch, store } = {}) {
  key = String(key || '').trim(); if (!key) throw new Error('Enter your licence key.');
  const url = PAY.licenseApi || 'https://api.lemonsqueezy.com/v1/licenses/validate';
  const r = await fetchFn(url, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ license_key: key }).toString() });
  const j = await r.json().catch(() => ({}));
  if (!j.valid) throw new Error(j.error || 'That licence key is not valid.');
  const m = j.meta || {};
  if (PAY.store.storeId && m.store_id !== PAY.store.storeId) throw new Error('That key is for a different store.');
  if (PAY.store.productIds.length && !PAY.store.productIds.includes(m.product_id)) throw new Error('That key is for a different product.');
  const tier = PAY.variants.dealer.includes(m.variant_id) ? 'dealer' : 'pro';
  const p = load(store); p.license = { valid: true, tier, key: key.slice(0, 4) + '…' + key.slice(-4), full: key, expiresAt: j.license_key?.expires_at || null, checkedAt: Date.now(), email: m.customer_email || '' };
  save(p, store); return p.license;
}
export function clearLicense(store) { const p = load(store); delete p.license; save(p, store); }
