import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSessionApi } from "@/lib/api-auth"
import { customerService } from "@/services/customer.service"

// Cualquier usuario autenticado (VENDEDOR incluido) puede listar/crear
// clientes — se usa en el checkout del POS para dejar un resto a cuenta
// corriente, no es una pantalla exclusiva de configuración de ADMIN.
export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const data = await customerService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const ClienteSchema = z.object({
  nombre: z.string().min(1),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  try {
    const data = ClienteSchema.parse(await req.json())
    const cliente = await customerService.crear(result.user.organizationId, data)
    return NextResponse.json(cliente)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
