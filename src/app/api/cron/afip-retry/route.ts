import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { facturacionService } from "@/services/facturacion.service"

export const maxDuration = 60

/**
 * Reintenta comprobantes que quedaron en ERROR (AFIP caído, datos fiscales
 * incompletos, etc.) sin esperar a que alguien entre a /historial-ventas y
 * los reintente a mano. facturarVenta es idempotente y nunca lanza — si
 * sigue fallando, el Comprobante queda en ERROR de nuevo para el próximo
 * intento. El filtro por updatedAt evita pegarle a AFIP en loop apretado
 * sobre el mismo comprobante recién fallado.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const pendientes = await prisma.comprobante.findMany({
    where: { estado: "ERROR", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
    select: { saleId: true, organizationId: true },
    take: 20,
  })

  for (const c of pendientes) {
    await facturacionService.facturarVenta(c.saleId, c.organizationId)
  }

  return NextResponse.json({ ok: true, procesados: pendientes.length })
}
