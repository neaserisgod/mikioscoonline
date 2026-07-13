import { requireSession } from "@/lib/session"
import { EditarProductoClient } from "./editar-producto-client"

export default async function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession()
  return <EditarProductoClient params={params} />
}
