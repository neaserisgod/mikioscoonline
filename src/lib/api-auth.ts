import { NextResponse } from "next/server"
import { auth } from "@/auth"

/** Para GET/API routes que cualquier usuario autenticado puede llamar (VENDEDOR incluido). */
export async function requireSessionApi() {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) } as const
  }
  return { user: session.user as { organizationId: string; role: "ADMIN" | "VENDEDOR" } } as const
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
