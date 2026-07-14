import { redirect } from "next/navigation"
import { requireAdminSession } from "@/lib/session"

// Rentabilidad se unificó dentro de /clientes (ver clientes-hub-client.tsx) —
// esta ruta queda como redirect para no romper links/bookmarks viejos.
export default async function RentabilidadRedirect({
  searchParams,
}: {
  searchParams: Promise<{ agrupador?: string; periodo?: string }>
}) {
  await requireAdminSession()
  const { agrupador, periodo } = await searchParams

  const params = new URLSearchParams({ tab: "rentabilidad" })
  if (agrupador) params.set("agrupador", agrupador)
  if (periodo) params.set("periodo", periodo)

  redirect(`/clientes?${params.toString()}`)
}
