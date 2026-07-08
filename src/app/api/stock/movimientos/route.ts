import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { stockService } from "@/services/stock.service"
import { Prisma } from "@prisma/client"
import { z } from "zod"

function mensajeError(e: unknown): string {
  // No devolver el mensaje nativo de Prisma al cliente — filtra nombres de
  // columnas/tablas internas. Los errores de negocio (stock negativo, producto
  // no encontrado en la org) son `new Error(...)` planos y siguen pasando abajo.
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    return e.code === "P2025" ? "Producto no encontrado" : "Error de base de datos"
  }
  return e instanceof Error ? e.message : "Error"
}

export async function GET(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const limit = req.nextUrl.searchParams.get("limit")
  const data = await stockService.listarTodos(result.user.organizationId, {
    limit: limit ? parseInt(limit) : undefined,
  })
  return NextResponse.json(data)
}

const MovimientoSchema = z.object({
  productId: z.string(),
  tipo: z.enum(["ENTRADA", "AJUSTE"]),
  cantidad: z.number().int().positive(),
  motivo: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const sesion = await requireSessionApi()
  if ("error" in sesion) return sesion.error

  const body = await req.json()
  const parsed = MovimientoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }

  // Mismo chequeo que ajusteStockAction — sin esto, un VENDEDOR podía ajustar stock
  // pegándole directo a esta API aunque la acción del formulario se lo impida.
  if (parsed.data.tipo === "AJUSTE" && sesion.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo ADMIN puede hacer ajustes de stock" }, { status: 403 })
  }

  try {
    const result = await stockService.registrarMovimiento({
      ...parsed.data,
      userId: sesion.user.id,
      organizationId: sesion.user.organizationId,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: mensajeError(e) }, { status: 400 })
  }
}
