# Reporte del núcleo — Productos, Vender, Mercado Pago, AFIP

**Fecha:** 2026-07-20 (Fase 1 — análisis), actualizado 2026-07-20 (Fase 2 — fix de los 4 críticos)
**Alcance:** los 4 flujos núcleo (Productos/Stock, Vender/POS, Mercado Pago, AFIP), de punta a punta. Se excluyó todo lo demás (clientes, proveedores, pedidos, rentabilidad, suscripción, onboarding) salvo `cajaSesionService`, que se incluye porque toda venta pasa por caja.
**Método:** lectura directa del código actual (no de memoria de sesiones previas) por 4 investigaciones paralelas, una por flujo, más verificación cruzada de los hallazgos más graves. `npm run test`, `npm run lint`, `npm run build` corridos de verdad. No se modificó ni una línea de código.

## Estado de C1–C4 (Fase 2, 2026-07-20)

Los 4 críticos se arreglaron en esta sesión, cada uno con tests de integración
con Prisma real (sqlite descartable, no mocks) que cubren el comportamiento
nuevo. `npm run test` (152/152) y `npm run lint` (mismos 9 errores/11 warnings
preexistentes, ninguno nuevo) quedaron en verde. `npx tsc --noEmit` sin
errores. El build local sigue fallando por el EPERM de Windows ya documentado
abajo (entorno, no código — confirmado sin cambios). Detalle completo de qué
se hizo y qué queda parcial en el resumen de la sesión de Fase 2; acá el
estado resumido de cada hallazgo:

- **C1 — RESUELTO PARCIAL.** Se agregó un backstop de alerta fuerte (no de
  auto-recuperación — ver por qué en `docs/CONFIG-PRODUCCION-PENDIENTE.md`) y
  se persiste `pagoMpPendiente` en sessionStorage + aviso `beforeunload`. Cierra
  el disparador más común (F5 accidental) y convierte el resto de los casos
  (cierre de pestaña, crash) de "se pierde en silencio" a "se detecta y
  alerta", pero no reconstruye la venta sola — eso requeriría una tabla nueva
  (migración contra Neon, fuera de alcance de esta sesión).
- **C4 — RESUELTO.** El polling ya no se cuelga ante un error — queda atrapado,
  logueado y avisado por toast, sin tocar el estado del cobro pendiente.
- **C2 — RESUELTO.** Editar producto ya no pisa `stock`/`stockGramos` salvo que
  el campo se haya tocado de verdad, y en ese caso se enruta como un AJUSTE
  auditado (mismo mecanismo que "Ajustar stock") gateado a ADMIN.
- **C3 — RESUELTO.** `facturacionModoProduccion=true` sin credenciales de
  producción ahora falla fuerte (Comprobante en ERROR, reintentable) en vez de
  degradar a homologación en silencio. **Importante:** ver
  `docs/CONFIG-PRODUCCION-PENDIENTE.md` antes de desplegar — este fix puede
  revelar una configuración ya rota que hoy pasa desapercibida.

---

---

## Resumen ejecutivo

**El núcleo funciona en el día a día, pero no es 100% estable: hay 4 hallazgos críticos con escenarios reales de plata/stock/facturas que se pierden silenciosamente**, no hipotéticos — se verificó cada uno leyendo el código real (líneas citadas abajo).

