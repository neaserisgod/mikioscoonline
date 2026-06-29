// Redirigido a /api/resumen
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.redirect(new URL("/api/resumen", "http://localhost"), { status: 308 })
}
