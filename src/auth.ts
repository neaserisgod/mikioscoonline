import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import { getToken } from "next-auth/jwt"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"
import { verificarCredenciales, verificarPin } from "@/lib/verificar-credenciales"
import { resolverUsuarioGoogle } from "@/lib/resolver-usuario-google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const user = await verificarCredenciales(
          credentials.email as string,
          credentials.password as string
        )
        if (!user) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
    Credentials({
      id: "pin",
      name: "PIN",
      credentials: {
        userId: { label: "Perfil" },
        pin: { label: "PIN", type: "password" },
      },
      authorize: async (credentials, request) => {
        if (!credentials?.userId || !credentials?.pin) return null

        // Cambio de perfil dentro del kiosco: solo puede moverse DENTRO de la
        // organización de la sesión que ya está activa (la que desbloqueó el
        // kiosco al arrancar) — se lee del JWT de esa sesión, nunca de un dato
        // que mande el cliente, para que no se pueda pinear hacia otra org.
        const tokenActual = await getToken({ req: request, secret: process.env.AUTH_SECRET })
        if (!tokenActual?.organizationId) return null

        const user = await verificarPin(
          credentials.userId as string,
          credentials.pin as string,
          tokenActual.organizationId as string
        )
        if (!user) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
    Google({
      // Sin esto, si el WebView ya tiene una sesión de Google activa (persiste
      // entre reinicios de la app de escritorio), Google entra directo con esa
      // cuenta sin mostrar el selector — mal en un kiosco donde puede haber
      // varias cuentas usadas en la misma PC.
      authorization: { params: { prompt: "select_account" } },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    // Rechaza emails de Google no verificados y usuarios existentes desactivados.
    async signIn({ account, profile }) {
      if (account?.provider === "google") {
        const email = profile?.email as string | undefined
        if (!email || !profile?.email_verified) return false

        const existing = await prisma.user.findUnique({ where: { email } })
        if (existing && !existing.activo) return false
      }
      return true
    },

    // Alta con Google: primer login de un email nuevo → crea Organization + User
    // ADMIN automáticamente (cae en /onboarding, que ya asume la org creada).
    // Email ya existente (registrado antes con Google, o invitado con contraseña
    // por un admin) → loguea como ese usuario, sin crear nada.
    async jwt({ token, user, account, profile }) {
      if (account?.provider === "google") {
        const email = profile?.email as string | undefined
        if (!email) return token

        // signIn() ya rechazó email no verificado / usuario desactivado antes de
        // llegar acá, así que resolverUsuarioGoogle siempre debería encontrar/crear uno.
        const dbUser = await resolverUsuarioGoogle({
          email,
          emailVerified: true,
          nombre: profile?.name as string | undefined,
          picture: profile?.picture as string | undefined,
        })
        if (!dbUser) return token

        token.id = dbUser.id
        token.role = dbUser.role
        token.organizationId = dbUser.organizationId
        return token
      }

      if (user) {
        const u = user as typeof user & { role: "ADMIN" | "VENDEDOR"; organizationId: string }
        token.id = u.id as string
        token.role = u.role
        token.organizationId = u.organizationId
      }
      return token
    },
  },
})
