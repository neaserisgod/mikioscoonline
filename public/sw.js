// Service Worker — online-first para páginas/API, stale-while-revalidate para
// assets estáticos con hash (inmutables, seguros de servir directo del cache).
const CACHE_NAME = "kiosco-v2"
const OFFLINE_URL = "/"

function esAssetEstatico(url) {
  return url.pathname.startsWith("/_next/static/")
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  if (esAssetEstatico(url)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        const fetchPromise = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
        return cached ?? fetchPromise
      })
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request).then((r) => r ?? caches.match(OFFLINE_URL)))
  )
})
