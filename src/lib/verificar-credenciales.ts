import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma-auth"

const MAX_INTENTOS_FALLIDOS = 5
const BLOQUEO_MINUTOS = 15

export type UsuarioAutenticado = {
  id: string
  email: string | null
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

/**
 * Valida el PIN de un perfil de empleado (cambio rápido de usuario en el
 * kiosco), con el mismo bloqueo temporal por fuerza bruta que las contraseñas
 * — comparten `failedLoginAttempts`/`lockedUntil`. Escopeado a la organización
 * de la sesión que pide el cambio: nunca se puede pinear hacia un usuario de
 * otra organización aunque se conozca su id.
 */
export async function verificarPin(
  userId: string,
  pin: string,
  organizationId: string
): Promise<UsuarioAutenticado | null> {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId } })
  if (!user || !user.activo || !user.pinHash) return null

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) return null

  const pinOk = await bcrypt.compare(pin, user.pinHash)

  if (!pinOk) {
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
