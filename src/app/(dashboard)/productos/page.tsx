import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { getQueryClient, serializable } from "@/lib/get-query-client"
import { requireSession } from "@/lib/session"
import { productoService } from "@/services/producto.service"
import ProductosClient from "./productos-client"

export default async function ProductosPage() {
  const session = await requireSession()

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    queryKey: ["productos", ""],
    queryFn: async () => serializable(await productoService.listar(session.user.organizationId)),
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductosClient />
    </HydrationBoundary>
  )
}
