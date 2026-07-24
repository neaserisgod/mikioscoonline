import { NextResponse } from "next/server"
import { obtenerUltimoInstalador, RELEASES_URL } from "@/lib/descarga"

/**
 * Link estable de descarga: `/descargar/exe`.
 *
 * Resuelve en el momento cuál es el instalador `-setup.exe` de la última
 * release y redirige ahí. Así se puede compartir SIEMPRE la misma URL (pegarla
 * en un mail, un WhatsApp, un QR) y cada quien baja la versión más nueva sin
 * que haya que tocar nada. Si no hay release o la API falla, cae a la página de
 * releases de GitHub.
 */
export async function GET() {
  const info = await obtenerUltimoInstalador()
  const destino = info?.url ?? RELEASES_URL
  return NextResponse.redirect(destino, { status: 307 })
}
