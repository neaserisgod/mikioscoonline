import { NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"

// Heartbeat barato para que el cliente offline (Flutter) sepa si el servidor
// responde de verdad, no solo si el SO reporta wifi conectado. Sin acceso a DB.
export async function GET() {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  return NextResponse.json({ ok: true })
}
