# Revisión de código — pyme-ventas

**Fecha:** 2026-07-14
**Alcance:** revisión completa del proyecto (~23.400 líneas, 227 archivos TS/TSX).
**Foco pedido:** bugs y correctitud · calidad y arquitectura · rendimiento.

## Resumen ejecutivo

El proyecto está **en muy buen estado**. La lógica de dinero está centralizada en
`src/domain/` con centavos enteros (nunca floats), las server actions y los
services scopean todo por `organizationId` de forma consistente, las
transacciones usan decrementos atómicos condicionales para evitar oversell, y
los webhooks/cron validan firma y secreto. TypeScript compila **sin errores**.

No se encontraron bugs críticos de correctitud. Los hallazgos son mejoras de
robustez, cobertura de tests y mantenibilidad. Ya se aplicó el arreglo de mayor
valor y menor riesgo: **cobertura de tests para la lógica de dinero que no la
tenía** (ver "Cambios aplicados").

---

## Verificaciones automáticas

| Chequeo | Resultado |
|---|---|
| `tsc --noEmit` (typecheck) | ✅ Pasa sin errores |
| `vitest` (unit) | ⚠️ No corre en este entorno (binding nativo de Linux ausente; el `node_modules` mensajeado vino de Windows). Se validó la lógica compilando con `tsc` y corriendo en Node. |
| `eslint` | ⏱️ No completó por tiempo (proyecto grande). Recomendado correr local con cache. |

> El fallo de vitest/eslint es de **entorno**, no del código. En la máquina del
> usuario corren normalmente.

---

## Hallazgos

### Correctitud

**C1 — Deriva de redondeo en el reparto por caja (menor).**
En `venta.service.ts` (paso 7), el monto cobrado se reparte entre cajas con un
`Math.round` independiente por cada combinación (pago × categoría). La suma de
los `MovimientoCaja` puede diferir del total cobrado en unos pocos centavos en
ventas con varias cajas y varios medios de pago. No genera pérdida de plata real
(el cliente paga el total correcto), pero los arqueos por caja pueden mostrar
diferencias de centavos. Si molesta, conviene asignar el resto de redondeo a la
caja principal (patrón "largest remainder").

**C2 — Idempotencia por `id` con carrera teórica (menor).**
El replay idempotente en `crear` (venta) y `abrirCaja`/`registrarMovimiento`
(caja) lee primero y crea después. Dos requests concurrentes con el mismo `id`
podrían pasar ambos el check; el segundo `create` falla por PK duplicada y la
transacción revierte — no hay estado corrupto, pero el error no se traduce a la
respuesta "ya procesado". Aceptable; documentarlo o capturar la violación de
unicidad como éxito idempotente lo cierra del todo.

**C3 — `parsearARS` con formatos ambiguos (menor).**
`src/domain/dinero.ts` interpreta el punto como separador de miles vía regex.
Es correcto para el formato argentino y para los casos de entrada reales, pero
`"1234.567"` se leería como `1234567`. En la práctica los montos tienen 2
decimales, así que no afecta; queda como nota.

### Rendimiento

**R1 — Agregación en memoria en `rentabilidad.service.ts` (escala).**
`porAgrupador` trae **todas** las líneas de venta del período a memoria y agrupa
en JS. Perfecto para un kiosco; para rangos históricos grandes en el SaaS
multi-tenant conviene migrar a `groupBy`/SQL agregado. Ya está anotado en el
código y en `NOTAS-ESCALADO-SAAS.md`.

**R2 — N+1 acotado en cajas.**
`resumenService.equilibrioReal` y `cajaSesionService.arqueosPendientes` hacen
una query de sesión por caja. Con 3–4 cajas es despreciable; si el número de
cajas crece, batchear con un `findMany` + agrupación.

### Calidad y arquitectura

**Q1 — Componentes cliente monolíticos (mantenibilidad).**
`config-client.tsx` tiene **2.320 líneas** y `dashboard-client.tsx` **1.177**.
Son los archivos más difíciles de mantener del proyecto. Recomendado dividir por
sección/pestaña en subcomponentes y extraer hooks de datos.

