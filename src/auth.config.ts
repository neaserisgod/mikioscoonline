import type { NextAuthConfig } from "next-auth"

// Edge-compatible config — no Node.js-only imports here.
// The Credentials provider (which needs Prisma/bcrypt) lives in src/auth.ts.
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & { role: "ADMIN" | "VENDEDOR"; organizationId: string }
        token.id = u.id as string
        token.role = u.role
        token.organizationId = u.organizationId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.role = token.role as "ADMIN" | "VENDEDOR"
      session.user.organizationId = token.organizationId as string
      return session
    },
  },
  providers: [],
}
