import { requireSession } from "@/lib/session"
import { ClientesClient } from "./clientes-client"

export default async function ClientesPage() {
  await requireSession()
  return <ClientesClient />
}
