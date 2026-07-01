import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { medioPagoService } from "@/services/config.service"
import { cajaService } from "@/services/caja.service"
import VenderClient from "./vender-client"

// CarritoPanel (montado siempre en esta página) pide "medios-pago" y "cajas-panel" —
// se prefetchean acá para que aparezcan ya resueltos al hidratar.
export default async function VenderPage() {
  const session = await requireSession()

  const queryClient = getQueryClient()
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["medios-pago"],
      queryFn: async () => serializable(await medioPagoService.listar(session.user.organizationId)),
    }),
    queryClient.prefetchQuery({
      queryKey: ["cajas-panel"],
      queryFn: async () => serializable(await cajaService.listarActivas(session.user.organizationId)),
    }),
  ])

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <VenderClient />
    </HydrationBoundary>
  )
}
