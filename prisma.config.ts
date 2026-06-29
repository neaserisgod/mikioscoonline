import { config } from "dotenv"
import { defineConfig } from "prisma/config"

config()
// LOCAL_DEV=1 skips .env.local so the SQLite URL in .env is used instead of Neon
if (!process.env.LOCAL_DEV) {
  config({ path: ".env.local", override: true })
}

export default defineConfig({
  schema: process.env.LOCAL_DEV ? "prisma/schema.dev.prisma" : "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
