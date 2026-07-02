import { PrismaClient } from "@prisma/client"

function createPrismaClient() {
  const url = process.env.DATABASE_URL!
  if (url?.startsWith("file:")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3")
    const adapter = new PrismaBetterSqlite3({ url })
    return new PrismaClient({ adapter } as never)
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaPg } = require("@prisma/adapter-pg")
  // node-postgres cierra conexiones idle a los 10s por default — en un server
  // de larga vida (next dev/start) eso fuerza reconectar (~700ms) en cada
  // request separado por más de 10s de inactividad. Con un timeout largo, la
  // conexión se mantiene viva entre navegaciones normales del usuario.
  const adapter = new PrismaPg({
    connectionString: url,
    idleTimeoutMillis: 5 * 60_000,
    keepAlive: true,
  })
  return new PrismaClient({ adapter, log: ["error"] } as never)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
