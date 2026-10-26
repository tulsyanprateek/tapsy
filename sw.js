// Offline support once the app is served over https (or localhost).
// The page itself: network first, so a new version shows as soon as you're online; the saved copy when offline.
// Fonts and icons: from the cache. Calls to Google (sync) are never touched.
const CACHE = 'expenses-v3';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './fonts/outfit.woff2', './fonts/hanken-grotesk.woff2',
  './icons/icon-192.png', './icons/icon-512.png',
  './vendor/sqljs.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate' || /\/(index\.html)?$|\.webmanifest$/.test(new URL(req.url).pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    if (page) {
      try { const res = await fetch(req, { cache: 'no-store' }); if (res.ok) c.put(req, res.clone()); return res; }
      catch (err) { return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')); }
    }
    const hit = await c.match(req, { ignoreSearch: true });
    return hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
  }));
});
