"use client"

import { useEffect } from "react"

export function SwProvider() {
  useEffect(() => {
    // En desarrollo el SW cachea los chunks de Next y sirve versiones viejas
    // (rompe el hot-reload). Solo se registra en producción. En dev, además,
    // desregistramos cualquier SW que haya quedado de una sesión previa.
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV === "production") {
      // ?v=<build id> — el SW lee esto para versionar su CACHE_NAME (ver
      // public/sw.js): un registro con un build id distinto al instalado
      // dispara un nuevo install/activate que purga la cache del build
      // anterior, en vez de reusarla indefinidamente entre deploys.
      navigator.serviceWorker.register(`/sw.js?v=${process.env.NEXT_PUBLIC_BUILD_ID}`).catch(() => {})
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {})
    }
  }, [])
  return null
}
