// Helper compartido por la descarga inicial (Neon → kiosco.db) y el backup
// nocturno (kiosco.db → Neon). El orden de tablas está validado contra las FK
// reales del schema — Category.cajaId y PaymentMethod.cajaId referencian Caja,
// así que Caja tiene que copiarse antes que esas dos. Se usa el MISMO orden en
// las dos direcciones: el orden depende del grafo de FKs, no de la dirección.

export const ORDEN_TABLAS = [
  "organization",
  "user",
  "caja",
  "category",
  "provider",
  // Depende de provider (pago/compra) y opcionalmente de caja (ambos ya arriba).
  "movimientoCuentaCorrienteProveedor",
  "location",
  // Depende solo de organization (ya arriba) — antes de "sale", que la referencia opcionalmente.
  "customer",
  "paymentMethod",
  "fixedExpense",
  "fixedExpenseMonto",
  "cajaSesion",
  // Depende de cajaSesion, caja y user (los tres ya arriba).
  "arqueoParcial",
  "product",
  "sale",
  "saleLine",
  "payment",
  // Depende de sale y organization (ambos ya arriba) — incluye la columna `pdf`.
  "comprobante",
  "stockMovement",
  "movimientoCaja",
] as const

export type NombreTabla = (typeof ORDEN_TABLAS)[number]

// Únicos modelos con hard-delete real en la app (config.service.ts) — un
// upsert-only nunca borra en destino, así que necesitan borrado espejo en el
// backup para no dejar huérfanos en Neon.
export const MODELOS_CON_BORRADO = new Set<NombreTabla>(["category", "provider", "location"])

// Campos a excluir de la sincronización (en las dos direcciones) por modelo —
// hoy solo Sale.ticketPdf: es regenerable a partir de la propia venta (no un
// comprobante legal como Comprobante.pdf, que SÍ se sincroniza entero) y no
// tiene sentido inflar el backup/la descarga con un PDF por cada venta.
const CAMPOS_EXCLUIDOS: Partial<Record<NombreTabla, Record<string, true>>> = {
  sale: { ticketPdf: true },
}

// Tablas que bajan de Neon en el sync manual (botón "Sincronizar con la
// nube", ver sincronizar-caja.actions.ts) — subconjunto de ORDEN_TABLAS, mismo
// orden FK-safe, sin las transaccionales (sale/pagos/movimientos de caja):
// esas se suben pero nunca se traen de vuelta, para no arriesgar datos
// locales que todavía no subieron por el backup nocturno.
export const TABLAS_DESCARGA = [
  "organization",
  "user",
  "caja",
  "category",
  "provider",
  "location",
  "customer",
  "paymentMethod",
  "fixedExpense",
  "fixedExpenseMonto",
  "product",
] as const satisfies readonly NombreTabla[]

// Campos que el sync manual (Neon → local) solo escribe si la fila es NUEVA
// localmente — si ya existe, se preservan intactos. Son contadores/saldos que
// cambian localmente por fuera de cualquier pantalla de catálogo (ventas,
// login, cuenta corriente), así que pisarlos con la foto de Neon del momento
// del sync perdería cambios reales hechos en esta caja.
const CAMPOS_SOLO_EN_CREACION: Partial<Record<NombreTabla, Record<string, true>>> = {
  product: { stock: true },
  provider: { saldoReposicionCentavos: true, saldoCuentaCorrienteCentavos: true },
  customer: { saldoCuentaCorrienteCentavos: true },
  caja: { saldoManualCentavos: true, saldoManualActualizadoEn: true },
  user: { failedLoginAttempts: true, lockedUntil: true },
  // Organization: conservador a propósito — solo bajan campos de identidad
  // fiscal (nombre/cuit/condicionIva/puntoDeVenta). Todo lo demás (toggles de
  // facturación, montos del modelo financiero, saldo de MP, estado de
  // suscripción del SaaS) se preserva local si la fila ya existe.
  organization: {
    facturacionModoProduccion: true,
    imprimirTicketPosnet: true,
    stockMinimoDefault: true,
    sueldoObjetivoCentavos: true,
    monotributoCentavos: true,
    horariosArqueo: true,
    saldoMpCentavos: true,
    saldoMpActualizadoEn: true,
    onboardingCompletadoAt: true,
    estadoPago: true,
    trialTerminaEl: true,
    mpPreapprovalId: true,
  },
}

function sinCampos(fila: Record<string, unknown>, campos?: Record<string, true>): Record<string, unknown> {
  if (!campos) return fila
  const copia = { ...fila }
  for (const campo of Object.keys(campos)) delete copia[campo]
  return copia
}

export function whereOrg(modelo: NombreTabla, organizationId: string): Record<string, unknown> {
  switch (modelo) {
    case "organization":
      return { id: organizationId }
    case "fixedExpenseMonto":
      return { fixedExpense: { organizationId } }
    case "saleLine":
    case "payment":
      return { sale: { organizationId } }
    case "stockMovement":
      return { product: { organizationId } }
    default:
      return { organizationId }
  }
}

