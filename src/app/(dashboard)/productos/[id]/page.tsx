import { requireAdminSession } from "@/lib/session"
import { EditarProductoClient } from "./editar-producto-client"

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession()
  return <EditarProductoClient params={params} />
}
