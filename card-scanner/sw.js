// Holowise service worker. Network-first for the app shell (so updates show up), cache fallback for offline. API calls are never cached here.
const V = 'holowise-v5';
const SHELL = ['./', 'index.html', 'styles.css?v=5', 'app.js?v=5', 'core.js?v=5', 'ocr.js?v=5', 'ximilar.js?v=5', 'au.js?v=5', 'history.js?v=5', 'signal.js?v=5',
  'detect.js?v=5', 'db.js?v=5', 'deal.js?v=5', 'portfolio.js?v=5', 'budget.js?v=5', 'csv.js?v=5', 'manifest.webmanifest?v=5', 'icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});
// Tapping a price-alert notification opens the watchlist.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => { const c = cs[0]; if (c) { c.navigate?.('./#watch'); return c.focus(); } return self.clients.openURL ? self.clients.openURL('./#watch') : self.clients.openWindow('./#watch'); }));
});
