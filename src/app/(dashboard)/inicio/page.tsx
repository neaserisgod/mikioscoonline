import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"
import { rentabilidadService } from "@/services/rentabilidad.service"
import { cajaService } from "@/services/caja.service"
import { finDia } from "@/domain/dinero"
import DashboardClient from "./dashboard-client"

// Fecha LOCAL, no UTC — toISOString() corre el día para atrás en husos
// horarios negativos (ej. Argentina) cerca de la medianoche (mismo bug ya
// corregido en dashboard-client.tsx y /api/rentabilidad/route.ts).
function getToday() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function inicioDiaLocal(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
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
        const [hoy, real, stockBajo] = await Promise.all([
          esAdmin ? resumenService.hoy(orgId) : null,
          esAdmin ? resumenService.equilibrioReal(orgId) : null,
          productoService.stockBajo(orgId),
        ])
        return serializable({
          hoy,
          mes: real?.mesActual ?? null,
          cajas: real?.cajas ?? null,
          disponibleRealCentavos: real?.disponibleRealCentavos ?? null,
          equilibrio: real?.equilibrio ?? null,
          stockBajo,
        })
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
                  fechaDesde: inicioDiaLocal(),
                  fechaHasta: finDia(),
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
