import { redirect } from "next/navigation"
import { requireAdminSession } from "@/lib/session"

// Historial de ventas se unificó dentro de /clientes (ver clientes-hub-client.tsx)
// — esta ruta queda como redirect para no romper links/bookmarks viejos. La
// vista de un ticket puntual sigue viviendo en /historial-ventas/[id].
export default async function HistorialVentasRedirect() {
  await requireAdminSession()
  redirect("/clientes?tab=historial")
}
