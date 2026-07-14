import { redirect } from "next/navigation"
import { requireAdminSession } from "@/lib/session"

// Proveedores se unificó dentro de /productos (ver productos-hub-client.tsx)
// — esta ruta queda como redirect para no romper links/bookmarks viejos.
export default async function ProveedoresRedirect() {
  await requireAdminSession()
  redirect("/productos?tab=proveedores")
}
