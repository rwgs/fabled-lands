// sw-cache.js - the Fabled Lands cache-namespace policy (task 190).
//
// CacheStorage is shared per *origin*, not per service-worker scope, so any other
// app hosted on this origin has its caches visible to us (and ours to it). Every
// operation here is therefore confined to the 'fl-' namespace:
//   * cleanup may only delete obsolete fl-* caches -- never a stranger's;
//   * lookup may only read our own caches -- the origin-global caches.match(req)
//     searches every cache on the origin and would happily return another app's
//     response for the same URL.
//
// Loaded two ways, so it must stay dependency-free and export only via `self`:
//   sw.js:  importScripts('./js/sw-cache.js')   -- classic worker script
//   tests:  await import('../js/sw-cache.js')   -- bare module (no import/export)
// Both evaluate this same source and publish self.FLCache.

self.FLCache = (() => {
  const PREFIX = 'fl-';

  const isFl = (key) => typeof key === 'string' && key.startsWith(PREFIX);

  // Every Fabled Lands cache that is not the current one, newest first
  // (caches.keys() is creation-ordered). Foreign keys are never returned, so a
  // caller can neither delete nor read another app's cache through this.
  const obsolete = (keys, current) => keys.filter((k) => isFl(k) && k !== current).reverse();

  // Cache-first lookup restricted to our own namespace: the current cache, then
  // older fl-* caches newest-first. That older-cache pass preserves task 8's
  // incomplete-upgrade fallback (activate keeps the previous cache when the new
  // one is short an asset, and it must still be able to serve it).
  async function match(cacheStorage, req, current, opts) {
    const cache = await cacheStorage.open(current);
    const hit = await cache.match(req, opts);
    if (hit) return hit;
    for (const key of obsolete(await cacheStorage.keys(), current)) {
      const older = await cacheStorage.open(key);
      const stale = await older.match(req, opts);
      if (stale) return stale;
    }
    return undefined;
  }

  // Drop obsolete fl-* caches, but only once `current` verifiably holds every
  // required asset -- otherwise a partial install would delete the last complete
  // offline cache (task 8). Returns the deleted keys, or null when the gate held
  // and the older caches were kept as a fallback.
  async function prune(cacheStorage, current, required) {
    const cache = await cacheStorage.open(current);
    const present = await Promise.all(required.map((url) => cache.match(url).then((r) => !!r)));
    if (!present.every(Boolean)) return null;
    const doomed = obsolete(await cacheStorage.keys(), current);
    await Promise.all(doomed.map((key) => cacheStorage.delete(key)));
    return doomed;
  }

  return { PREFIX, isFl, obsolete, match, prune };
})();
