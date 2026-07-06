import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import Google from "next-auth/providers/google"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { authConfig } from "@/auth.config"

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

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })

        if (!user || !user.activo || !user.passwordHash) return null

        const passwordOk = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        )
        if (!passwordOk) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nombre,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
    Google,
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

        let dbUser = await prisma.user.findUnique({ where: { email } })

        if (!dbUser) {
          const nombre = (profile?.name as string | undefined) ?? email
          const org = await prisma.organization.create({
            data: { nombre, onboardingCompletadoAt: null },
          })
          dbUser = await prisma.user.create({
            data: {
              email,
              nombre,
              role: "ADMIN",
              organizationId: org.id,
              image: (profile?.picture as string | undefined) ?? null,
            },
          })
        }

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
