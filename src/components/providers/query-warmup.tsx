"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ROUTE_PREFETCH_MAP, prefetchRoute } from "@/lib/use-route-prefetch"

/**
 * Precarga en segundo plano, apenas se monta el dashboard, todas las queries
 * de todas las secciones (no solo la que el usuario está viendo) — para que
 * al navegar a cualquier otra pantalla ya esté todo tibio en el cache. El
 * costo (unos requests extra de fondo tras el primer render) es intencional:
 * se prefiere un arranque un poco más largo a cambio de navegación instantánea.
 */
export function QueryWarmup() {
  const qc = useQueryClient()

  useEffect(() => {
    for (const href of Object.keys(ROUTE_PREFETCH_MAP)) {
      prefetchRoute(qc, href)
    }
  }, [qc])

  return null
}
