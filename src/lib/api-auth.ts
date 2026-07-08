import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { auth } from "@/auth"
import { verificarTokenMobile } from "@/lib/mobile-auth"

/**
 * El cliente Flutter no tiene cookies de navegador — manda un JWT propio
 * (ver /api/auth/mobile-login) como `Authorization: Bearer <token>`. Si no hay
 * sesión de NextAuth, probamos con ese header antes de rechazar.
 */
async function usuarioDesdeBearer() {
  const authHeader = (await headers()).get("authorization")
  if (!authHeader?.startsWith("Bearer ")) return null
  const claims = await verificarTokenMobile(authHeader.slice("Bearer ".length))
  if (!claims) return null
  return { id: claims.sub, organizationId: claims.organizationId, role: claims.role }
}

type UsuarioSesion = { id: string; organizationId: string; role: "ADMIN" | "VENDEDOR" }

/** Para GET/API routes que cualquier usuario autenticado puede llamar (VENDEDOR incluido). */
export async function requireSessionApi() {
  const session = await auth()
  if (session?.user?.organizationId) {
    return { user: session.user as UsuarioSesion } as const
  }

  const bearerUser = await usuarioDesdeBearer()
  if (bearerUser) return { user: bearerUser as UsuarioSesion } as const

  return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) } as const
}

/** Para GET/API routes de configuración/reportes — solo ADMIN. */
export async function requireAdminApi() {
  const result = await requireSessionApi()
  if ("error" in result) return result
  if (result.user.role !== "ADMIN") {
    return { error: NextResponse.json({ error: "Solo ADMIN puede ver esto" }, { status: 403 }) } as const
  }
  return result
}
