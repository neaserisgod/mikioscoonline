import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireAdminSession } from "@/lib/session"
import { resumenService } from "@/services/resumen.service"
import { productoService } from "@/services/producto.service"
import ReportesClient from "./reportes-client"

export default async function ReportesPage() {
  const session = await requireAdminSession()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["resumen"],
    queryFn: async () => {
      const [hoy, mes, stockBajo] = await Promise.all([
        resumenService.hoy(session.user.organizationId),
        resumenService.mes(session.user.organizationId),
        productoService.stockBajo(session.user.organizationId),
      ])
      return serializable({ hoy, mes, stockBajo })
    },
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportesClient />
    </HydrationBoundary>
  )
}
