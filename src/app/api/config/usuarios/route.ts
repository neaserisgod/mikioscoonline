import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminApi } from "@/lib/api-auth"
import { usuarioService } from "@/services/config.service"

export async function GET() {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  const data = await usuarioService.listar(result.user.organizationId)
  return NextResponse.json(data)
}

const CrearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "VENDEDOR"]),
})

export async function POST(req: NextRequest) {
  const result = await requireAdminApi()
  if ("error" in result) return result.error
  try {
    const data = CrearUsuarioSchema.parse(await req.json())
    const usuario = await usuarioService.crear(result.user.organizationId, data)
    return NextResponse.json(usuario)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo crear" }, { status: 400 })
  }
}
