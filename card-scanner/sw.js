// Network-first for the app shell (so updates show up), cache fallback for offline. API calls are never cached here.
const V = 'cardlens-v3';
const SHELL = ['./', 'index.html', 'styles.css?v=3', 'app.js?v=3', 'core.js?v=3', 'ocr.js?v=3', 'ximilar.js?v=3', 'au.js?v=3', 'history.js?v=3', 'signal.js?v=3', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
