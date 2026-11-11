// Holowise — JustTCG call budget. Free tier: 100 calls/day, 1,000/month, 10/min.
// Truth comes from JustTCG's own `_metadata` on each response; a local counter fills the gap before the first call.
const KEY = 'hw:jtbudget';
export const LIMITS = { day: 100, month: 1000 };
const utcDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10), utcMonth = (t = Date.now()) => utcDay(t).slice(0, 7);
export function load(store = globalThis.localStorage) {
  let b; try { b = JSON.parse(store?.getItem(KEY) || 'null'); } catch { b = null; }
  b = b || {};
  if (b.day !== utcDay()) { b.day = utcDay(); b.dayUsed = 0; b.metaDay = null; }
  if (b.month !== utcMonth()) { b.month = utcMonth(); b.monthUsed = 0; b.metaMonth = null; }
  return b;
}
function save(b, store) { try { store?.setItem(KEY, JSON.stringify(b)); } catch {} }
export function record(meta, store = globalThis.localStorage) {
  const b = load(store); b.dayUsed++; b.monthUsed++;
  if (meta && typeof meta === 'object') {
    if (meta.apiDailyRequestsUsed != null) b.metaDay = meta.apiDailyRequestsUsed;
    if (meta.apiRequestsUsed != null) b.metaMonth = meta.apiRequestsUsed;
    if (meta.apiDailyLimit) b.dayLimit = meta.apiDailyLimit;
    if (meta.apiRequestLimit) b.monthLimit = meta.apiRequestLimit;
    if (meta.apiPlan) b.plan = meta.apiPlan;
    b.metaAt = Date.now();
  }
  save(b, store); return usage(store);
}
export function usage(store = globalThis.localStorage) {
  const b = load(store);
  const dayLimit = b.dayLimit || LIMITS.day, monthLimit = b.monthLimit || LIMITS.month;
  const day = Math.max(b.metaDay ?? 0, b.dayUsed || 0), month = Math.max(b.metaMonth ?? 0, b.monthUsed || 0);
  return { day, month, dayLimit, monthLimit, dayLeft: Math.max(0, dayLimit - day), monthLeft: Math.max(0, monthLimit - month), plan: b.plan || null, fromApi: b.metaAt ? new Date(b.metaAt).toISOString() : null };
}
// How many calls an automatic refresh may spend now. Keeps a reserve for scanning and spreads the month evenly.
export function allowance({ reserveDay = 25, maxPerRun = 3, store = globalThis.localStorage, now = Date.now() } = {}) {
  const u = usage(store);
  const d = new Date(now), daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const daysLeft = daysInMonth - d.getUTCDate() + 1;
  const monthlyPace = Math.floor(u.monthLeft / daysLeft); // fair share per remaining day
  return Math.max(0, Math.min(maxPerRun, u.dayLeft - reserveDay, monthlyPace));
}
