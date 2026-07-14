import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { rentabilidadService } from "@/services/rentabilidad.service"
import { ClientesHubClient } from "./clientes-hub-client"

// Unifica Clientes + Rentabilidad + Historial (ver clientes-hub-client.tsx).
// Solo se prefetchea rentabilidad cuando se entra directo a esa tab — debe
// coincidir con el default del cliente: agrupador "proveedor" + mes actual
// (ver getMesRango en rentabilidad-client.tsx).
export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const session = await requireSession()
  const { tab } = await searchParams

  const queryClient = getQueryClient()

  if (session.user.role === "ADMIN" && tab === "rentabilidad") {
    const ahora = new Date()
    const y = ahora.getFullYear()
    const m = String(ahora.getMonth() + 1).padStart(2, "0")
    const desde = `${y}-${m}-01`
    const lastDay = new Date(y, ahora.getMonth() + 1, 0).getDate()
    const hasta = `${y}-${m}-${String(lastDay).padStart(2, "0")}`

    await queryClient.prefetchQuery({
      queryKey: ["rentabilidad", "proveedor", "mes", desde, hasta],
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
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientesHubClient />
    </HydrationBoundary>
  )
}
