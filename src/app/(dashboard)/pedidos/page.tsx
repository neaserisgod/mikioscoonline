import { requireAdminSession } from "@/lib/session"
import PedidosClient from "./pedidos-client"

export default async function PedidosPage() {
  await requireAdminSession()
  return <PedidosClient />
}
