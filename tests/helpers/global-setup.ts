import { execSync } from "node:child_process"
import { existsSync, mkdirSync, unlinkSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { TEST_DATABASE_URL, TEST_DB_RELATIVE_PATH } from "./db-path"

// Corre UNA vez antes de toda la suite (vitest globalSetup) — arma una sqlite
// de test descartable con el schema real (schema.dev.prisma) vía `prisma db
// push`, para que los tests de integración usen Prisma real en vez de mocks.
// LOCAL_DEV=1 + DATABASE_URL/DIRECT_URL explícitos: prisma.config.ts salta
// .env.local (que apunta a Neon) y usa este archivo sqlite — nunca toca la DB
// de producción/desarrollo compartida.
export default function setup() {
  const absPath = resolve(process.cwd(), TEST_DB_RELATIVE_PATH)
  mkdirSync(dirname(absPath), { recursive: true })
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    if (existsSync(absPath + suffix)) unlinkSync(absPath + suffix)
  }

  execSync("npx prisma db push --accept-data-loss", {
    cwd: process.cwd(),
    stdio: "inherit",
    env: {
      ...process.env,
      LOCAL_DEV: "1",
      DATABASE_URL: TEST_DATABASE_URL,
      DIRECT_URL: TEST_DATABASE_URL,
    },
  })
}
