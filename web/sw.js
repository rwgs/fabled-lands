// sw.js — service worker for offline play.
// Precaches the app shell and all book data so the whole game works offline
// once loaded/installed. Progress lives in localStorage (per-origin), so it
// survives offline and reloads.

const VERSION = 'fl-v5';
const SHELL = [
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
  './js/ui.js',
  './js/version.js',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
  './assets/world-map.jpg',
  './data/meta.json',
  './data/book1.json',
  './data/book2.json',
  './data/book3.json',
  './data/book4.json',
  './data/book5.json',
  './data/book6.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // Add individually so one missing file doesn't abort the whole install.
      Promise.all(SHELL.map((url) => cache.add(url).catch((e) => console.warn('precache miss', url, e))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
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
