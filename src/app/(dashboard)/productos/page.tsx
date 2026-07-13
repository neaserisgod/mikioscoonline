import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { productoService } from "@/services/producto.service"
import { sanitizarResumen } from "@/lib/sanitizar-producto"
import ProductosClient from "./productos-client"

export default async function ProductosPage() {
  const session = await requireSession()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["productos-resumen-proveedores"],
    queryFn: async () =>
      serializable(
        sanitizarResumen(await productoService.resumenProveedores(session.user.organizationId), session.user.role)
      ),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductosClient />
    </HydrationBoundary>
  )
}
