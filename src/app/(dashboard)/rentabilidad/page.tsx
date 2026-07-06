import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireAdminSession } from "@/lib/session"
import { rentabilidadService } from "@/services/rentabilidad.service"
import RentabilidadClient from "./rentabilidad-client"

// Debe coincidir con el default del cliente: agrupador "proveedor" + mes actual (ver getMesRango en rentabilidad-client.tsx)
// y con cómo /api/rentabilidad parsea desde/hasta (new Date(string), no inicioMes/finMes — esos son solo fallback sin params).
export default async function RentabilidadPage() {
  const session = await requireAdminSession()

  const ahora = new Date()
  const y = ahora.getFullYear()
  const m = String(ahora.getMonth() + 1).padStart(2, "0")
  const desde = `${y}-${m}-01`
  const lastDay = new Date(y, ahora.getMonth() + 1, 0).getDate()
  const hasta = `${y}-${m}-${String(lastDay).padStart(2, "0")}`

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["rentabilidad", "proveedor", desde, hasta],
    queryFn: async () =>
      serializable(
        await rentabilidadService.porAgrupador({
          organizationId: session.user.organizationId,
          agrupador: "proveedor",
          fechaDesde: new Date(desde),
          fechaHasta: new Date(hasta),
        })
      ),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RentabilidadClient />
    </HydrationBoundary>
  )
}
