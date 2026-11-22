/* Kleinspan Leer service worker: offline lessons. Same-origin GETs only; the API is never cached. */
const V = 'ks-learn-5512785378';
const CORE = ['./', 'index.html', 'app.css', 'app.js', 'tokens.css', 'fonts.css', 'course.json', 'audio/ui.json', 'audio/u1.json', 'manifest.webmanifest', 'icon.svg', 'privacy.html',
  'wordmark.svg', 'hero-hettie.svg', 'imgpack/core.json', 'imgpack/u1.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ks-learn-') && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request; const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then((res) => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit || c.match('index.html'));
    return hit || net;
  }));
});
