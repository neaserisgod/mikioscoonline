import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { proveedorService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await proveedorService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const ProveedorSchema = z.object({ nombre: z.string().min(1) })

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = ProveedorSchema.parse(await req.json())
    const proveedor = await proveedorService.crear(result.user.organizationId, data)
    return NextResponse.json(proveedor)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
