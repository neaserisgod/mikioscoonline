import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { completarComisionReal } from "@/lib/mercadopago-comisiones"

export const maxDuration = 60

/**
 * Reconciliación de respaldo: completa Payment.comisionRealCentavos para
 * cobros de MercadoPago cuyo webhook nunca llegó (el camino normal es
 * src/app/api/mp-webhook). Sin esto, un webhook perdido deja la comisión
 * real en null para siempre — solo afecta métricas/rentabilidad, no bloquea
 * ninguna venta.
 */
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // Margen para que el webhook normal llegue solo (puede tardar minutos) y
  // límite hacia atrás: si a los 7 días no llegó, ya no va a llegar.
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const hasta = new Date(Date.now() - 30 * 60 * 1000)

  const pendientes = await prisma.payment.findMany({
    where: {
      comisionRealCentavos: null,
      referencia: { not: null },
      paymentMethod: { esMercadoPago: true },
      createdAt: { gte: desde, lte: hasta },
    },
    select: { referencia: true },
    take: 50,
  })

  for (const p of pendientes) {
    if (p.referencia) await completarComisionReal(p.referencia)
  }

  return NextResponse.json({ ok: true, procesados: pendientes.length })
}
