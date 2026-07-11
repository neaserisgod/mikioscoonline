import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireAdminSession } from "@/lib/session"
import { productoService } from "@/services/producto.service"
import ProductosClient from "./productos-client"

export default async function ProductosPage() {
  const session = await requireAdminSession()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["productos-resumen-proveedores"],
    queryFn: async () => serializable(await productoService.resumenProveedores(session.user.organizationId)),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductosClient />
    </HydrationBoundary>
  )
}
