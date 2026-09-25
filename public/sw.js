// Offline play. The build writes every file it made, with a hash of its content,
// into PRECACHE below, so the whole game is cached at install: after one visit it
// runs with no signal, area art it hasn't shown yet included. The page itself stays
// network-first, so a deploy is picked up.
const PRECACHE = /*__PRECACHE__*/[]
const VERSION = /*__VERSION__*/'dev'
const PREFIX = 'still-action-'
const CACHE = PREFIX + VERSION
const scope = self.registration.scope
// every build file under a key that carries its content hash: unchanged files are copied, not refetched
const keyOf = new Map(PRECACHE.map(([u, h]) => {
  const url = new URL(u, scope).href
  return [url, `${url}?v=${h}`]
}))

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const cache = await caches.open(CACHE)
  for (const [url, key] of keyOf) {
    if (await cache.match(key)) continue
    const res = (await caches.match(key)) ?? (await fetch(url, { cache: 'reload' }))
    // a failed file fails the install, and the old worker stays
    if (!res.ok) throw new Error(`precache ${url}: ${res.status}`)
    await cache.put(key, res)
  }
  await self.skipWaiting()
})()))

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // every project on this Pages origin shares the cache storage: only ever delete this game's old caches
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(async () => (keyOf.has(scope) && (await caches.match(keyOf.get(scope)))) || Response.error()))
    return
  }
  const key = keyOf.get(req.url.split('?')[0])
  if (key) e.respondWith(caches.match(key).then((hit) => hit ?? fetch(req)))
  else e.respondWith(fetch(req).catch(() => caches.match(req)))
})
