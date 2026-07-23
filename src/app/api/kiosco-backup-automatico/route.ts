import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createPrismaClient } from "@/lib/prisma-client-factory"
import { subirCambiosLocales } from "../../../../scripts/lib/kiosco-sync"

/**
 * Disparado periódicamente por src-tauri/src/lib.rs (timer propio, cada
 * KIOSCO_BACKUP_INTERVALO_MIN minutos + un intento best-effort al cerrar la
 * ventana) — nunca desde el navegador. Solo sube (subirCambiosLocales,
 * upsert idempotente + borrado espejo de lo que ya usa el backup nocturno,
 * ver scripts/kiosco-backup-once.ts): NUNCA baja ni borra datos locales, así
 * que no hay riesgo de pisar nada corriéndolo seguido. Protegido con el mismo
 * patrón que las rutas /api/cron/* (Bearer token en un env var), generado una
 * sola vez por caja en config.env (ver load_or_init_config_env en lib.rs).
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subidos = await subirCambiosLocales(prisma as any, neon as any, orgs[0].id)
    return NextResponse.json({ ok: true, subidos })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 })
  } finally {
    await neon.$disconnect()
  }
}
