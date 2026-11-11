// Holowise service worker. Network-first for the app shell (so updates show up), cache fallback for offline.
// Runtime cache (for offline show mode): the OCR engine from the CDN and card images. Price APIs are never cached here,
// and TCG Prices AU data (via your proxy) is never stored offline, per their terms.
const V = 'holowise-v6', RT = 'holowise-rt-v1';
const SHELL = ['./', 'index.html', 'styles.css?v=6', 'app.js?v=6', 'core.js?v=6', 'ocr.js?v=6', 'ximilar.js?v=6', 'au.js?v=6', 'history.js?v=6', 'signal.js?v=6',
  'detect.js?v=6', 'db.js?v=6', 'deal.js?v=6', 'portfolio.js?v=6', 'budget.js?v=6', 'csv.js?v=6', 'plan.js?v=6', 'sell.js?v=6', 'center.js?v=6', 'voice.js?v=6', 'config.js?v=6',
  'manifest.webmanifest?v=6', 'icons/icon.svg'];
const RUNTIME = [/^https:\/\/cdn\.jsdelivr\.net\/npm\/(tesseract\.js|tesseract\.js-core)@/, /^https:\/\/tessdata\.projectnaptha\.com\//,
  /^https:\/\/assets\.tcgdex\.net\//, /^https:\/\/images\.pokemontcg\.io\//, /^https:\/\/optcgapi\.com\/media\//];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== RT).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin !== location.origin) {
    if (!RUNTIME.some(r => r.test(u.href))) return; // APIs (prices, FX, proxy) go straight to the network
    e.respondWith(caches.open(RT).then(async c => { const hit = await c.match(e.request); if (hit) return hit;
      const r = await fetch(e.request); if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()).catch(() => {}); return r; }));
    return;
  }
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: false }).then(r => r || caches.match('index.html'))));
});
// Tapping a price-alert notification opens the watchlist.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => { const c = cs[0]; if (c) { c.navigate?.('./#watch'); return c.focus(); } return self.clients.openURL ? self.clients.openURL('./#watch') : self.clients.openWindow('./#watch'); }));
});
