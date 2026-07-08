import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

const MAX_INTENTOS_FALLIDOS = 5
const BLOQUEO_MINUTOS = 15

export type UsuarioAutenticado = {
  id: string
  email: string
  nombre: string
  role: "ADMIN" | "VENDEDOR"
  organizationId: string
}

/**
 * Valida email/contraseña contra la base, aplicando el mismo bloqueo temporal
 * por fuerza bruta que usa el provider de Credentials de NextAuth. Compartido
 * entre el login web (cookies) y el login del cliente Flutter (JWT).
 */
export async function verificarCredenciales(
  email: string,
  password: string
): Promise<UsuarioAutenticado | null> {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.activo || !user.passwordHash) return null

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null

  const passwordOk = await bcrypt.compare(password, user.passwordHash)

  if (!passwordOk) {
    const intentos = user.failedLoginAttempts + 1
    await prisma.user.update({
      where: { id: user.id },
      data:
        intentos >= MAX_INTENTOS_FALLIDOS
          ? { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + BLOQUEO_MINUTOS * 60_000) }
          : { failedLoginAttempts: intentos },
    })
    return null
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    })
  }

  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    organizationId: user.organizationId,
  }
}
