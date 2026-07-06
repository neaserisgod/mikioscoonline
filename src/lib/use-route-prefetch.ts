"use client"

import { useCallback } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"

interface PrefetchEntry {
  key: unknown[]
  url: string
  staleTime: number
}

const TODAY = new Date().toISOString().slice(0, 10)

// Mapa único de qué precargar por sección — el staleTime de cada entrada debe
// coincidir con el que usa la query real consumidora (si no, el dato
// prefetcheado puede darse por stale antes de que el usuario llegue a verlo).
// Se usa tanto para el prefetch on hover/focus de la navegación como para el
// warm-up al iniciar sesión (ver query-warmup.tsx).
export const ROUTE_PREFETCH_MAP: Record<string, PrefetchEntry[]> = {
  "/inicio": [
    { key: ["resumen"], url: "/api/resumen", staleTime: 30_000 },
    { key: ["cajas-panel"], url: "/api/cajas", staleTime: 5 * 60_000 },
    {
      key: ["rentabilidad-hoy", TODAY],
      url: `/api/rentabilidad?por=proveedor&desde=${TODAY}&hasta=${TODAY}`,
      staleTime: 30_000,
    },
  ],
  "/vender": [
    { key: ["medios-pago"], url: "/api/config/medios-pago", staleTime: 5 * 60_000 },
    { key: ["cajas-panel"], url: "/api/cajas", staleTime: 5 * 60_000 },
  ],
  "/productos": [
    { key: ["productos", ""], url: "/api/productos?q=", staleTime: 30_000 },
    { key: ["categorias"], url: "/api/config/categorias", staleTime: 5 * 60_000 },
    { key: ["proveedores"], url: "/api/config/proveedores", staleTime: 5 * 60_000 },
    { key: ["ubicaciones"], url: "/api/config/ubicaciones", staleTime: 5 * 60_000 },
  ],
  "/rentabilidad": [
    {
      key: ["rentabilidad", "proveedor", TODAY, TODAY],
      url: `/api/rentabilidad?por=proveedor&desde=${TODAY}&hasta=${TODAY}`,
      staleTime: 30_000,
    },
  ],
  "/reportes": [{ key: ["resumen"], url: "/api/resumen", staleTime: 30_000 }],
  "/config": [{ key: ["config", "negocio"], url: "/api/config/negocio", staleTime: 60_000 }],
}

export function prefetchRoute(qc: QueryClient, href: string) {
  const queries = ROUTE_PREFETCH_MAP[href]
  if (!queries) return
  for (const { key, url, staleTime } of queries) {
    if (qc.getQueryState(key)?.data != null) continue
    qc.prefetchQuery({ queryKey: key, queryFn: () => fetch(url).then((r) => r.json()), staleTime })
  }
}

export function useRoutePrefetch() {
  const qc = useQueryClient()
  return useCallback((href: string) => prefetchRoute(qc, href), [qc])
}
