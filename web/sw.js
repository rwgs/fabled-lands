// sw.js - service worker for offline play.
// Precaches the app shell and all book data so the whole game works offline
// once loaded/installed. Progress lives in localStorage (per-origin), so it
// survives offline and reloads.

const VERSION = 'fl-26.07.13.6da614c';

// REQUIRED = the app shell + all book data. Without every one of these the game
// can't run offline, so the install must FAIL (and the previous complete cache
// must be kept) if any of them can't be fetched. addAll() is all-or-nothing: it
// rejects if any single request fails.
const REQUIRED = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/state.js',
  './js/rules.js',
  './js/engine.js',
  './js/render.js',
  './js/combat.js',
  './js/market.js',
  './js/ui.js',
  './js/version.js',
  './js/tts.js',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
  './assets/apple-touch-icon.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './data/meta.json',
  './data/book1.json',
  './data/book2.json',
  './data/book3.json',
  './data/book4.json',
  './data/book5.json',
  './data/book6.json',
];

// OPTIONAL = large, nice-to-have assets (the maps and world image). A miss here
// is fetched lazily on demand later and must never abort the upgrade or cause a
// complete cache to be discarded, so these are added best-effort.
const OPTIONAL = [
  './assets/world-map.jpg',
  './assets/maps/book1.jpg',
  './assets/maps/book2.jpg',
  './assets/maps/book3.jpg',
  './assets/maps/book4.jpg',
  './assets/maps/book5.jpg',
  './assets/maps/book6.jpg',
  // Section illustrations (task 62/64): a few sections show these via <image>.
  // render.js requests them as 'assets/illus/' + encodeURIComponent(name), so the
  // URLs are pre-encoded here to match the runtime request (and thus the cache
  // key). OPTIONAL so an offline miss can't abort the upgrade.
  './assets/illus/Forest%20of%20the%20Forsaken.JPG',
  './assets/illus/Map%20of%20Bazalek%20Isle.JPG',
  './assets/illus/TheBlackDiptych.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // All-or-nothing: if any required asset fails, addAll rejects, the install
    // fails, and we never activate an incomplete shell (the old cache lives on).
    await cache.addAll(REQUIRED);
    // Best-effort for the big optional assets — a miss must not fail the install.
    await Promise.all(OPTIONAL.map((url) => cache.add(url).catch((e) => console.warn('optional precache miss', url, e))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Only discard older caches once the new one verifiably holds every required
    // asset — otherwise a partial install could delete the last complete offline
    // cache. If it's somehow incomplete, keep the old caches as a fallback.
    const cache = await caches.open(VERSION);
    const present = await Promise.all(REQUIRED.map((url) => cache.match(url).then((r) => !!r)));
    if (present.every(Boolean)) {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    } else {
      console.warn('new cache incomplete; keeping older caches as offline fallback');
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Cache-first, falling back to network then caching the result.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && (res.type === 'basic')) {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
