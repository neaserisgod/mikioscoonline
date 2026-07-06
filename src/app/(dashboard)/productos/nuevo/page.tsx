import { requireAdminSession } from "@/lib/session"
import { NuevoProductoClient } from "./nuevo-producto-client"

export default async function NuevoProductoPage() {
  await requireAdminSession()
  return <NuevoProductoClient />
}
