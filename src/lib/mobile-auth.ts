import { SignJWT, jwtVerify } from "jose"
import type { UsuarioAutenticado } from "@/lib/verificar-credenciales"

// Mismo secreto que usa NextAuth (AUTH_SECRET) — separamos el "issuer" para que
// un token de este flujo no se pueda confundir con la sesión JWT de NextAuth
// (que tiene otro formato de claims) ni viceversa.
const ISSUER = "kiosco-mobile"
const EXPIRACION = "180d" // el kiosco no debería tener que reloguearse seguido

function getSecretKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret) throw new Error("Falta AUTH_SECRET")
  return new TextEncoder().encode(secret)
}

export type MobileTokenClaims = {
  sub: string // userId
  email: string
  nombre: string
  role: "ADMIN" | "VENDEDOR"
  organizationId: string
}

export async function firmarTokenMobile(user: UsuarioAutenticado): Promise<string> {
  return new SignJWT({
    email: user.email,
    nombre: user.nombre,
    role: user.role,
    organizationId: user.organizationId,
  } satisfies Omit<MobileTokenClaims, "sub">)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(EXPIRACION)
    .sign(getSecretKey())
}

/** Devuelve los claims si el token es válido, o null si no lo es / está vencido. */
export async function verificarTokenMobile(token: string): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: ISSUER })
    if (!payload.sub || !payload.organizationId || !payload.role) return null
    return payload as unknown as MobileTokenClaims
  } catch {
    return null
  }
}