- **Tests: verde.** 133 tests, 13 archivos, todos pasan. Pero cubren casi exclusivamente lógica pura de dominio (`domain/`) — los 4 servicios transaccionales del núcleo (`venta.service.ts`, `producto.service.ts`, `stock.service.ts`, `facturacion.service.ts`) tienen **cero tests de integración**. El único e2e (`tests/e2e/flujo-venta.spec.ts`) está roto/obsoleto contra la UI actual.
- **Lint: falla de verdad.** 9 errores (no warnings) + 11 warnings. `npm run lint` termina con exit code 1.
- **Build: falla de forma reproducible en este entorno Windows** (`EPERM` al reescribir el binario nativo de `better-sqlite3` dentro de `.next/standalone`, confirmado en 2 corridas). No parece un bug de código — es muy probablemente un problema local de Windows (antivirus/indexador bloqueando el archivo `.node`), no algo que también le pase a Vercel (Linux), pero **hoy no se puede validar un build de producción desde esta máquina**.
- Los 4 críticos, en una frase cada uno:
  1. **Un cobro por Mercado Pago (QR/posnet) puede acreditarse en la cuenta real y nunca convertirse en una venta** si el navegador se recarga/cierra/crashea mientras espera confirmación — no hay backstop de servidor.
  2. **Editar cualquier producto (para cambiarle el nombre, por ejemplo) puede revertir silenciosamente ventas hechas mientras el diálogo estaba abierto**, sin dejar rastro y sin control de rol.
  3. **Facturación AFIP en "modo producción" puede degradar a homologación sin avisar** si faltan las credenciales de producción — CAEs falsos entregados como reales.
  4. (Agravante de #1) El polling de Mercado Pago se puede morir silenciosamente ante cualquier error de red, sin aviso al cajero, deteniendo el único mecanismo que crea la venta.

Ninguno de los 4 requiere una condición de carrera exótica ni doble clic: son el camino normal de uso (recargar la página, editar un producto, un blip de red, un deploy con env var faltante).

---

## Estado por flujo

### 1. Productos + Stock
Funciona para el uso normal. El riesgo real está en **edición de producto vs. venta concurrente**: el form de edición manda el stock completo aunque el usuario solo haya querido cambiar el nombre, pisando cualquier venta ocurrida mientras el diálogo estaba abierto — y lo hace sin el control de rol que sí tiene el flujo dedicado de "Ajustar stock". El oversell por venta normal está bien resuelto (decremento atómico). Aislamiento multi-tenant consistente. Hay dos rutas de alta/edición en paralelo (server actions sin rol ADMIN vs. REST API con `requireAdminApi`) que hoy no chocan porque nada usa la REST API, pero es una trampa para el futuro.

### 2. Vender (POS)
El corazón transaccional (`venta.service.ts`) está bien diseñado: todo dentro de un único `$transaction`, oversell resuelto con `updateMany`+`gte`, idempotencia real por `id` con manejo de colisión `P2002`, IDOR de medios de pago ya cerrado, doble-submit bloqueado en la UI. El problema no está en el registro de la venta en sí, sino en **qué la dispara** cuando el medio de pago es Mercado Pago: ese disparo vive enteramente en el navegador, sin red de seguridad. El test e2e existente no sirve (desactualizado contra la UI real) y no hay test de integración de `venta.service.crear`, pese a ser el archivo más crítico de toda la app (830 líneas).

### 3. Mercado Pago
La firma del webhook está bien implementada (timing-safe de verdad, rechaza sin secret). La cancelación de posnet colgado está resuelta. Pero el diseño de fondo tiene un hueco estructural: **el webhook nunca crea la venta, solo reconcilia una comisión sobre un `Payment` que ya debe existir** — toda la responsabilidad de "crear la venta cuando MP confirma el pago" recae en un store de Zustand sin persistencia, corriendo en la pestaña del navegador. Además hay un IDOR real (no solo teórico) en dos acciones que no filtran por organización, agravado porque todas las organizaciones comparten el mismo `MP_ACCESS_TOKEN`.

### 4. AFIP / Facturación
La idempotencia de emisión es sólida (corte temprano en `EMITIDO`, `upsert` en éxito y error, PDF aislado en un try/catch que nunca puede convertir un CAE ya emitido en error). El riesgo más grave es de configuración, no de lógica de negocio: si `facturacionModoProduccion=true` mira la DB pero el certificado de producción no está cargado (variable de entorno faltante o borrada), el sistema **no falla — emite contra homologación sin decir nada**. Además, la facturación se dispara fire-and-forget sin ninguna garantía de ejecución en el entorno serverless de Vercel, lo que puede dejar ventas sin ningún `Comprobante` (ni `EMITIDO` ni `ERROR`) que el cron de reintento nunca va a encontrar porque busca por `estado: "ERROR"`.

---

## Resultado de test / lint / build

| Chequeo | Resultado | Detalle |
|---|---|---|
| `npm run test` | ✅ Verde | 133 tests, 13 archivos, 4.26s. Todo en `tests/unit/` — dominio puro, no ejercita servicios reales. |
| `npm run lint` | ❌ **Falla (exit 1)** | 9 errores + 11 warnings. Ver detalle abajo. |
| `npm run build` | ❌ **Falla (exit 1), reproducible x2** | `EPERM: operation not permitted, unlink '...\.next\standalone\node_modules\better-sqlite3\build\Release\better_sqlite3.node'`. Sin proceso Node corriendo en paralelo que explique el lock (verificado). Muy probablemente un problema de Windows local (antivirus/indexador reteniendo el `.node`), no necesariamente reproducible en Vercel — pero bloquea validar un build localmente hoy. |

**Errores reales de lint (9, no warnings):**
- `src/app/(dashboard)/productos/productos-client.tsx:150` — `react-hooks/refs`: se escribe `sheetOpenRef.current = sheetOpen` durante el render.
- `src/app/(dashboard)/vender/vender-client.tsx:102` — mismo patrón (`cantidadRef.current = ...` durante el render).
- `src/app/(dashboard)/vender/vender-client.tsx:255` (×2) — `cobroRef.current = {...}` durante el render, además marcado como "This value cannot be modified" (dependencia de un `useEffect`).
- `src/components/pos/carrito-resumen-panel.tsx:166` — `setPagaConCentavos(null)` llamado sincrónicamente dentro de un `useEffect` (`react-hooks/set-state-in-effect`).
- `src/app/(dashboard)/productos/variantes-section.tsx:146` (×4) — comillas sin escapar (`react/no-unescaped-entities`).

Nota: el doc `docs/AUDITORIA-CODIGO-2026-07-16.md` ya había marcado 4 de estos 5 puntos como preexistentes ("regla del React Compiler, no bugs funcionales"). Siguen sin arreglarse 4 días después.

**11 warnings**: mayormente "Compilation Skipped" por `watch()` de `react-hook-form` (limitación conocida de la librería, no accionable) más 3 `exhaustive-deps` reales (`clientes-client.tsx:197`, `proveedores-client.tsx:543`, `producto-form.tsx:173`, `use-carrito-checkout.ts:72`).

**Cobertura real de tests sobre el núcleo:** de los 4 servicios centrales, **ninguno tiene test de integración**:
- `venta.service.ts` (830 líneas) — 0%. `tests/unit/venta.test.ts` reimplementa a mano la aritmética de stock, no ejercita `crear()` real.
- `producto.service.ts` — 0%. Ningún archivo de test.
- `stock.service.ts` — 0% de la ruta transaccional real. `tests/unit/stock.test.ts` testea la fórmula de AJUSTE en el vacío, sin Prisma.
- `facturacion.service.ts` — 0%. Solo `determinarTipoComprobante` (en `fiscal.ts`) tiene test, no el flujo de `facturarVenta`.
- `mp-webhook`, `mp-webhook-firma.ts`, `mercadopago-comisiones.ts`, `use-pago-mp-polling.ts` — 0%.
- `cajaSesion.service.ts` — 0% (y es justo donde hay un hallazgo Alto de concurrencia, ver abajo).
- `tests/e2e/flujo-venta.spec.ts` — el único e2e, roto contra la UI actual (ver hallazgo Alto #6).

---

## Hallazgos, por severidad

### Crítico

**C1 — Un cobro por Mercado Pago puede acreditarse sin que se registre la venta.**
`src/components/pos/use-pago-mp-polling.ts` (todo el archivo) + `src/stores/ventas.store.ts` (sin `persist`, confirmado — solo `import { create } from "zustand"`, sin middleware) + `src/app/api/mp-webhook/route.ts:36-38` + `src/lib/mercadopago-comisiones.ts:17-34`.
El webhook de MP, en la rama no-suscripción, solo llama a `completarComisionReal(dataId)`, que busca un `Payment` que **ya debe existir** (`findFirst({ where: { referencia: orderId } })`) y si no lo encuentra, hace `return` silencioso — **el webhook nunca crea la venta**. Quien la crea es exclusivamente el polling client-side llamando a `crearVentaAction`. Si el navegador se recarga, se cierra la pestaña, se cuelga, o hay un corte de red mientras el cobro está pendiente, ese estado se pierde sin dejar rastro. Si el cliente ya pagó (o paga después), la plata entra a Mercado Pago pero no se descuenta stock, no se registra caja, no queda ningún comprobante — y nada lo detecta: el cron `mp-reconciliar-comisiones` solo actualiza comisión de pagos que ya existen, no busca órdenes MP "pagadas sin venta".

**C2 — Editar un producto pisa el stock con el valor que tenía al abrir el formulario, sin auditoría ni control de rol.**
`src/services/producto.service.ts:283-291` (rama `editar()`, verificado línea por línea) + `src/app/(dashboard)/productos/producto-form.tsx` (schema con `stock` obligatorio, sin gate de `esAdmin` a diferencia de precio/costo) + `src/app/actions/productos.actions.ts:100-111` (`editarProductoAction` no chequea rol).
El `update` hace `stock: input.stock` como SET absoluto (no relativo), sin comparar contra el valor actual y sin crear ningún `StockMovement`. El form precarga ese campo con el stock que había cuando se abrió el diálogo y lo manda siempre, sea cual sea el campo que el usuario realmente quiso cambiar. Si mientras el diálogo de edición está abierto se vende algo por POS (que sí descuenta atómicamente), al guardar el formulario esas ventas se revierten silenciosamente del stock. No hace falta ninguna condición de carrera exótica — es el uso normal. Además esto bypasea el control ADMIN-only que sí tienen `ajusteStockAction` y `POST /api/stock/movimientos` para fijar un stock absoluto: un VENDEDOR puede lograr el mismo efecto desde "Editar producto".

**C3 — Facturación en "modo producción" puede degradar a homologación en silencio si faltan las credenciales.**
`src/lib/providers/facturacion/afip.ts:21-36` (verificado): el flag `production` solo se pasa al SDK de AFIP si `cert && key` están presentes (línea 34). Si `AFIP_CERT`/`AFIP_PRIVATE_KEY` faltan por cualquier motivo (deploy nuevo sin configurar, variable borrada por error), el SDK defaultea `production` a `false` — nadie lo nota. Como el switch homologación/producción vive en `Organization.facturacionModoProduccion` (DB) y no está atado a verificar que las credenciales reales existan, un desalineamiento entre "la organización cree que factura en serio" y "las credenciales que tiene el proceso" resulta en CAEs de homologación (falsos) entregados al cliente como reales, sin ningún error visible.

**C4 (agravante de C1) — El polling de Mercado Pago puede morirse silenciosamente ante cualquier error.**
`src/components/pos/use-pago-mp-polling.ts:42-127` (función `poll()`): el único `try {} finally {}` (líneas 52-106) limpia el flag `enCurso` pero no atrapa la excepción. Si cualquier `await` dentro del try rechaza (corte de red, error inesperado de `crearVentaAction`), la excepción se propaga y el `setTimeout(poll, ...)` de la línea 118 nunca se programa — el polling se detiene para **todos** los cobros MP pendientes de todas las pestañas, sin ningún error visible para el cajero, hasta recargar la página entera (lo cual, por C1, empeora las cosas en vez de arreglarlas).

### Alto

**A1 — IDOR real en dos acciones de Mercado Pago: no filtran por organización.**
`src/app/actions/pagos.actions.ts:63-79` (`consultarEstadoOrdenMpAction`) y `:81-103` (`cancelarOrdenMpAction`) solo verifican que haya sesión, no que el `orderId` recibido pertenezca a la organización del usuario. Como además el `MP_ACCESS_TOKEN` es global (una sola cuenta de MP para todo el SaaS, ver A2), cualquier usuario autenticado que conozca o filtre el `orderId` de otra organización puede consultar o **cancelar** su orden. El patrón correcto sí existe en el mismo archivo (`enviarMontoMpAction`, líneas 29-34, con `findFirst` scoped por `organizationId`) — no se aplicó en las otras dos.

**A2 — Credenciales de Mercado Pago y AFIP compartidas a nivel proceso, no por organización.**
`src/lib/providers/pagos/mercadopago.ts:21` y 3 archivos más usan `process.env.MP_ACCESS_TOKEN` global. Igual patrón en AFIP (`AFIP_CUIT`/`AFIP_CERT`/`AFIP_PRIVATE_KEY` son env vars de proceso, no campos de `Organization` pese a que `Organization.cuit` y `Organization.puntoDeVenta` sí existen como campos por-tenant). Es coherente con el diseño conocido ("dueño único monotributista"), pero es un límite arquitectónico real si el SaaS pretende dar de alta un segundo negocio con cobro/facturación propios — hoy todo el dinero y todas las facturas de cualquier organización pasarían por la misma cuenta de MP y el mismo CUIT.

**A3 — Facturación disparada fire-and-forget, sin garantía de ejecución en Vercel serverless.**
`src/services/venta.service.ts:625-637`: el disparo de `facturacionService.facturarVenta(...)` va en una IIFE async no awaiteada por ningún caller (`ventas.actions.ts:61-71`, `api/ventas/route.ts:132-140`), sin `after()`/`waitUntil` de Next (confirmado por grep: no hay ni un uso en todo `src/`, pese a que Next 16.2.9 lo documenta exactamente para este caso). Si el proceso se corta a mitad del `await emitir()`, no queda ningún `Comprobante` — ni `EMITIDO` ni `ERROR` — porque el `upsert` recién ocurre después. El cron `afip-retry` solo busca `estado: "ERROR"`, así que esa venta nunca entra al reintento automático. Recuperable a mano (el botón "Facturar" aparece igual para ventas sin comprobante), pero depende de que un admin la note.

**A4 — El botón manual "Facturar" no respeta la regla "efectivo nunca factura".**
`src/app/(dashboard)/historial-ventas/historial-ventas-client.tsx:298-311` muestra el botón para cualquier venta sin comprobante que no sea consumo interno, sin excluir las 100% efectivo. La regla sí está forzada en el disparo automático (`venta.service.ts:619-624`) pero `facturacionService.facturarVenta` no la valida — un ADMIN puede emitir con un click un CAE real para una venta en efectivo, que la regla de negocio dice que nunca debería facturarse.

**A5 — `createNextVoucher` de AFIP no es atómico pese a lo que dice el comentario del código.**
`src/lib/providers/facturacion/afip.ts:98-100` afirma que evita el riesgo de dos ventas concurrentes pisando el número de comprobante, pero el SDK (`node_modules/@afipsdk/afip.js/.../ElectronicBilling.js:154-166`) hace dos llamadas separadas (`getLastVoucher` + cálculo local `+1`) — es un TOCTOU clásico. Dos facturaciones concurrentes (ej. el cron de reintento y una venta nueva al mismo tiempo) pueden competir por el mismo número; AFIP rechaza a quien pierde (no genera un CAE inválido), pero produce un `ERROR` evitable que recién se resuelve en el siguiente ciclo del cron.

**A6 — `cajaSesionService` no tiene el fix de idempotencia (`P2002`) que sí tiene `venta.service.ts`.**
`src/services/cajaSesion.service.ts` (`abrirCaja`, `registrarMovimiento`) usa el patrón "leer por id dentro de la transacción, si no existe crear" sin capturar la colisión `P2002` como sí hace `venta.service.ts:585-606`. Dos reintentos simultáneos de la cola offline con el mismo id pueden generar una sesión de caja o un movimiento duplicado, o tirar un error crudo de Prisma. Toda venta pasa por caja, así que aunque el hallazgo original es de `docs/AUDITORIA-CODIGO-2026-07-16.md`, sigue vigente y es parte del camino crítico de Vender.

**A7 — `stock.service.ts`: lectura de "cantidad anterior" fuera (o al borde) de la transacción, en la rama AJUSTE.**
Pesables: `src/services/stock.service.ts:67-93` — `gramosAnterior` se lee **antes** de entrar al `$transaction` (línea 73); cualquier venta concurrente en esa ventana deja el `StockMovement` con un delta incorrecto y queda pisada por el `SET` absoluto del ajuste. No pesables: se relee dentro de la transacción (línea 156) pero sin lock de fila, ventana más chica pero no cerrada. Es un escenario poco frecuente (ajuste manual de ADMIN mientras se vende), pero real y sin ningún test que lo cubra.

**A8 — Validaciones zod duplicadas/muertas y endpoint huérfano en Ventas.**
`src/lib/validations/ventas.ts` y `cobros.ts` son código muerto (cero usos fuera de su propia definición, y desalineados con el modelo actual). `POST /api/ventas` (`src/app/api/ventas/route.ts`, con su propio `CrearVentaSchema` inline, distinto y desalineado del de `ventas.actions.ts`) no tiene ningún consumidor en el POS web actual — es el endpoint del cliente Flutter abandonado (2026-07-08), sigue expuesto y autenticado, superficie viva sin uso real.

**A9 — Superficie de autorización duplicada e inconsistente en Productos.**
Server actions (`productos.actions.ts`, lo que usa el form real) no exigen ADMIN para crear/editar. Las rutas REST (`api/productos/route.ts` POST, `api/productos/[id]/route.ts` PATCH) sí exigen `requireAdminApi`. Hoy no chocan porque nada en la UI llama a esas rutas REST (confirmado por grep), pero es una inconsistencia latente: si algo las empieza a usar, el comportamiento de rol va a ser distinto al del formulario actual.

**A10 — `tests/e2e/flujo-venta.spec.ts` está roto/obsoleto contra el código actual.**
Navega a `/punto-de-venta` (la ruta real es `/vender`), busca un placeholder de hace varias versiones, espera una `<table>` para el carrito (hoy son `motion.div`), exige seleccionar cliente siempre (hoy solo para fiado), y espera navegar a `/ventas/:id` con un `<h1>` de factura (hoy la confirmación es un panel inline). No puede estar pasando contra el código actual — de hecho `vitest run` ni siquiera lo ejecuta (es Playwright, corre aparte con `test:e2e`).

### Medio

**M1 — Falla silenciosa sin log si el email de pago de la suscripción no matchea ningún usuario.** `src/app/api/mp-webhook/route.ts:57-73` — `return` sin loggear si `external_reference` es null y el email no matchea. Una suscripción pagada que nunca activa la organización pasa desapercibida.

**M2 — Sin verificación de frescura del timestamp en la firma del webhook (replay).** `src/lib/mp-webhook-firma.ts:16-24` — el manifest incluye `ts` pero nunca se valida contra una ventana de tiempo razonable, como recomienda MP. Impacto acotado por la idempotencia existente, pero es una desviación de la recomendación de seguridad.

**M3 — Estados de pago no cubiertos explícitamente: `rejected`/`in_process` con orden abierta.** `src/lib/providers/pagos/mercadopago.ts:34-39` solo contempla `pagado` y `finalizadoSinPago`; un pago rechazado con la orden aún `opened` cae en ningún caso y el polling sigue esperando hasta el timeout de 5 minutos sin avisar al cajero que se rechazó.

**M4 — Rutas huérfanas `/productos/nuevo` y `/productos/[id]`.** Existen y funcionan (usan las mismas actions reales) pero nada en la UI navega a ellas — la pantalla real usa un `Dialog` inline. Mismo patrón de "código alcanzable pero sin entrada" que ya se había visto (y cerrado en otro lugar) en la auditoría previa.

**M5 — `importarCSV` sin transacción global.** `src/services/producto.service.ts:629-735` procesa hasta 5000 filas secuencialmente fuera de un `$transaction`. Un crash a mitad de camino deja el catálogo parcialmente importado sin rollback.

**M6 — Manejo de errores inconsistente en algunos GET.** `src/app/api/ventas/route.ts` (función `GET`) y `src/app/api/ventas/traspaso-pendiente/route.ts` (`GET`) sin try/catch, a diferencia del resto de las rutas del núcleo.

**M7 — Mensajes de error de AFIP se guardan y muestran crudos.** `src/services/facturacion.service.ts:134-136` persiste `e.message` tal cual en `Comprobante.error`, sin traducir mensajes técnicos de SOAP/WSAA. Solo lo ve ADMIN, no es fuga de seguridad pero es poco legible.

**M8 — Verificar si la migración `comprobante_pdf` quedó aplicada en Neon.** `docs/AUDITORIA-CODIGO-2026-07-16.md` reportó esta migración commiteada pero no aplicada en producción hace 4 días; commiteada en `264379b`. No se pudo confirmar en esta sesión (`npx prisma migrate status` no logró conectar a Neon desde esta máquina — `P1001`). Dado que hubo varios commits/deploys desde entonces, probablemente ya está resuelto, pero vale confirmarlo antes de asumirlo — si no está aplicada, cada venta facturada falla al generar el PDF (aislado, no rompe el CAE, pero el PDF nunca se genera).

### Bajo

- `prisma/schema.prisma:531-532` — comentario TODO obsoleto sobre `comisionRealCentavos` (ya implementado) y `Payment.referencia` sin `@unique` (protección de idempotencia depende hoy solo de lógica en memoria).
- `src/services/producto.service.ts:261-292` — al alternar `esPesable`, el campo del "otro lado" (`stock` vs `stockGramos`) no se limpia, queda basura sin efecto visible hoy.
- `src/services/facturacion.service.ts:140-164` — `guardarError` hardcodea `tipo: "FACTURA_C"`/`puntoVenta: 0` como placeholders, se sobreescriben en el próximo intento exitoso.
- `prisma/schema.prisma:557` — estado `PENDIENTE` documentado en el comentario pero nunca escrito en ningún lado; mientras dura la llamada a AFIP, el `Comprobante` de esa venta directamente no existe (relacionado con A3).
- `src/services/facturacion.service.ts:56` — un solo ítem "lumped" (`Venta {id}`) reportado a AFIP en vez de las líneas reales; válido hoy porque Factura C no exige el detalle, pero no está preparado si algún día se emite Factura A/B.
- Build local falla por `EPERM` en Windows al reescribir `better_sqlite3.node` — no bloquea Vercel (Linux) pero impide validar un build local hoy.

---

## Qué SÍ funciona bien (para no perder de vista al priorizar)

- Transaccionalidad de `venta.service.crear`: todo (líneas, pagos, stock, caja, cuenta corriente) dentro de un único `$transaction`.
- Oversell resuelto de verdad: decremento atómico `updateMany` + guard `gte` en venta normal, incluidas variantes con dueño compartido.
- Idempotencia de venta por `id`, con manejo correcto de colisión `P2002` en carrera.
- Firma del webhook de Mercado Pago: `crypto.timingSafeEqual` real, rechazo correcto sin secret/firma inválida.
- Cancelación de posnet colgado bien resuelta (timeout y estado sin pago disparan `cancelarOrdenMpAction`).
- Idempotencia de facturación AFIP: corte temprano en `EMITIDO`, `upsert` consistente en éxito y error, generación de PDF aislada en un try/catch que nunca puede convertir un CAE ya emitido en `ERROR`.
- Aislamiento multi-tenant consistente en el ~99% de las queries revisadas en los 4 flujos (con las excepciones puntuales de A1).
- Validación server-side real con zod en las rutas y actions del núcleo (no solo client-side).
- Sanitización de costo/margen para rol VENDEDOR aplicada de forma consistente.
- Doble-submit bloqueado en la UI de venta (botón deshabilitado + guard en atajos de teclado).

---

## Plan de acción priorizado

| # | Severidad | Acción | Impacto | Esfuerzo | Archivos |
|---|---|---|---|---|---|
| 1 | Crítico | ✅ **HECHO (2026-07-20)** Backstop de servidor para pagos MP: que algo en el servidor (webhook o un cron corto) pueda crear la venta si el pago se confirmó y no hay `Sale`, o al menos loguear/alertar una orden MP "pagada sin venta" para que no se pierda en silencio | Evita perder plata cobrada sin registrar | Medio | `mp-webhook/route.ts`, `mercadopago-comisiones.ts`, `venta.service.ts` |
| 2 | Crítico | ✅ **HECHO (2026-07-20)** Persistir el estado `pagoMpPendiente` (sessionStorage) para sobrevivir un refresh, y avisar al cajero antes de recargar con un cobro en curso | Reduce drásticamente la ventana de C1 | Bajo | `ventas.store.ts`, `use-pago-mp-polling.ts` |
| 3 | Crítico | ✅ **HECHO (2026-07-20)** Envolver `poll()` en try/catch para que un error no mate el polling silenciosamente; mostrar error al cajero y reintentar | Cierra C4 | Bajo | `use-pago-mp-polling.ts` |
| 4 | Crítico | ✅ **HECHO (2026-07-20)** No pisar `stock`/`stockGramos` desde "Editar producto" salvo cambio explícito con rol ADMIN y `StockMovement` generado; separar claramente de "Ajustar stock" | Evita revertir ventas silenciosamente | Bajo | `producto.service.ts:261-292`, `producto-form.tsx`, `productos.actions.ts` |
| 5 | Crítico | ✅ **HECHO (2026-07-20)** Abortar (o loguear+alertar fuerte) si `facturacionModoProduccion=true` pero faltan `AFIP_CERT`/`AFIP_PRIVATE_KEY`, en vez de degradar a homologación en silencio | Evita entregar CAEs falsos como reales | Bajo | `afip.ts:21-36` |
| 6 | Alto | Scopear por `organizationId` `consultarEstadoOrdenMpAction` y `cancelarOrdenMpAction` (mismo patrón que ya usa `enviarMontoMpAction`) | Cierra el IDOR real | Bajo | `pagos.actions.ts:63-103` |
| 7 | Alto | Reemplazar el fire-and-forget de facturación por `after()` de Next (o persistir un estado `PENDIENTE` antes de llamar a AFIP) | Evita ventas huérfanas sin comprobante ni error | Medio | `venta.service.ts:625-637`, `facturacion.service.ts` |
| 8 | Alto | Aplicar la regla "efectivo nunca factura" también en el botón manual "Facturar" | Evita CAEs reales indebidos | Bajo | `facturacion.service.ts`, `historial-ventas-client.tsx` |
| 9 | Alto | Replicar el fix `P2002` de `venta.service.ts` en `cajaSesionService` (`abrirCaja`, `registrarMovimiento`) | Cierra duplicados de caja en reintentos concurrentes | Bajo-Medio | `cajaSesion.service.ts` |
| 10 | Alto | Arreglar o borrar `tests/e2e/flujo-venta.spec.ts` (hoy da falsa sensación de cobertura) | Cobertura real vs. aparente | Medio | `tests/e2e/flujo-venta.spec.ts` |
| 11 | Medio | Arreglar los 9 errores reales de eslint (refs durante render, comillas sin escapar) | Build/lint limpio | Bajo | `vender-client.tsx`, `productos-client.tsx`, `carrito-resumen-panel.tsx`, `variantes-section.tsx` |
| 12 | Medio | Sumar tests de integración (Prisma real contra sqlite in-memory o test DB) para `venta.service.crear`, `producto.service.editar`, `stock.service.registrarMovimiento`, `facturacion.service.facturarVenta` | Estos 4 archivos son el núcleo real y hoy tienen 0% de cobertura de integración | Alto | `tests/unit/*` (nuevos) |
| 13 | Medio | Limpiar código muerto: `validations/ventas.ts`, `validations/cobros.ts`, decidir si `POST /api/ventas` se mantiene (Flutter) o se borra, rutas huérfanas `/productos/nuevo` y `/productos/[id]` | Reduce superficie de confusión/riesgo futuro | Bajo | ver A8, A9, M4 |
| 14 | Medio | Investigar el `EPERM` de build local en Windows (excluir el binario nativo de better-sqlite3 del trace de standalone, o exclusión de antivirus) | Poder validar builds localmente antes de pushear | Bajo-Medio | `next.config.*`, `scripts/prepare-standalone.mjs` |
| 15 | Medio | Confirmar con acceso de red que la migración `comprobante_pdf` está aplicada en Neon (`npx prisma migrate status`) | Descartar drift de esquema en producción | Bajo | — (verificación, no código) |
| 16 | Bajo | Resto de hallazgos Bajo (TODO obsoleto, `Payment.referencia` sin unique, limpieza de `esPesable`, placeholders de `guardarError`) | Deuda menor | Bajo | ver sección Bajo |

---

## Qué NO tocar / riesgos de regresión

- **No tocar el mecanismo de decremento atómico de stock** (`updateMany` + guard `gte` en `venta.service.ts:369-438`) — es el punto que resuelve el oversell y ya está verificado correcto para unidades, gramos y variantes con dueño compartido.
- **No tocar la idempotencia de `venta.service.crear`** (paso 0 por `id` + manejo de `P2002`, líneas 84-93 y 579-606) — cualquier cambio ahí puede reabrir duplicados en la cola offline.
- **No tocar `mp-webhook-firma.ts`** sin entender bien `timingSafeEqual` — está correctamente implementado hoy (timing-safe real, con chequeo de longitud previo); un cambio descuidado puede reintroducir una vulnerabilidad de timing.
- **No tocar la idempotencia de `facturacion.service.ts`** (corte temprano en `EMITIDO`, aislamiento del PDF en su propio try/catch) al resolver A3/A5 — el fix de "backstop"/`after()` debe sumarse sin romper esas garantías existentes.
- **Al tocar C2 (edición de producto), cuidado de no romper el flujo legítimo de "Ajustar stock"** (`ajusteStockAction`/`POST /api/stock/movimientos`), que sí debe seguir permitiendo un SET absoluto — el fix es sacar esa capacidad de "Editar producto", no de "Ajustar stock".
- **Al tocar el disparo de facturación (A3), respetar que hoy corre fuera del `$transaction` de la venta a propósito** (es una llamada de red, no debe sostener el lock de la venta) — el fix debe preservar eso, no volver a meterla dentro de la transacción.
- Antes de aplicar cualquier fix de Mercado Pago o AFIP en producción, **coordinar con Bruno**: son sistemas con plata y CUIT reales en juego (paywall real, cuenta de MP real, certificado AFIP de producción).
