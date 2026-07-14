import { redirect } from "next/navigation"
import { requireAdminSession } from "@/lib/session"

// Pedidos a proveedores se unificó dentro de /productos (ver
// productos-hub-client.tsx) — esta ruta queda como redirect para no romper
// links/bookmarks viejos, preservando el deep-link de "Sugerir pedido".
export default async function PedidosRedirect({
  searchParams,
}: {
  searchParams: Promise<{ providerId?: string; sugerir?: string }>
}) {
  await requireAdminSession()
  const { providerId, sugerir } = await searchParams

  const params = new URLSearchParams({ tab: "pedidos" })
  if (providerId) params.set("providerId", providerId)
  if (sugerir) params.set("sugerir", sugerir)

  redirect(`/productos?${params.toString()}`)
}
