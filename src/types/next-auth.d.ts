import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: "ADMIN" | "VENDEDOR"
      organizationId: string
    } & DefaultSession["user"]
  }

  interface User {
    role: "ADMIN" | "VENDEDOR"
    organizationId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: "ADMIN" | "VENDEDOR"
    organizationId: string
  }
}
