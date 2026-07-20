import { createPrismaClient } from "@/lib/prisma-client-factory"
import { TEST_DATABASE_URL } from "./db-path"

/** Cliente Prisma real contra la sqlite descartable de test (ver global-setup.ts) —
 * mismo adapter (better-sqlite3) que usa el kiosco local, no un mock. */
export function crearPrismaDeTest() {
  return createPrismaClient(TEST_DATABASE_URL)
}
