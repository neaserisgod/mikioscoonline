import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Marca este navegador como "modo kiosco" cuando llega ?kiosco=1 (lo agrega
 * start-kiosco.ps1 al abrir Chrome en modo --app). La cookie persiste y
 * habilita el selector de perfil forzado en DashboardLayout — ver
 * perfil-switcher.tsx / perfil-gate.tsx. Nunca se planta desde la web normal.
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.get("kiosco") === "1" && !request.cookies.has("modo_kiosco")) {
    const url = request.nextUrl.clone()
    url.searchParams.delete("kiosco")
    const response = NextResponse.redirect(url)
    response.cookies.set("modo_kiosco", "1", {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    })
    return response
  }
  return NextResponse.next()
}

export const config = {
  matcher: "/inicio",
}
