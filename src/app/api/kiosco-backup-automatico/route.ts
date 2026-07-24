import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPrismaClient } from "@/lib/prisma-client-factory"
import { subirCambiosLocales, aplicarRecuentosPendientes } from "../../../../scripts/lib/kiosco-sync"

/**
 * Disparado periódicamente por src-tauri/src/lib.rs (timer propio, cada
 * KIOSCO_BACKUP_INTERVALO_MIN minutos + un intento best-effort al cerrar la
 * ventana) — nunca desde el navegador. Sube (subirCambiosLocales, upsert
 * idempotente + borrado espejo de lo que ya usa el backup nocturno, ver
 * scripts/kiosco-backup-once.ts): NUNCA baja ni borra el catálogo/las ventas
 * locales, así que no hay riesgo de pisar nada corriéndolo seguido. La única
 * excepción es aplicarRecuentosPendientes, que corre ANTES que la subida y sí
 * escribe stock local — a propósito: son notas cargadas por el dueño desde
 * /recuento (celular) y tienen que aplicarse antes de que la subida de abajo
 * pise ese conteo con el stock local viejo. Protegido con el mismo patrón que
 * las rutas /api/cron/* (Bearer token en un env var), generado una sola vez
 * por caja en config.env (ver load_or_init_config_env en lib.rs).
 */
export async function POST(req: Request) {
  const token = process.env.KIOSCO_BACKUP_TOKEN
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  const neonUrl = process.env.NEON_DATABASE_URL
  if (!neonUrl) {
    return NextResponse.json({ error: "Esta caja no tiene NEON_DATABASE_URL" }, { status: 400 })
  }

  const neon = createPrismaClient(neonUrl)
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } })
    if (orgs.length !== 1) {
      return NextResponse.json(
        { ok: false, error: `dev.db tiene ${orgs.length} organización(es), se esperaba 1` },
        { status: 500 }
      )
    }
    // Invariante: aplicar recuentos pendientes ANTES de subir — si no, la
    // subida de abajo (product.stock incluido) pisaría el conteo recién
    // cargado desde /recuento con el stock local viejo. No cambiar el orden.
    // Try/catch PROPIO a propósito: si esto falla (ej. la caja todavía no
    // tiene la migración de RecuentoPendiente aplicada en Neon), no puede
    // frenar la subida de ventas de abajo — esa es la parte crítica que este
    // endpoint no se puede dar el lujo de saltear.
    let recuentos: { aplicados: number; saltados: number } | null = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recuentos = await aplicarRecuentosPendientes(prisma as any, neon as any, orgs[0].id)
    } catch (e) {
      console.error(
        "kiosco-backup-automatico: aplicarRecuentosPendientes falló, se sigue igual con la subida de ventas:",
        e
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subidos = await subirCambiosLocales(prisma as any, neon as any, orgs[0].id)
    return NextResponse.json({ ok: true, recuentos, subidos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 })
  } finally {
    await neon.$disconnect()
  }
}
