import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { usuarioService } from "@/services/config.service"
import { cajaSesionService } from "@/services/cajaSesion.service"

/**
 * Datos para el selector de cambio rápido de perfil en el kiosco: perfiles
 * con PIN de la organización, y si hay alguna caja de efectivo con sesión
 * abierta (bloquea el cambio hasta que se cierre — ver TraspasoCigarrillosGate
 * para el patrón de gate similar de cigarrillos).
 */
export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error

  const [perfiles, cajasAbiertas] = await Promise.all([
    usuarioService.listarPerfilesConPin(result.user.organizationId),
    cajaSesionService.listarCajasEfectivoAbiertas(result.user.organizationId),
  ])

  return NextResponse.json({ perfiles, cajasEfectivoAbiertas: cajasAbiertas })
}
