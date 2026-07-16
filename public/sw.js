// Service Worker — online-first para páginas/API, stale-while-revalidate para
// assets estáticos con hash (inmutables, seguros de servir directo del cache).
// CACHE_NAME atado al build id (?v=... en la URL de registro, ver
// sw-provider.tsx/next.config.ts — SHA de commit, no un semver que alguien
// tiene que acordarse de bumpear) — antes era un string fijo ("kiosco-v2")
// que nunca cambiaba entre deploys, así que el cleanup de `activate` (que
// borra toda cache que no sea CACHE_NAME) nunca tenía nada que borrar: la
// MISMA cache acumulaba, sin límite, snapshots de HTML/API viejos servidos
// como fallback offline en cada deploy. Con el build id en el nombre, CADA
// deploy activa con un CACHE_NAME distinto y el cleanup sí purga la cache
// del deploy anterior.
const BUILD_ID = new URL(self.location.href).searchParams.get("v") || "sinversion"
const CACHE_NAME = `kiosco-${BUILD_ID}`
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
