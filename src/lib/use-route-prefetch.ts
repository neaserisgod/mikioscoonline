"use client"

import { useCallback } from "react"
import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useSession } from "next-auth/react"

interface PrefetchEntry {
  key: unknown[]
  url: string
  staleTime: number
  adminOnly?: boolean
}

const TODAY = new Date().toISOString().slice(0, 10)

function mesActualRango() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const ultimoDia = new Date(y, d.getMonth() + 1, 0).getDate()
  return { desde: `${y}-${m}-01`, hasta: `${y}-${m}-${String(ultimoDia).padStart(2, "0")}` }
}
const MES_ACTUAL = mesActualRango()

// Secciones enteras de solo-ADMIN — VENDEDOR nunca navega ahí (los links ni se
// muestran), pero el warm-up al iniciar sesión igual las precarga si no se filtran acá.
const RUTAS_ADMIN_ONLY = new Set(["/productos", "/rentabilidad", "/config", "/proveedores"])

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
      adminOnly: true,
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
      // Coincide con el default del cliente: agrupador "proveedor" + periodo "mes" (ver rentabilidad-client.tsx)
      key: ["rentabilidad", "proveedor", "mes", MES_ACTUAL.desde, MES_ACTUAL.hasta],
      url: `/api/rentabilidad?por=proveedor&desde=${MES_ACTUAL.desde}&hasta=${MES_ACTUAL.hasta}`,
      staleTime: 30_000,
    },
  ],
  "/config": [{ key: ["config", "negocio"], url: "/api/config/negocio", staleTime: 60_000 }],
}

export function prefetchRoute(qc: QueryClient, href: string, role?: "ADMIN" | "VENDEDOR") {
  if (role !== "ADMIN" && RUTAS_ADMIN_ONLY.has(href)) return
  const queries = ROUTE_PREFETCH_MAP[href]
  if (!queries) return
  for (const { key, url, staleTime, adminOnly } of queries) {
    if (adminOnly && role !== "ADMIN") continue
    if (qc.getQueryState(key)?.data != null) continue
    qc.prefetchQuery({ queryKey: key, queryFn: () => fetch(url).then((r) => r.json()), staleTime })
  }
}

export function useRoutePrefetch() {
  const qc = useQueryClient()
  const { data: session } = useSession()
  const role = session?.user?.role
  return useCallback((href: string) => prefetchRoute(qc, href, role), [qc, role])
}
