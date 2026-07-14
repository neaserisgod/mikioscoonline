import { requireAdminSession } from "@/lib/session"
import ProveedoresClient from "./proveedores-client"

export default async function ProveedoresPage() {
  await requireAdminSession()
  return <ProveedoresClient />
}
