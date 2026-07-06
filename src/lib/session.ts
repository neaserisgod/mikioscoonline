import { auth } from "@/auth"
import { redirect } from "next/navigation"

/** El layout del dashboard ya valida la sesión — este chequeo es defensivo, auth() es solo JWT (sin DB). */
export async function requireSession() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")
  return session
}

/** Páginas de solo-ADMIN (config, rentabilidad, reportes, catálogo con costos). */
export async function requireAdminSession() {
  const session = await requireSession()
  if (session.user.role !== "ADMIN") redirect("/inicio")
  return session
}
