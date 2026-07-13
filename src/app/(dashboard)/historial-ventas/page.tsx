import { requireAdminSession } from "@/lib/session"
import HistorialVentasClient from "./historial-ventas-client"

export default async function HistorialVentasPage() {
  await requireAdminSession()
  return <HistorialVentasClient />
}
