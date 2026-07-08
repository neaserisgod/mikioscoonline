import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { jwtVerify, createRemoteJWKSet } from "jose"
import { resolverUsuarioGoogle } from "@/lib/resolver-usuario-google"
import { firmarTokenMobile } from "@/lib/mobile-auth"

const BodySchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().min(1),
})

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"))

type GoogleClaims = {
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
}

/**
 * Contraparte de /api/auth/mobile-login para "Continuar con Google" desde el
 * cliente Flutter. El cliente abre el navegador del sistema, hace el login
 * OAuth ahí (con PKCE) y nos manda el `code` — el intercambio por tokens pasa
 * acá, server-side, así el client_secret de Google nunca viaja en el binario
 * de la app de escritorio.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  const clientId = process.env.AUTH_GOOGLE_ID
  const clientSecret = process.env.AUTH_GOOGLE_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "Google no está configurado en el servidor" }, { status: 500 })
  }

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: parsed.data.code,
      code_verifier: parsed.data.codeVerifier,
      redirect_uri: parsed.data.redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResp.ok) {
    return NextResponse.json({ error: "No se pudo validar el login con Google" }, { status: 401 })
  }

  const { id_token: idToken } = (await tokenResp.json()) as { id_token?: string }
  if (!idToken) {
    return NextResponse.json({ error: "Google no devolvió id_token" }, { status: 401 })
  }

  let claims: GoogleClaims
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: clientId,
    })
    claims = payload as GoogleClaims
  } catch {
    return NextResponse.json({ error: "Token de Google inválido" }, { status: 401 })
  }

  if (!claims.email) {
    return NextResponse.json({ error: "Google no devolvió un email" }, { status: 401 })
  }

  const usuario = await resolverUsuarioGoogle({
    email: claims.email,
    emailVerified: claims.email_verified ?? false,
    nombre: claims.name,
    picture: claims.picture,
  })
  if (!usuario) {
    return NextResponse.json({ error: "No se pudo iniciar sesión con esta cuenta de Google" }, { status: 403 })
  }

  const token = await firmarTokenMobile(usuario)
  return NextResponse.json({
    token,
    user: {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      role: usuario.role,
      organizationId: usuario.organizationId,
    },
  })
}
