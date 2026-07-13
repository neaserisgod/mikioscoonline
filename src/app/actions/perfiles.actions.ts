"use server"

import { auth } from "@/auth"
import { cookies } from "next/headers"

/**
 * Plantada recién cuando se confirma un perfil con PIN en modo kiosco
 * (bloqueante en PerfilSwitcher) — cookie de SESIÓN, sin maxAge, para que el
 * navegador la borre al cerrar el proceso de Chrome y así el kiosco vuelva a
 * pedir perfil en la próxima apertura (ver src/proxy.ts para modo_kiosco).
 */
export async function confirmarPerfilKioscoAction() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  const store = await cookies()
  store.set("perfil_confirmado", "1", { httpOnly: true, sameSite: "lax" })
}
