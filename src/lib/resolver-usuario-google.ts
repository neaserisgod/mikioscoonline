import { prisma } from "@/lib/prisma-auth"
import type { UsuarioAutenticado } from "@/lib/verificar-credenciales"

/**
 * Alta con Google: primer login de un email nuevo → crea Organization + User
 * ADMIN automáticamente. Email ya existente → loguea como ese usuario, sin
 * crear nada. Compartido entre el callback de NextAuth (web) y
 * /api/auth/mobile-google (Flutter) — misma regla de negocio en los dos lados.
 *
 * EXCEPCIÓN — cajas de kiosco (`NEON_DATABASE_URL` seteada, ver
 * prisma-auth.ts): ahí este alta automática NO corre. `NEON_DATABASE_URL` es
 * la señal de que esto es un kiosco con conexión directa de lectura/escritura
 * a la Neon real de producción (no el deploy multi-tenant de Vercel, donde
 * nunca se setea) — cualquier cuenta de Google verificada que no sea ya un
 * usuario existente terminaría creando una organización nueva en producción
 * con esa credencial compartida. El único authz real hoy es "¿esta cuenta ya
 * es un usuario de Neon?"; el gate de "0 ventas locales" en
 * (dashboard)/layout.tsx es defensivo, no reemplaza esto.
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
    if (process.env.NEON_DATABASE_URL) return null

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