**Q2 — Errores silenciados sin log.**
Facturación/impresión en `venta.service.ts` y el webhook de MP usan
`.catch(() => {})` / `catch {}` (decisión de diseño correcta para no romper la
venta), pero sin registrar nada. Un `console.error`/log estructurado ayudaría a
diagnosticar fallos de AFIP/MP en producción.

**Q3 — Cobertura de tests desbalanceada (ATENDIDO).**
Antes de esta revisión, la lógica de dinero **más reutilizada** no tenía tests:
`pesables.ts` (`subtotalLinea` — usada en venta, rentabilidad e inventario),
`recargo-cigarrillos.ts` y buena parte de `dinero.ts`. Ver "Cambios aplicados".

---

## Cambios aplicados

Se agregaron 3 archivos de tests unitarios cubriendo la lógica de dinero pura
que no tenía cobertura (todos verificados corriendo las funciones reales):

- `tests/unit/pesables.test.ts` — precio/costo efectivo, `subtotalLinea`
  (pesable vs unidad, redondeo, edge cases), `stockDisponible`,
  `valoresInventario`, `gananciaPotencial`.
- `tests/unit/recargo-cigarrillos.test.ts` — escalonado de atados, sueltos,
  mezcla, e ítems ignorados.
- `tests/unit/dinero.test.ts` — `parsearARS`, `redondearPesoArriba`,
  conversiones float↔centavos, `toMesAnio`, `parseFechaQuery`.

Ningún cambio toca lógica de negocio existente — solo se agregó cobertura.

---

## Segunda tanda — arreglos aplicados (vía libre)

Durante los arreglos apareció un **bug real** no detectado en la primera pasada:

**B1 — Subtotal incorrecto de líneas pesables en el ticket impreso (CORREGIDO).**
`impresion.service.ts` imprimía, para productos pesables, el **precio por kg
completo** en vez del subtotal por los gramos vendidos
(`precioUnitarioCentavos × (esPesable ? 1 : cantidad)`). Un pesable de 250 g a
$8.000/kg salía impreso como **$8.000** en su línea en vez de **$2.000**, y las
líneas no sumaban el total del ticket. Se reemplazó por `subtotalLinea()` del
dominio, que ya redondea y maneja pesables correctamente.

Además:

- **Logger (`src/lib/log.ts`, nuevo).** Logger mínimo de servidor. Se usa en los
  `catch` que antes tragaban errores en silencio: facturación AFIP e impresión
  en `venta.service.ts`, el webhook de MP y la impresión de ticket. Ahora un
  fallo de AFIP/MP/impresión queda registrado (con `saleId`/`topic`/`dataId`)
  sin romper la venta ya confirmada. (Cierra **Q2**.)
- **Idempotencia real ante carrera de reintentos (C2, CORREGIDO).** En
  `venta.service.crear`, dos reintentos del mismo `id` en vuelo simultáneo
  podían pasar ambos el check del paso 0 y chocar en el INSERT. Ahora se captura
  la violación de unicidad (`P2002`) y se devuelve la venta ya existente —
  idempotencia real, sin duplicar stock ni movimientos de caja.

Verificación: el patrón `Prisma.PrismaClientKnownRequestError` + `Awaited<
ReturnType<>>` se type-chequeó en aislamiento contra el `@prisma/client` real
(EXIT 0), la firma de `subtotalLinea` calza con el call site, y los archivos se
releyeron completos y bien formados. Nota: la suite completa (`tsc`/`vitest`)
no se pudo correr end-to-end en el entorno de la revisión por un desfase del
mount del sandbox (los archivos editados se veían truncados desde la shell,
aunque en disco están correctos). **Correr `tsc --noEmit` y `vitest run` en la
máquina local para el visto bueno final.**

## Recomendaciones priorizadas

1. Correr `tsc --noEmit` y `vitest run` en local para el visto bueno final (nueva suite + fixes).
2. (Q1) Dividir `config-client.tsx` y `dashboard-client.tsx`.
3. (C1) Evaluar reparto por "largest remainder" si aparecen diferencias de centavos en arqueos.
4. (R1) Planificar migración de rentabilidad a agregación en SQL antes de escalar el SaaS.
5. Extender el uso de `src/lib/log.ts` a otros `catch` silenciados del cliente si se quiere telemetría.
