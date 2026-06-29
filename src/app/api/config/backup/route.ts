import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }
  const orgId = session.user.organizationId

  const [org, categorias, proveedores, ubicaciones, mediosPago, gastosFijos, productos] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId } }),
    prisma.category.findMany({ where: { organizationId: orgId }, orderBy: { nombre: "asc" } }),
    prisma.provider.findMany({ where: { organizationId: orgId }, orderBy: { nombre: "asc" } }),
    prisma.location.findMany({ where: { organizationId: orgId }, orderBy: { nombre: "asc" } }),
    prisma.paymentMethod.findMany({ where: { organizationId: orgId }, orderBy: { orden: "asc" } }),
    prisma.fixedExpense.findMany({ where: { organizationId: orgId }, include: { montos: { orderBy: { mesAnio: "desc" }, take: 12 } } }),
    prisma.product.findMany({ where: { organizationId: orgId, activo: true }, orderBy: { nombre: "asc" } }),
  ])

  const backup = {
    exportadoEn: new Date().toISOString(),
    organizacion: { id: org.id, nombre: org.nombre, cuit: org.cuit, condicionIva: org.condicionIva, puntoDeVenta: org.puntoDeVenta, stockMinimoDefault: org.stockMinimoDefault },
    categorias,
    proveedores,
    ubicaciones,
    mediosPago,
    gastosFijos,
    productos,
  }

  const filename = `pyme-backup-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
