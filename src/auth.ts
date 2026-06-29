import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
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

        if (!user || !user.activo) return null

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
  ],
})
