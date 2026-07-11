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
  "location",
  "paymentMethod",
  "fixedExpense",
  "fixedExpenseMonto",
  "cajaSesion",
  "product",
  "sale",
  "saleLine",
  "payment",
  "stockMovement",
  "movimientoCaja",
] as const

export type NombreTabla = (typeof ORDEN_TABLAS)[number]

// Únicos modelos con hard-delete real en la app (config.service.ts) — un
// upsert-only nunca borra en destino, así que necesitan borrado espejo en el
// backup para no dejar huérfanos en Neon.
export const MODELOS_CON_BORRADO = new Set<NombreTabla>(["category", "provider", "location"])

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
  findMany: (args: { where: Record<string, unknown>; select?: Record<string, unknown> }) => Promise<Record<string, unknown>[]>
  upsert: (args: { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }) => Promise<unknown>
  deleteMany: (args: { where: Record<string, unknown> }) => Promise<unknown>
}

const TAMANO_LOTE = 20

/**
 * Copia todas las filas que matchean `where` de `origen` a `destino`, por
 * upsert (id). Idempotente: correrlo de nuevo no duplica nada.
 */
export async function copiarTabla(
  nombre: string,
  origen: ModeloPrisma,
  destino: ModeloPrisma,
  where: Record<string, unknown>
): Promise<{ count: number; ids: string[] }> {
  const filas = await origen.findMany({ where })
  const ids: string[] = []

  for (let i = 0; i < filas.length; i += TAMANO_LOTE) {
    const lote = filas.slice(i, i + TAMANO_LOTE)
    await Promise.all(
      lote.map((fila) => destino.upsert({ where: { id: fila.id as string }, create: fila, update: fila }))
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
