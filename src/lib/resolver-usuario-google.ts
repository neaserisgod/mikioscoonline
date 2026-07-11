import { prisma } from "@/lib/prisma-auth"
import type { UsuarioAutenticado } from "@/lib/verificar-credenciales"

/**
 * Alta con Google: primer login de un email nuevo → crea Organization + User
 * ADMIN automáticamente. Email ya existente → loguea como ese usuario, sin
 * crear nada. Compartido entre el callback de NextAuth (web) y
 * /api/auth/mobile-google (Flutter) — misma regla de negocio en los dos lados.
 */
export async function resolverUsuarioGoogle(input: {
  email: string
  emailVerified: boolean
  nombre?: string
  picture?: string
}): Promise<UsuarioAutenticado | null> {
  if (!input.emailVerified) return null

  let dbUser = await prisma.user.findUnique({ where: { email: input.email } })

  if (dbUser && !dbUser.activo) return null

  if (!dbUser) {
    const nombre = input.nombre ?? input.email
    const org = await prisma.organization.create({
      data: { nombre, onboardingCompletadoAt: null },
    })
    dbUser = await prisma.user.create({
      data: {
        email: input.email,
        nombre,
        role: "ADMIN",
        organizationId: org.id,
        image: input.picture ?? null,
      },
    })
  }

  return {
    id: dbUser.id,
    email: dbUser.email,
    nombre: dbUser.nombre,
    role: dbUser.role,
    organizationId: dbUser.organizationId,
  }
}
