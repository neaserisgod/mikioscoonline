# PENDIENTE — Variantes que comparten stock · Fase 2 (URGENTE)

> **Revisar al inicio de la próxima sesión.**
> La Fase 1 (modelo + lógica de stock) ya está implementada y testeada.
> Esto es lo que quedó pendiente y **no** hay que hacer todavía junto con el
> trabajo de facturación — se omitió a propósito para no mezclar cambios.

## Contexto (lo que ya está hecho — Fase 1)

- `Product` tiene `variantOfId` (self-relación nullable al "dueño" del stock) y
  `unidadesPorVenta` (factor). El stock vive solo en el dueño; las variantes
  tienen precio/costo/barcode propios pero comparten el stock del dueño.
- Migración `20260716004126_variantes_comparten_stock` aplicada **solo contra
  Neon (Postgres/producción)**.
- Validación y decremento de stock en `venta.service.ts` resuelven contra el
  dueño (`stockOwnerId = variantOfId ?? id`), acumulando el requerido por dueño.
- Stock bajo, inventario y `validarVariante` contemplados. Tests en
  `tests/unit/venta.test.ts`.

## Pendiente (Fase 2) — en orden de prioridad

### 1. ⚠️ Paridad de esquema SQLite / kiosco (BLOQUEANTE)
La migración de Fase 1 se aplicó a Neon pero **NO** a `prisma/schema.dev.prisma`
ni a `kiosco.db` (el que usa el kiosco real vía `LOCAL_DEV`/`DATABASE_URL=file:./kiosco.db`).
El kiosco local **está desincronizado**: no tiene las columnas `variantOfId` /
`unidadesPorVenta`. Antes de que el kiosco pueda usar variantes hay que:
- Agregar los dos campos a `prisma/schema.dev.prisma`.
- Aplicarlos al SQLite (`npm run db:push:kiosco` y/o `db:push:local`).

### 2. Selector de variante en el POS
- El catálogo/buscador debe mostrar **solo dueños** (`variantOfId = null`) —
  ocultar las variantes como filas sueltas.
- Al agregar un producto con variantes al carrito, elegir unidad / media docena
  / docena (cada una con su precio propio). La línea de venta referencia la
  variante elegida; el stock ya se descuenta del dueño (lógica de Fase 1).
- Archivos probables: `src/components/catalogo-buscador.tsx`,
  `src/app/(dashboard)/vender/vender-client.tsx`, carrito.

### 3. Alta/edición de variantes en Productos
- Poder crear una variante ligada a un dueño y setear el factor
  (`unidadesPorVenta`), precio, costo y barcode propios.
- Respetar `validarVariante` (factor >= 1, sin pesables, sin cadenas, sin
  auto-referencia, no convertir en variante un producto que ya tiene variantes).
- Archivos probables: `producto-form.tsx`, `productos-client.tsx`,
  `productos.actions.ts`.

### 4. Fix del AJUSTE de stock (decisión de diseño)
Hoy `stock.service.ts` aplica el factor `unidadesPorVenta` tanto a ENTRADA como
a AJUSTE. Para **ENTRADA** está bien (recibir "5 docenas" = 60 unidades). Para
**AJUSTE** (corrección contra conteo físico, que se cuenta en unidades base)
aplicar el factor sorprende: ajustar "-2" pensando 2 unidades saca 24. 
**Decisión pendiente:** que los ajustes se hagan en unidades base sobre el
dueño, sin factor. Cambio acotado (una rama del service).

### 5. Rentabilidad / reportes (evaluar)
Cada variante es hoy un producto separado en `SaleLine`, así que en rentabilidad
aparecen las 3 por separado. Evaluar si conviene agruparlas bajo el dueño.

## Verificación pendiente
- Probar el flujo completo de venta de variantes end-to-end (POS → venta →
  descuento de stock del dueño → reposición) una vez que exista la UI.
