import { config } from "dotenv"
// Carga .env.local primero (Next.js convention), .env como fallback
config({ path: ".env.local", override: true })
config()

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  log: ["error"],
})

const ORG_ID = "org_kiosco_demo"

async function main() {
  console.log("🌱 Iniciando seed kiosco...")

  // ─── Contraseña admin ────────────────────────────────────────────────────────
  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  if (!adminPassword) {
    console.error("❌ Falta SEED_ADMIN_PASSWORD en .env.local. Abortando para no seedear con contraseña débil.")
    process.exit(1)
  }

  // ─── Organization ──────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: { id: ORG_ID, nombre: "Kiosco El Barrio" },
    update: {},
  })

  // ─── Users ─────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@kiosco.ar" },
    create: {
      email: "admin@kiosco.ar",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      nombre: "Admin",
      role: "ADMIN",
      organizationId: org.id,
    },
    update: { passwordHash: await bcrypt.hash(adminPassword, 12) },
  })

  await prisma.user.upsert({
    where: { email: "vendedor@kiosco.ar" },
    create: {
      email: "vendedor@kiosco.ar",
      passwordHash: await bcrypt.hash("vendedor123", 10),
      nombre: "Juan Vendedor",
      role: "VENDEDOR",
      organizationId: org.id,
    },
    update: {},
  })

  // ─── Cajas ────────────────────────────────────────────────────────────────
  const cajaGeneral = await prisma.caja.upsert({
    where: { nombre_organizationId: { nombre: "Caja general", organizationId: org.id } },
    create: { nombre: "Caja general", esPrincipal: true, orden: 0, organizationId: org.id },
    update: {},
  })

  const cajaCigarrillos = await prisma.caja.upsert({
    where: { nombre_organizationId: { nombre: "Caja Cigarrillos", organizationId: org.id } },
    create: { nombre: "Caja Cigarrillos", esPrincipal: false, orden: 1, recargoVirtualBp: 300, organizationId: org.id },
    update: {},
  })

  // ─── Categorías ───────────────────────────────────────────────────────────
  // Porcentajes en bp: 500 = 5.00%  |  4000 = 40.00%  |  7000 = 70.00%
  const [catCig, catGas, catGol, catAli, catLac, catLim] = await Promise.all([
    upsertCat(org.id, "Cigarrillos", 500, cajaCigarrillos.id),
    upsertCat(org.id, "Gaseosas y Aguas", 4000),
    upsertCat(org.id, "Golosinas", 7000),
    upsertCat(org.id, "Alimentos secos", 3000),
    upsertCat(org.id, "Lácteos", 2000),
    upsertCat(org.id, "Limpieza", 3500),
  ])

  // ─── Proveedores ──────────────────────────────────────────────────────────
  const [provCoca, provPG, provPhilip, provDist] = await Promise.all([
    upsertProv(org.id, "Coca-Cola FEMSA"),
    upsertProv(org.id, "Procter & Gamble"),
    upsertProv(org.id, "Philip Morris"),
    upsertProv(org.id, "Distribuidora Norte"),
  ])

  // ─── Ubicaciones ──────────────────────────────────────────────────────────
  const [locHeladera, locEstante] = await Promise.all([
    upsertLoc(org.id, "Heladera"),
    upsertLoc(org.id, "Estante central"),
  ])

  // ─── Medios de pago ────────────────────────────────────────────────────────
  const [mpEfectivo, mpMP] = await Promise.all([
    prisma.paymentMethod.upsert({
      where: { nombre_organizationId: { nombre: "Efectivo", organizationId: org.id } },
      create: { nombre: "Efectivo", comisionBp: 0, esMercadoPago: false, esEfectivo: true, esDefault: true, orden: 0, organizationId: org.id },
      update: { esEfectivo: true },
    }),
    prisma.paymentMethod.upsert({
      where: { nombre_organizationId: { nombre: "MercadoPago", organizationId: org.id } },
      create: { nombre: "MercadoPago", comisionBp: 399, esMercadoPago: true, esEfectivo: false, esDefault: false, orden: 1, organizationId: org.id },
      update: {},
    }),
    prisma.paymentMethod.upsert({
      where: { nombre_organizationId: { nombre: "Débito", organizationId: org.id } },
      create: { nombre: "Débito", comisionBp: 80, esMercadoPago: false, esEfectivo: false, esDefault: false, orden: 2, organizationId: org.id },
      update: {},
    }),
  ])

  // ─── Gastos fijos ─────────────────────────────────────────────────────────
  const now = new Date()
  const mesAnio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  for (const [nombre, monto] of [
    ["Alquiler", 20_000_000],   // $200.000,00
    ["Luz", 3_500_000],         // $35.000,00
    ["Internet", 1_200_000],    // $12.000,00
    ["Seguro", 1_800_000],      // $18.000,00
  ] as [string, number][]) {
    const gasto = await prisma.fixedExpense.upsert({
      where: { nombre_organizationId: { nombre, organizationId: org.id } },
      create: { nombre, organizationId: org.id },
      update: {},
    })
    await prisma.fixedExpenseMonto.upsert({
      where: { fixedExpenseId_mesAnio: { fixedExpenseId: gasto.id, mesAnio } },
      create: { fixedExpenseId: gasto.id, mesAnio, montoCentavos: monto },
      update: { montoCentavos: monto },
    })
  }

  // ─── Productos (20 items, montos en centavos) ─────────────────────────────
  type P = { sku: string; barcode?: string; nombre: string; costo: number; precio: number; catId: string; provId?: string; locId?: string; stock: number; min: number }

  const prods: P[] = [
    // Cigarrillos — markup ~5%
    { sku: "CIG-001", barcode: "7790387000014", nombre: "Marlboro Box x20",    costo: 40000000, precio: 42000000, catId: catCig.id, provId: provPhilip.id, stock: 50, min: 10 },
    { sku: "CIG-002", barcode: "7790387000021", nombre: "Lucky Strike x20",    costo: 38000000, precio: 39900000, catId: catCig.id, provId: provPhilip.id, stock: 40, min: 10 },

    // Gaseosas — markup ~40%
    { sku: "GAS-001", barcode: "7790580558025", nombre: "Coca-Cola 500ml",     costo: 800000, precio: 1120000, catId: catGas.id, provId: provCoca.id, locId: locHeladera.id, stock: 60, min: 12 },
    { sku: "GAS-002", barcode: "7790580558032", nombre: "Coca-Cola 1.5L",      costo: 1400000, precio: 1960000, catId: catGas.id, provId: provCoca.id, locId: locHeladera.id, stock: 30, min: 6 },
    { sku: "GAS-003", barcode: "7790387000052", nombre: "Sprite 500ml",        costo: 780000, precio: 1090000, catId: catGas.id, provId: provCoca.id, locId: locHeladera.id, stock: 24, min: 6 },
    { sku: "GAS-004", barcode: "7790387000069", nombre: "Agua Villavicencio 500ml", costo: 450000, precio: 630000, catId: catGas.id, locId: locHeladera.id, stock: 48, min: 12 },
    { sku: "GAS-005", barcode: "7790387000076", nombre: "Powerade Azul 500ml", costo: 920000, precio: 1290000, catId: catGas.id, locId: locHeladera.id, stock: 20, min: 6 },

    // Golosinas — markup ~70%
    { sku: "GOL-001", barcode: "7790387000083", nombre: "Alfajor Oreo",        costo: 350000, precio: 595000, catId: catGol.id, provId: provDist.id, stock: 30, min: 10 },
    { sku: "GOL-002", barcode: "7790387000090", nombre: "Alfajor Jorgito x2",  costo: 280000, precio: 476000, catId: catGol.id, provId: provDist.id, stock: 40, min: 10 },
    { sku: "GOL-003", barcode: "7790387000107", nombre: "Chupetín Pico Dulce", costo: 50000,  precio: 85000,  catId: catGol.id, stock: 60, min: 20 },
    { sku: "GOL-004", barcode: "7790387000114", nombre: "Chicle Beldent x20",  costo: 220000, precio: 374000, catId: catGol.id, stock: 25, min: 10 },
    { sku: "GOL-005", barcode: "7790387000121", nombre: "Chocolate Milka 100g",costo: 650000, precio: 1105000,catId: catGol.id, provId: provDist.id, stock: 15, min: 5 },

    // Alimentos secos
    { sku: "ALI-001", barcode: "7790387000138", nombre: "Fideos Marolio 500g", costo: 550000, precio: 715000, catId: catAli.id, provId: provDist.id, locId: locEstante.id, stock: 20, min: 5 },
    { sku: "ALI-002", barcode: "7790387000145", nombre: "Arroz Molinos Río 1kg",costo: 800000, precio: 1040000,catId: catAli.id, provId: provDist.id, locId: locEstante.id, stock: 15, min: 5 },
    { sku: "ALI-003", barcode: "7790387000152", nombre: "Aceite Cocinero 900ml",costo: 1750000,precio: 2275000,catId: catAli.id, provId: provDist.id, locId: locEstante.id, stock: 10, min: 3 },

    // Lácteos
    { sku: "LAC-001", barcode: "7790387000169", nombre: "Leche La Serenísima 1L",costo: 900000,precio: 1080000,catId: catLac.id, locId: locHeladera.id, stock: 20, min: 6 },
    { sku: "LAC-002", barcode: "7790387000176", nombre: "Yogur Ser Natural 190g",costo: 650000,precio: 780000, catId: catLac.id, locId: locHeladera.id, stock: 12, min: 4 },

    // Limpieza
    { sku: "LIM-001", barcode: "7790387000183", nombre: "Jabón Dove 90g",      costo: 550000, precio: 742500, catId: catLim.id, provId: provPG.id, locId: locEstante.id, stock: 15, min: 5 },
    { sku: "LIM-002", barcode: "7790387000190", nombre: "Shampoo Pantene 400ml",costo:1300000,precio: 1755000,catId: catLim.id, provId: provPG.id, locId: locEstante.id, stock: 8, min: 3 },
    { sku: "LIM-003", barcode: "7790387000207", nombre: "Lavandina Ayudín 1L", costo: 450000, precio: 607500, catId: catLim.id, locId: locEstante.id, stock: 10, min: 4 },
  ]

  for (const p of prods) {
    await prisma.product.upsert({
      where: { sku_organizationId: { sku: p.sku, organizationId: org.id } },
      create: { sku: p.sku, barcode: p.barcode, nombre: p.nombre, costoCentavos: p.costo, precioCentavos: p.precio, costoEsProvisional: false, categoryId: p.catId, providerId: p.provId, locationId: p.locId, stock: p.stock, stockMinimo: p.min, organizationId: org.id },
      update: {},
    })
  }

  // ─── Ventas de ejemplo (3 días) ───────────────────────────────────────────
  const coca = await prisma.product.findFirstOrThrow({ where: { sku: "GAS-001", organizationId: org.id } })
  const oreo = await prisma.product.findFirstOrThrow({ where: { sku: "GOL-001", organizationId: org.id } })
  const marlboro = await prisma.product.findFirstOrThrow({ where: { sku: "CIG-001", organizationId: org.id } })

  for (let diasAtras = 0; diasAtras < 3; diasAtras++) {
    const fecha1 = new Date(); fecha1.setDate(fecha1.getDate() - diasAtras); fecha1.setHours(10, 30, 0, 0)
    const total1 = coca.precioCentavos * 2 + oreo.precioCentavos
    const costo1 = coca.costoCentavos * 2 + oreo.costoCentavos
    const comision1 = Math.round((total1 * mpMP.comisionBp) / 10_000)
    await prisma.sale.create({
      data: {
        fecha: fecha1, userId: admin.id, organizationId: org.id,
        totalCentavos: total1, costoTotalCentavos: costo1,
        lines: { create: [
          { productId: coca.id, cantidad: 2, precioUnitarioCentavos: coca.precioCentavos, costoUnitarioCentavos: coca.costoCentavos },
          { productId: oreo.id, cantidad: 1, precioUnitarioCentavos: oreo.precioCentavos, costoUnitarioCentavos: oreo.costoCentavos },
        ]},
        payments: { create: [{ paymentMethodId: mpMP.id, montoCentavos: total1, comisionCentavos: comision1, montoNetoCentavos: total1 - comision1 }] },
      },
    })

    const fecha2 = new Date(); fecha2.setDate(fecha2.getDate() - diasAtras); fecha2.setHours(15, 0, 0, 0)
    const total2 = marlboro.precioCentavos * 3
    const costo2 = marlboro.costoCentavos * 3
    await prisma.sale.create({
      data: {
        fecha: fecha2, userId: admin.id, organizationId: org.id,
        totalCentavos: total2, costoTotalCentavos: costo2,
        lines: { create: [{ productId: marlboro.id, cantidad: 3, precioUnitarioCentavos: marlboro.precioCentavos, costoUnitarioCentavos: marlboro.costoCentavos }] },
        payments: { create: [{ paymentMethodId: mpEfectivo.id, montoCentavos: total2, comisionCentavos: 0, montoNetoCentavos: total2 }] },
      },
    })
  }

  console.log("✅ Seed completado")
  console.log("   👤 admin@kiosco.ar / (tu SEED_ADMIN_PASSWORD)")
  console.log("   👤 vendedor@kiosco.ar / vendedor123")
  console.log(`   📦 ${prods.length} productos`)
  console.log("   🛍️  6 ventas de ejemplo (3 días × 2 ventas)")
  console.log(`   🏧 Caja general (${cajaGeneral.id}) + Caja Cigarrillos (${cajaCigarrillos.id})`)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function upsertCat(
  orgId: string,
  nombre: string,
  markupDefaultBp: number,
  cajaId?: string,
  markupDefaultTipo: "PORCENTUAL" | "FIJO" = "PORCENTUAL",
  markupDefaultFijoCentavos = 0,
) {
  return prisma.category.upsert({
    where: { nombre_organizationId: { nombre, organizationId: orgId } },
    create: { nombre, markupDefaultBp, markupDefaultTipo, markupDefaultFijoCentavos, cajaId: cajaId ?? null, organizationId: orgId },
    update: { cajaId: cajaId ?? null },
  })
}
function upsertProv(orgId: string, nombre: string) {
  return prisma.provider.upsert({
    where: { nombre_organizationId: { nombre, organizationId: orgId } },
    create: { nombre, organizationId: orgId },
    update: {},
  })
}
function upsertLoc(orgId: string, nombre: string) {
  return prisma.location.upsert({
    where: { nombre_organizationId: { nombre, organizationId: orgId } },
    create: { nombre, organizationId: orgId },
    update: {},
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
