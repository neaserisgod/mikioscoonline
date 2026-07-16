"use client"

import { useEffect } from "react"

export function SwProvider() {
  useEffect(() => {
    // En desarrollo el SW cachea los chunks de Next y sirve versiones viejas
    // (rompe el hot-reload). Solo se registra en producción. En dev, además,
    // desregistramos cualquier SW que haya quedado de una sesión previa.
    if (!("serviceWorker" in navigator)) return
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    } else {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {})
    }
  }, [])
  return null
}
