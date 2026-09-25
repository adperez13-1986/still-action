// Offline play: everything the game loads is cached as it's fetched, so after one
// full load it runs with no signal. The page itself is network-first so a new
// deploy is picked up; everything else is served from cache and refreshed behind.
const CACHE = 'still-action-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    // every project on this Pages origin shares the cache storage: only clear our own old versions
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('still-action-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('./'))),
    )
    return
  }

  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req)
      const fresh = fetch(req)
        .then((res) => {
          if (res.ok) c.put(req, res.clone())
          return res
        })
        .catch(() => hit)
      return hit ?? fresh
    }),
  )
})