interface ModeloPrisma {
  findMany: (args: {
    where: Record<string, unknown>
    select?: Record<string, unknown>
    omit?: Record<string, unknown>
  }) => Promise<Record<string, unknown>[]>
  upsert: (args: {
    where: { id: string }
    create: Record<string, unknown>
    update: Record<string, unknown>
    omit?: Record<string, unknown>
  }) => Promise<unknown>
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>
}

const TAMANO_LOTE = 20

/**
 * Copia todas las filas que matchean `where` de `origen` a `destino`, por
 * upsert (id). Idempotente: correrlo de nuevo no duplica nada. Excluye los
 * campos de CAMPOS_EXCLUIDOS para el modelo dado (hoy solo Sale.ticketPdf).
 *
 * `preservarLocalEnUpdate` (solo lo usa el sync manual, ver TABLAS_DESCARGA):
 * si es true, los campos de CAMPOS_SOLO_EN_CREACION para este modelo se
 * incluyen en el `create` (fila nueva → se trae completa) pero se excluyen
 * del `update` (fila ya existente → se preserva el valor local, no se pisa).
 */
export async function copiarTabla(
  nombre: NombreTabla,
  origen: ModeloPrisma,
  destino: ModeloPrisma,
  where: Record<string, unknown>,
  preservarLocalEnUpdate = false
): Promise<{ count: number; ids: string[] }> {
  const omit = CAMPOS_EXCLUIDOS[nombre]
  const soloEnCreacion = preservarLocalEnUpdate ? CAMPOS_SOLO_EN_CREACION[nombre] : undefined
  const filas = await origen.findMany({ where, ...(omit ? { omit } : {}) })
  const ids: string[] = []

  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE)
    await Promise.all(
      lote.map((fila) =>
        destino.upsert({
          where: { id: fila.id as string },
          create: fila,
          update: sinCampos(fila, soloEnCreacion),
        })
      )
    )
    for (const fila of lote) ids.push(fila.id as string)
  }

  console.log(`  ${nombre}: ${filas.length} fila(s)`)
  return { count: filas.length, ids }
}

/**
 * Borra en `destino` cualquier fila (dentro de `where`) cuyo id no esté entre
 * `idsVivosLocal` — solo se usa para Category/Provider/Location en el backup,
 * después de sincronizar Product, para reflejar los hard-deletes hechos en el
 * kiosco local.
 */
export async function borrarHuerfanos(
  nombre: string,
  destino: ModeloPrisma,
  where: Record<string, unknown>,
  idsVivosLocal: string[]
): Promise<number> {
  const vivos = new Set(idsVivosLocal)
  const remotos = await destino.findMany({ where, select: { id: true } })
  const aBorrar = remotos.map((r) => r.id as string).filter((id) => !vivos.has(id))
  if (aBorrar.length === 0) return 0

  await destino.deleteMany({ where: { id: { in: aBorrar } } })
  console.log(`  ${nombre}: ${aBorrar.length} fila(s) borrada(s) en destino (borrado espejo)`)
  return aBorrar.length
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClientePrisma = Record<NombreTabla, any>

/**
 * Sube todo lo que haya en `local` (kiosco.db) hacia `neon`, por upsert
 * idempotente por id, más borrado espejo para los modelos con hard-delete
 * real (MODELOS_CON_BORRADO). Compartida por el cron nocturno
 * (kiosco-backup-once.ts) y el botón manual de sincronización
 * (sincronizar-caja.actions.ts) — mismo comportamiento en los dos casos.
 */
export async function subirCambiosLocales(
  local: ClientePrisma,
  neon: ClientePrisma,
  organizationId: string
): Promise<Record<string, number>> {
  const resumen: Record<string, number> = {}
  const idsPorTabla: Record<string, string[]> = {}
  for (const modelo of ORDEN_TABLAS) {
    const where = whereOrg(modelo, organizationId)
    const { count, ids } = await copiarTabla(modelo, local[modelo], neon[modelo], where)
    idsPorTabla[modelo] = ids
    resumen[modelo] = count
  }

  console.log("\n── Borrado espejo ──")
  for (const modelo of MODELOS_CON_BORRADO) {
    const where = whereOrg(modelo, organizationId)
    await borrarHuerfanos(modelo, neon[modelo], where, idsPorTabla[modelo])
  }

  return resumen
}

/**
 * Baja de `neon` hacia `local` las tablas de catálogo (TABLAS_DESCARGA), por
 * upsert idempotente por id, SIN borrar nada — y sin pisar en las filas ya
 * existentes los campos de CAMPOS_SOLO_EN_CREACION (stock, saldos, contadores
 * locales). Usada por el botón manual de sincronización.
 */
export async function bajarCambiosDeNeon(
  neon: ClientePrisma,
  local: ClientePrisma,
  organizationId: string
): Promise<Record<string, number>> {
  const resumen: Record<string, number> = {}
  for (const modelo of TABLAS_DESCARGA) {
    const where = whereOrg(modelo, organizationId)
    const { count } = await copiarTabla(modelo, neon[modelo], local[modelo], where, true)
    resumen[modelo] = count
  }
  return resumen
}
