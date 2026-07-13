import { NextRequest, NextResponse } from "next/server"
import { requireSessionApi } from "@/lib/api-auth"
import { customerService } from "@/services/customer.service"

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await requireSessionApi()
  if ("error" in result) return result.error
  const { id } = await params
  const data = await customerService.listarVentasFiadas(id, result.user.organizationId)
  return NextResponse.json(data)
}
