import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const productos = await prisma.product.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      category: { select: { nombre: true } },
      provider: { select: { nombre: true } },
    },
    orderBy: { nombre: "asc" },
  })

  const rows = [
    ["sku", "nombre", "categoria", "proveedor", "stock", "stockMinimo", "precio", "costo", "activo"],
    ...productos.map((p) => [
      p.sku,
      p.nombre,
      p.category?.nombre ?? "",
      p.provider?.nombre ?? "",
      p.stock,
      p.stockMinimo,
      (p.precioCentavos / 100).toFixed(2),
      (p.costoCentavos / 100).toFixed(2),
      p.activo ? "si" : "no",
    ]),
  ]

  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")
  const filename = `stock-${new Date().toISOString().slice(0, 10)}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
