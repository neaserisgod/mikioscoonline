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
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter, log: ["error"] } as never)
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
