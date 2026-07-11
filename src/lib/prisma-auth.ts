import { PrismaClient } from "@prisma/client"
import { createPrismaClient } from "./prisma-client-factory"

// Cliente dedicado EXCLUSIVAMENTE a autenticación (login/registro). Siempre
// contra Neon Postgres, incluso cuando DATABASE_URL del proceso apunta al
// kiosco.db local (ver scripts/start-kiosco-server.mjs) — así el login sigue
// validando contra los usuarios reales aunque el resto de la app (ventas,
// stock, etc.) corra contra SQLite local.
// En el deploy de Vercel (multi-tenant, sirve a los demás clientes del SaaS)
// NEON_DATABASE_URL nunca se setea, así que cae a DATABASE_URL de siempre:
// mismo comportamiento de hoy ahí, sin impacto.
const globalForPrismaAuth = globalThis as unknown as { prismaAuth: PrismaClient }

export const prisma =
  globalForPrismaAuth.prismaAuth ??
  createPrismaClient(process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL)

if (process.env.NODE_ENV !== "production") globalForPrismaAuth.prismaAuth = prisma
