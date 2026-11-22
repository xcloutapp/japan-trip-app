// Keeps the whole app on the phone so it works with no signal.
// tools/release.mjs refreshes VERSION and FILES before each release.
const VERSION = '202611220027';
const CACHE = `japan-${VERSION}`;
const FILES = [
  "./",
  "css/app.css",
  "data/files/parking-p7.enc",
  "data/files/parking-qr.enc",
  "data/files/t17-11A.enc",
  "data/files/t17-11B.enc",
  "data/files/t17-11C.enc",
  "data/files/t17-11D.enc",
  "data/files/t17-11E.enc",
  "data/files/t17-12A.enc",
  "data/files/t17-12B.enc",
  "data/files/t17-12C.enc",
  "data/files/t18-5A.enc",
  "data/files/t18-5B.enc",
  "data/files/t18-5C.enc",
  "data/files/t18-5D.enc",
  "data/files/t18-6A.enc",
  "data/files/t18-6B.enc",
  "data/files/t18-6C.enc",
  "data/files/t18-6D.enc",
  "data/files/usj-1.enc",
  "data/trip.enc.json",
  "fonts/inter.woff2",
  "fonts/nunito.woff2",
  "img/hotels/fuji.jpg",
  "img/hotels/hiroshima.jpg",
  "img/hotels/kyoto.jpg",
  "img/hotels/osaka.jpg",
  "img/hotels/shinjuku.jpg",
  "img/hotels/tokyobay.jpg",
  "img/icons/apple-touch-icon.png",
  "img/icons/icon-192.png",
  "img/icons/icon-512.png",
  "img/icons/icon-maskable-512.png",
  "img/japan-map.json",
  "img/places/p-disneyland.jpg",
  "img/places/p-disneysea.jpg",
  "img/places/p-dotonbori.jpg",
  "img/places/p-fushimi.jpg",
  "img/places/p-kawaguchiko.jpg",
  "img/places/p-miyajima.jpg",
  "img/places/p-nintendo.jpg",
  "img/places/p-omoide.jpg",
  "img/places/p-peace.jpg",
  "img/transport/t-fujikyu-bus.jpg",
  "img/transport/t-kix.jpg",
  "img/transport/t-shinkansen.jpg",
  "index.html",
  "js/app.js",
  "js/cloud.js",
  "js/icons.js",
  "js/lock.js",
  "js/map.js",
  "js/money.js",
  "js/shared.js",
  "js/store.js",
  "js/weather.js",
  "manifest.webmanifest"
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('japan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Reminders and message alerts sent by the family's reminder sender.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data.json(); } catch { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Japan 2026', {
    body: d.body || '', tag: d.tag, icon: 'img/icons/icon-192.png', data: { url: d.url || '#/home' }
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(`./${(e.notification.data && e.notification.data.url) || ''}`, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    if (list[0]) return list[0].navigate(url).then((c) => (c || list[0]).focus());
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  // Trip details and the page itself: try the internet first so changes arrive, else use the saved copy.
  if (req.mode === 'navigate' || url.pathname.endsWith('/data/trip.enc.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req.mode === 'navigate' ? './' : req, copy));
        return res;
      }).catch(() => caches.match(req.mode === 'navigate' ? './' : req, { ignoreSearch: true }))
    );
    return;
  }
  // Everything else (pictures, fonts, code): use the saved copy, fetch and save if missing.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
