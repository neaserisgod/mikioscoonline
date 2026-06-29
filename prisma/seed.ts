import { config } from "dotenv"
config()
if (!process.env.LOCAL_DEV) {
  config({ path: ".env.local", override: true })
} else {
  // LOCAL_DEV: load secrets from .env.local but keep DATABASE_URL from .env
  const savedUrl = process.env.DATABASE_URL
  config({ path: ".env.local", override: true })
  if (savedUrl) process.env.DATABASE_URL = savedUrl
}

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const adminPassword = process.env.SEED_ADMIN_PASSWORD
if (!adminPassword) {
  console.error("❌ Falta SEED_ADMIN_PASSWORD en .env.local. Abortando.")
  process.exit(1)
}
const adminPwd = adminPassword as string

const url = process.env.DATABASE_URL!
if (!url) { console.error("❌ Falta DATABASE_URL"); process.exit(1) }

const adapter = new PrismaPg({ connectionString: url })
const prisma = new PrismaClient({ adapter, log: ["error"] })

async function main() {
  console.log(`🌱 Seed mínimo → ${url.startsWith("file:") ? "SQLite" : "PostgreSQL (Neon)"}`)

  const org = await prisma.organization.upsert({
    where: { id: "org_principal" },
    create: {
      id: "org_principal",
      nombre: "Mi negocio",
      onboardingCompletadoAt: null,
    },
    update: { onboardingCompletadoAt: null },
  })

  await prisma.user.upsert({
    where: { email: "admin@menegocio.ar" },
    create: {
      email: "admin@menegocio.ar",
      passwordHash: await bcrypt.hash(adminPwd, 12),
      nombre: "Admin",
      role: "ADMIN",
      organizationId: org.id,
    },
    update: { passwordHash: await bcrypt.hash(adminPwd, 12) },
  })

  const [orgs, users, cats, provs, locs, mps, cajas, gf, prods, sales] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.category.count(),
    prisma.provider.count(),
    prisma.location.count(),
    prisma.paymentMethod.count(),
    prisma.caja.count(),
    prisma.fixedExpense.count(),
    prisma.product.count(),
    prisma.sale.count(),
  ])

  console.log("✅ Seed completado")
  console.log(`   Organization:   ${orgs}`)
  console.log(`   User:           ${users}`)
  console.log(`   Category:       ${cats}`)
  console.log(`   Provider:       ${provs}`)
  console.log(`   Location:       ${locs}`)
  console.log(`   PaymentMethod:  ${mps}`)
  console.log(`   Caja:           ${cajas}`)
  console.log(`   FixedExpense:   ${gf}`)
  console.log(`   Product:        ${prods}`)
  console.log(`   Sale:           ${sales}`)
  console.log(`   👤 admin@menegocio.ar / (SEED_ADMIN_PASSWORD)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
