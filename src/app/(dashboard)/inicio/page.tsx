import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"
import { rentabilidadService } from "@/services/rentabilidad.service"
import { cajaService } from "@/services/caja.service"
import DashboardClient from "./dashboard-client"

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

// Prefetchea las 3 queries que dashboard-client.tsx pide sin condición al montar
// (resumen, rentabilidad-hoy, cajas-panel) para que la home aparezca con datos reales
// ya hidratados en vez de mostrar el skeleton interno tras el fetch del cliente.
export default async function HomePage() {
  const session = await requireSession()
  const orgId = session.user.organizationId
  const esAdmin = session.user.role === "ADMIN"
  const today = getToday()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["resumen"],
      queryFn: async () => {
        // hoy/mes son cifras de ganancia — VENDEDOR no debe verlas.
        const [hoy, mes, stockBajo] = await Promise.all([
          esAdmin ? resumenService.hoy(orgId) : null,
          esAdmin ? resumenService.mes(orgId) : null,
          productoService.stockBajo(orgId),
        ])
        return serializable({ hoy, mes, stockBajo })
      },
    }),
    ...(esAdmin
      ? [
          queryClient.prefetchQuery({
            queryKey: ["rentabilidad-hoy", today],
            queryFn: async () =>
              serializable(
                await rentabilidadService.porAgrupador({
                  organizationId: orgId,
                  agrupador: "proveedor",
                  fechaDesde: new Date(today),
                  fechaHasta: new Date(today),
                })
              ),
          }),
        ]
      : []),
    queryClient.prefetchQuery({
      queryKey: ["cajas-panel"],
      queryFn: async () => serializable(await cajaService.listarActivas(orgId)),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardClient />
    </HydrationBoundary>
  )
}
