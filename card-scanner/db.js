// Holowise — on-device storage (IndexedDB). Nothing here leaves the phone.
const NAME = 'holowise', VER = 1;
const STORES = { collection: { keyPath: 'key', autoIncrement: true }, watchlist: { keyPath: 'key' }, snapshots: { keyPath: 'd' }, sessions: { keyPath: 'id' }, kv: { keyPath: 'k' } };
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VER);
    r.onupgradeneeded = () => { const db = r.result; for (const [n, o] of Object.entries(STORES)) if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, o); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function tx(store, mode, fn) { const db = await open(); const t = db.transaction(store, mode); const out = await fn(t.objectStore(store)); await new Promise((res, rej) => { t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); return out; }
export const all = store => tx(store, 'readonly', s => req(s.getAll()));
export const get = (store, key) => tx(store, 'readonly', s => req(s.get(key)));
export const put = (store, val) => tx(store, 'readwrite', s => req(s.put(val)));
export const del = (store, key) => tx(store, 'readwrite', s => req(s.delete(key)));
export const clear = store => tx(store, 'readwrite', s => req(s.clear()));
export const putMany = (store, vals) => tx(store, 'readwrite', s => Promise.all(vals.map(v => req(s.put(v)))));
export async function kvGet(k, d = null) { const r = await get('kv', k).catch(() => null); return r ? r.v : d; }
export const kvSet = (k, v) => put('kv', { k, v });
