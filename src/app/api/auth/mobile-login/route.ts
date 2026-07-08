import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verificarCredenciales } from "@/lib/verificar-credenciales"
import { firmarTokenMobile } from "@/lib/mobile-auth"

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

/**
 * Login para el cliente Flutter (no usa cookies de NextAuth, no hay browser).
 * Devuelve un JWT de larga duración que el cliente manda como
 * `Authorization: Bearer <token>` en cada request a la API.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Email o contraseña inválidos" }, { status: 400 })
  }

  const user = await verificarCredenciales(parsed.data.email, parsed.data.password)
  if (!user) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 })
  }

  const token = await firmarTokenMobile(user)

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      organizationId: user.organizationId,
    },
  })
}
