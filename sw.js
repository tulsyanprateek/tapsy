// Offline support once the app is served over https (or localhost).
// The page itself: network first, so a new version shows as soon as you're online, but never more than
// 3 seconds of waiting when a saved copy exists (weak signal); the late network answer still refreshes
// the saved copy for next time. Fonts, icons, vendor/: from the cache. Calls to Google (sync) are never touched.
const CACHE = 'tapsy-v4';
const PAGE_WAIT_MS = 3000;
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
  if (page) { e.respondWith(pageFirst(e, req)); return; }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    return hit || fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
  }));
});

async function pageFirst(e, req) {
  const c = await caches.open(CACHE);
  const saved = (await c.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
  const net = fetch(req, { cache: 'no-store' }).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
  e.waitUntil(net.catch(() => {}));            // a slow answer still lands in the cache after we've moved on
  if (!saved) return net;                       // first visit: nothing saved yet, so wait for the network
  const slow = new Promise(r => setTimeout(() => r(saved), PAGE_WAIT_MS));
  return Promise.race([net.catch(() => saved), slow]);
}
