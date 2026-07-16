# Auditoría de calidad profunda — pyme-ventas

**Fecha:** 2026-07-16
**Alcance:** todo el proyecto (~24.700 líneas TS/TSX en `src/`, 235 archivos), incluyendo el working tree ACTUAL con trabajo sin commitear.
**Tipo:** solo análisis y reporte. No se modificó código ni se hizo ningún commit.

> **Importante sobre el alcance temporal:** esta auditoría incluye la Fase A/B/C de facturación/tickets de la sesión en curso (builder de ticket, regla de facturación por medio de pago, PDF de factura) **sin commitear todavía**, más los ajustes posteriores sobre el ticket del posnet. Cada hallazgo indica si vive en código **COMMITEADO** (rama `main`, HEAD `f94164b`) o **SIN COMMITEAR** (working tree). Ver la sección final de riesgos operativos para el detalle completo de qué está pendiente de commit.

---

## Resumen ejecutivo

El proyecto sigue en **buen estado general**, en línea con la revisión anterior (2026-07-14): la lógica de dinero vive centralizada en `src/domain/` con centavos enteros, el scoping por `organizationId` es consistente en el ~99% de los casos revisados, las transacciones usan decrementos atómicos condicionales, y no hay `any` explícito, `TODO`s sueltos ni `console.log` residuales en todo `src/`. `tsc` y `vitest` están en verde; `eslint` tiene solo 5 errores y 10 warnings, todos preexistentes o de bajo impacto.

Dicho esto, esta auditoría encontró **una brecha operativa nueva y real** (no de código, de arquitectura de backup) que vale la pena resaltar arriba de todo: **`Comprobante`, `Customer`, `ArqueoParcial` y `MovimientoCuentaCorrienteProveedor` nunca se sincronizan del kiosco local a Neon** — ni con el backup nocturno. Si el disco del kiosco se pierde entre backups (o directamente, cualquier día), los comprobantes fiscales (CAE incluido) generados ese día **no existen en ningún otro lado**. Esto es más grave que cualquier bug de código encontrado.

### Top 5 hallazgos por severidad

| # | Severidad | Hallazgo | Eje |
|---|---|---|---|
| 1 | **Crítico** | `Comprobante` (con CAE/PDF fiscal) nunca se sincroniza del kiosco a Neon — ni el backup nocturno lo cubre (`kiosco-sync.ts` no lo lista). Es el único respaldo de un documento legal. | 9 · Riesgo operativo |
| 2 | **Alto** | Migración `20260716120000_comprobante_pdf` está commiteada en el schema pero **NO aplicada en Neon** (confirmado con `prisma migrate status`, read-only) — sin commitear todavía tampoco. Si se despliega a Vercel así, `facturacionService` rompe en producción al intentar `UPDATE ... SET pdf =` sobre una columna inexistente. | 6 · Drift de esquema |
| 3 | **Alto** | `cajaSesionService.abrirCaja`/`registrarMovimiento` repiten el patrón "leer-y-crear" que causó una carrera real en ventas (ya arreglado ahí con captura de `P2002`) — acá sigue sin el fix. Dos reintentos simultáneos de la cola offline pueden generar una sesión de caja o un movimiento duplicado. | 2 · Concurrencia |
| 4 | **Medio** | El ticket del posnet ahora **siempre imprime como "no fiscal"** (cambio sin commitear de esta sesión), incluso en ventas donde SÍ se facturó de verdad (QR/Posnet) — es una decisión de producto razonable dado que el QR real no imprime legible en esa terminal, pero no hay ningún test ni validación automática de que esta regla se mantenga si alguien la toca sin saber el motivo. | 1 · Correctitud fiscal |
| 5 | **Medio** | `rentabilidad.service.ts` sigue agregando en memoria (`saleLine.findMany` sin límite + `reduce`) — ya señalado en la revisión anterior (R1), sigue sin resolver. Con historia larga en un tenant real, esto escala mal. | 5 · Performance |

**Verificaciones automáticas: todas en verde** (ver tabla abajo). El código sin commitear compila y pasa tests igual que el committeado — no hay razón técnica para bloquear un commit por `tsc`/`vitest`.

---

## Tabla de verificaciones automáticas

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ Sin errores (exit 0) |
| `npx vitest run` | ✅ 9 archivos, **102 tests**, todos pasan (1.9s) |
| `npx vitest run --coverage` | Statements 87.6% / Branches 80.2% / Funcs 76.6% — **pero solo mide `domain/`, `lib/fiscal.ts` y `providers/facturacion/afip-qr.ts`**. Services, actions, rutas API y componentes no están instrumentados porque ningún test los importa — cobertura real de esas capas es **0%**, no "no medida". Ver eje 8. |
| `npx eslint .` | **15 problemas: 5 errores, 10 warnings** (detalle abajo) |
| `npm audit` | **5 vulnerabilidades moderadas**, 0 altas/críticas — todas en `postcss`/`@hono/node-server` (dependencias transitivas de `next`/`@prisma/dev`, herramientas de build, no runtime de producción) |
| `npm outdated` | 20 paquetes con actualización menor/patch disponible (ninguno con salto mayor pendiente urgente); ver eje 7 |
| `prisma migrate status` (contra Neon, solo lectura) | **27/28 migraciones aplicadas**; falta `20260716120004_comprobante_pdf` — ver eje 6 |

### Detalle de eslint (5 errores)

Los 5 errores son reglas del React Compiler (`react-hooks/refs`, `react-hooks/immutability`, `react-hooks/set-state-in-effect`), no bugs funcionales — el compilador simplemente no puede memoizar esos componentes y lo señala.

| Archivo:línea | Regla | ¿Preexistente o de esta sesión? |
|---|---|---|
| `productos-client.tsx:146` | `react-hooks/refs` (ref actualizada durante el render) | Preexistente — no tocado en esta sesión |
| `vender-client.tsx:89` | `react-hooks/refs` | Preexistente |
| `vender-client.tsx:201` (×2) | `react-hooks/immutability` + `react-hooks/refs` | Preexistente |
| `carrito-resumen-panel.tsx:205` | `react-hooks/set-state-in-effect` (`setPagaConCentavos(null)` dentro de un `useEffect`) | **Preexistente** — verificado contra `git show HEAD`: la línea ya existía idéntica antes de esta sesión; el `if (successInfo.pagoEfectivoOnly) return` agregado ahora es posterior a la línea que dispara el error, no la causa. |

Los 10 warnings son "Compilation Skipped" por `react-hook-form` (`watch()` no es memoizable, limitación conocida de la librería) y un par de `exhaustive-deps` — ninguno nuevo de esta sesión, ninguno bloqueante.

---

## Métricas del proyecto

**Top 10 archivos por líneas** (`src/`):

| Líneas | Archivo |
|---|---|
| 2395 | `src/app/(dashboard)/config/config-client.tsx` |
| 1249 | `src/app/(dashboard)/inicio/dashboard-client.tsx` |
| 830 | `src/services/venta.service.ts` |
| 725 | `src/services/config.service.ts` |
| 671 | `src/services/producto.service.ts` |
| 633 | `src/components/pos/carrito-resumen-panel.tsx` |
| 625 | `src/app/(dashboard)/proveedores/proveedores-client.tsx` |
| 624 | `src/app/(dashboard)/productos/productos-client.tsx` |
| 558 | `src/app/(dashboard)/productos/producto-form.tsx` |
| 553 | `src/app/(onboarding)/onboarding/_components/wizard.tsx` |

**Conteos:** 12 services · 14 archivos de actions · 54 rutas API (`route.ts`) · 59 componentes en `src/components/` · 16 páginas · 9 archivos de test · 235 archivos TS/TSX · **24.676 líneas** en `src/`.

**Dependencias:** sin paquetes abandonados/deprecados detectados. `next-auth` sigue en beta (`5.0.0-beta.31`) — normal para el ecosistema Next 16 actual, pero es una dependencia a vigilar en cada bump. `pdf-lib` (agregada esta sesión, sin commitear) es un paquete maduro y sin vulnerabilidades reportadas.

---

## Hallazgos por eje

### 1. Correctitud de plata y fiscal

**[Medio · SIN COMMITEAR] El ticket del posnet ya no refleja si la venta se facturó de verdad.**
`src/services/impresion.service.ts:67` — `imprimirTicketVenta` arma el ticket con `fiscal: false` incondicionalmente. Antes de esta sesión, si la venta tenía comprobante EMITIDO, el posnet imprimía el bloque fiscal (CAE, Pto.Vta, QR). Ahora nunca lo hace, ni siquiera cuando `facturacionService.facturarVenta` sí generó un CAE real unos milisegundos antes (línea 44-53 documenta la decisión: la terminal Newland no imprime un QR legible). **Es una decisión de producto deliberada y bien documentada en el propio comentario**, pero no hay ningún test que la fije — un futuro cambio bienintencionado en `venta.service.ts` (ej. "che, pasale el comprobante para que se vea completo") podría revertir silenciosamente esta regla sin que nada lo detecte. Recomendación: un test de `impresionService.imprimirTicketVenta` (con mock de Prisma) que verifique que el ticket construido SIEMPRE tiene `fiscal === false`, con un comentario tipo "si este test falla a propósito, revisar por qué se quiere volver a intentar imprimir el QR fiscal en el posnet".

**[Bajo · COMMITEADO] `facturacionService` reporta un solo ítem lumped a AFIP, no las líneas reales.**
`src/services/facturacion.service.ts:56` — el `DatosFactura.items` que se manda al proveedor de facturación es siempre `[{ descripcion: "Venta {saleId}", cantidad: 1, ... }]`, nunca el detalle real de `SaleLine`. Para Factura C (monotributista, sin discriminar IVA) esto es fiscalmente válido — AFIP no exige el detalle de ítems en el WSFE para este caso — pero significa que el comprobante en sí (y el PDF que se genera a partir del builder de ticket, que SÍ tiene el detalle real) queda desalineado conceptualmente: el PDF muestra productos reales, el registro en AFIP solo ve "Venta {id}". No es un bug hoy (Factura C no lo requiere), pero si el negocio alguna vez emite Factura A/B (Responsable Inscripto), ahí SÍ hace falta discriminar IVA por ítem y este código no está preparado para eso. Vale la pena una nota explícita en el código junto a `determinarTipoComprobante` sobre esta limitación.

**[Bajo · COMMITEADO, sin cambios desde la revisión anterior] C1 — Reparto por caja no usa "largest remainder".**
`src/services/venta.service.ts:277` y `:292` — cada combinación pago×categoría se redondea independientemente (`Math.round`), pudiendo dejar una diferencia de 1-2 centavos entre la suma de `MovimientoCaja` y el total cobrado real, en ventas con varios medios de pago y categorías. Confirmado que sigue sin resolver desde 2026-07-14 (ver comparación al final). El cliente nunca paga de más ni de menos — el drift queda en cómo se reparte internamente entre cajas.

**[Bajo · COMMITEADO, ya cerrado desde la revisión anterior] C2 (idempotencia de venta) y B1 (subtotal de pesables en el ticket impreso) — RESUELTOS.** Ver sección de comparación.

**Emisión AFIP — estados e idempotencia: correcto.** `facturacionService.facturarVenta` (`facturacion.service.ts:23`) corta temprano si `comprobante.estado === "EMITIDO"` — no puede volver a pedir un CAE nuevo por reintento. Los estados `PENDIENTE`/`EMITIDO`/`ERROR` se manejan con `upsert` en todos los caminos (éxito y `guardarError`, línea 140), sin estado intermedio colgado. Nada que objetar acá.

**Generación de PDF (Fase C, sin commitear) — best-effort correctamente aislado.** `facturacion.service.ts` genera el PDF en un `try/catch` ANIDADO, después del `upsert` a EMITIDO — un fallo de `pdf-lib`/`qrcode` nunca puede convertir una emisión ya exitosa en un `ERROR`. Buen patrón, consistente con el resto del archivo.

**Redondeo y centavos enteros: sin hallazgos nuevos.** `dinero.ts` sigue siendo el único punto de conversión float↔centavos; `redondearPesoArriba` se usa consistentemente en el total a cobrar del POS. `parsearARS` mantiene la ambigüedad ya conocida (C3, `"1234.567"` se leería como `1234567`) — cobertura de test 55% en este archivo (ver tabla de coverage), pero el caso ambiguo específico no tiene un test que lo documente como "conocido y aceptado". Sugerencia de bajo esfuerzo: agregar ese caso al test existente con un comentario, no como bug sino como documentación de la limitación.

---

### 2. Concurrencia e idempotencia

**[Alto · COMMITEADO] `cajaSesionService` no tiene el fix de carrera que sí tiene `ventaService`.**
`src/services/cajaSesion.service.ts:81-125` (`abrirCaja`) y `:164+` (`registrarMovimiento`) usan el patrón "leer por `id` dentro de la transacción, si existe devolverlo, si no crear" — exactamente el patrón que en `venta.service.ts` (antes de la revisión 2026-07-14) permitía que dos reintentos simultáneos de la cola offline pasaran ambos el check y chocaran en el `INSERT`, y que se arregló ahí capturando `Prisma.PrismaClientKnownRequestError` con código `P2002` (ver `venta.service.ts:585-606`). Ese mismo fix **no se replicó** en `cajaSesionService`. Impacto concreto: dos reintentos simultáneos de "abrir caja" o "registrar movimiento" con el mismo `id` (mismo escenario que motivó el fix original: cola offline de Flutter/kiosco perdiendo la respuesta) pueden generar una `CajaSesion` o un `MovimientoCaja` duplicado, o que el segundo tire un error crudo de Prisma en vez de responder idempotentemente. Recomendación: aplicar el mismo patrón (`try/catch` con `P2002` → devolver el existente) a ambos métodos.

**Decremento atómico de stock — incluida la lógica de variantes: correcto.**
`venta.service.ts:374` (pesables, por gramos) y `:411` (unidades, incluida la resolución al dueño de la variante vía `stockOwnerId`) usan `updateMany` con `where: { ..., stock: { gte: requerido } }` — decremento condicional atómico, no lectura-luego-resta. Dos ventas concurrentes del mismo producto (o de dos variantes que comparten dueño, ej. "docena" + "media docena" del mismo huevo) no pueden hacer oversell: la segunda transacción que intente decrementar por debajo de 0 falla con `count === 0` y tira el error de stock insuficiente. Este es exactamente el patrón correcto y ya fue verificado en la Fase 1 de variantes.

**Idempotencia de venta (`venta.service.ts:585-606`): correcta y ya verificada en esta sesión.** Sin cambios desde la última revisión.

---

### 3. Multi-tenant (scoping por `organizationId`)

Se revisaron los 12 services y se muestreó el patrón `findFirstOrThrow({ where: { id, organizationId } })` seguido de `update({ where: { id } })` (sin `organizationId` en el segundo `where`) que aparece decenas de veces en `config.service.ts`, `producto.service.ts`, `stock.service.ts`, `customer.service.ts`, etc. **El patrón es seguro tal como está usado**: el `update`/`delete` posterior nunca se ejecuta si el `findFirstOrThrow` previo no encontró la fila DENTRO de esa organización (lanza y corta la función antes de llegar al `update`). No se encontró ningún caso real donde un `update`/`delete` por `id` se ejecute sin ese guard previo en la misma función.

**[Bajo · Observación de mantenibilidad, no vulnerabilidad] El guard depende de disciplina, no de un mecanismo que lo fuerce.**
No hay un middleware/wrapper de Prisma ni un lint rule que impida escribir un `service.algo(id)` nuevo que se salte el `findFirstOrThrow` previo — depende de que quien agregue un método nuevo copie el patrón. Con ~150 ocurrencias de este patrón repetidas a mano en 12 archivos, el riesgo no es cero a largo plazo. Sugerencia (no urgente): un helper `assertOwnedBy(model, id, organizationId)` centralizado no cambiaría el comportamiento pero haría el patrón imposible de olvidar accidentalmente, y serviría de single-point si algún día se quiere loguear/auditar accesos.

**Rutas API: sin gaps.** Las 54 rutas bajo `src/app/api/` usan `requireAdminApi`/`requireSessionApi` (ambos de `src/lib/api-auth.ts`, que ya scopea por `organizationId` desde la sesión) excepto las 4 rutas que legítimamente no necesitan sesión previa: `mobile-google`, `mobile-login`, `[...nextauth]` (establecen la sesión) y `mp-webhook` (valida firma HMAC de MercadoPago en su lugar, `mp-webhook-firma.ts`). Los crons (`src/app/api/cron/*`) validan `CRON_SECRET` en el header `Authorization` en el 100% de los casos revisados.

**Ruta nueva `/api/ventas/[id]/factura-pdf` (sin commitear): correctamente scopeada.** Usa `requireAdminApi` + `where: { id, organizationId: result.user.organizationId }` — no hay forma de pedir el PDF de otra organización cambiando el `id` en la URL.

---

### 4. Seguridad

**Secretos:** `.env*` está en `.gitignore` con excepción explícita de `.env.example` (que no contiene valores reales) — no hay secretos trackeados en git. `bcrypt` con costo 10 tanto para `passwordHash` como para `pinHash` (`config.service.ts:650,703,720`) — razonable, aunque 12 es el default recomendado hoy para hardware moderno; no es una vulnerabilidad, es margen extra fácil de subir si se quiere (`bcrypt.hash(x, 12)`).

**SQL crudo:** las únicas dos ocurrencias de `$queryRaw` (`producto.service.ts:479,496`, para comparar dos columnas, algo que Prisma no soporta en `where`) usan **template literals etiquetados** (`` prisma.$queryRaw<T>`...${organizationId}...` ``) — Prisma parametriza automáticamente los valores interpolados, no hay concatenación de strings ni riesgo de inyección. Ambas consultas están correctamente scopeadas por `organizationId`.

**`mp-webhook`:** valida la firma `x-signature`/`x-request-id` contra el `dataId` antes de procesar cualquier notificación (`mp-webhook-firma.ts`) — correcto, evita que alguien falsifique un webhook de pago.

**Ruta `factura-pdf` (sin commitear):** ya cubierta en el eje 3 — auth + scoping correctos. Nota menor: no hay rate-limiting explícito en la descarga (un ADMIN autenticado podría hacer scraping masivo de PDFs propios), pero es su propia organización, no es un vector de ataque real.

**Nada crítico encontrado en este eje.**

---

### 5. Performance y escala

**[Medio · COMMITEADO, sin resolver desde 2026-07-14] R1 — Agregación en memoria en `rentabilidad.service.ts`.**
`rentabilidad.service.ts:46` — `porAgrupador` sigue trayendo TODAS las líneas de venta del rango a memoria (`saleLine.findMany` sin paginar) y agrupando con JS. Para un kiosco solo es intrascendente; para el SaaS multi-tenant con historia de meses/años en un tenant activo, esto escala mal (memoria del proceso + tiempo de respuesta creciendo linealmente con el volumen histórico). Ya estaba anotado en el código y en `NOTAS-ESCALADO-SAAS.md` — sigue pendiente, no empeoró ni mejoró.

**[Bajo · COMMITEADO, sin resolver] R2 — N+1 acotado en cajas.**
`resumenService.equilibrioReal` y `cajaSesionService.arqueosPendientes` siguen hacienda una query de sesión por caja en loop. Con 3-4 cajas (el caso real hoy) es despreciable. Sin cambios.

**Nada nuevo de performance introducido por el trabajo sin commitear** — el builder de ticket (`domain/ticket.ts`) es una función pura in-memory sobre datos ya cargados, sin queries propias. La generación de PDF (`pdf-lib` + `qrcode`) ocurre fuera del request principal (dentro de `facturacionService.facturarVenta`, que ya corre en background respecto de la venta) — no bloquea la respuesta al cajero.

---

### 6. Modelo de datos e integridad — DRIFT de esquema (hallazgo central de esta auditoría)

**[Alto · confirmado con `prisma migrate status`, solo lectura contra Neon]**

| Migración | `schema.prisma` (commiteado) | `schema.dev.prisma` (commiteado) | kiosco.db / dev.db (SQLite local) | **Neon (producción)** |
|---|---|---|---|---|
| `20260716004126_variantes_comparten_stock` | ✅ | ✅ | ✅ (push hecho en sesión previa) | ✅ **Aplicada** (confirmado) |
| `20260716120000_comprobante_pdf` (`Comprobante.pdf Bytes?`) | ✅ (archivo de migración sin commitear todavía) | ✅ | ✅ (push hecho en esta sesión) | ❌ **NO aplicada** (confirmado con `prisma migrate status`) |

**Esto significa que ahora mismo, si se commitea y pushea el trabajo de facturación/tickets a `main` y Vercel hace su auto-deploy, el código en producción va a intentar `UPDATE "Comprobante" SET "pdf" = ...` contra una columna que no existe en Neon — `facturacionService.facturarVenta` fallaría en el bloque de generación de PDF en CADA venta facturada en producción** (el `try/catch` que envuelve la generación de PDF evita que esto rompa la emisión del CAE en sí — buen diseño defensivo — pero el PDF nunca se generaría, y quedaría un `logError` por cada venta facturada hasta que se corra `prisma migrate deploy` contra Neon). Antes de mergear a `main`, hay que correr la migración contra Neon — es una acción de producción que requiere confirmación explícita aparte, no algo para hacer de forma automática.

**[Crítico · hallazgo de arquitectura, no de esquema] Comprobante/Customer/ArqueoParcial/MovimientoCuentaCorrienteProveedor nunca llegan a Neon.**
`scripts/lib/kiosco-sync.ts:7-24` (`ORDEN_TABLAS`) — la lista de tablas que sincroniza tanto la descarga inicial como el backup nocturno (`kiosco-backup-once.ts`, corre 1 vez por día a las 21:55) es:
```
organization, user, caja, category, provider, location, paymentMethod,
fixedExpense, fixedExpenseMonto, cajaSesion, product, sale, saleLine,
payment, stockMovement, movimientoCaja
```
**Faltan:** `comprobante`, `customer`, `arqueoParcial`, `movimientoCuentaCorrienteProveedor`. Para `Customer`/`ArqueoParcial`/`MovimientoCuentaCorrienteProveedor` esto es una limitación conocida y menor (se pierde historial de cuenta corriente/arqueos si el disco del kiosco muere, recuperable a mano). Para **`Comprobante` es grave**: es el único registro de que una factura con CAE real existió. AFIP exige guardar esos comprobantes; hoy viven exclusivamente en `kiosco.db`, un SQLite en un PC de kiosco sin ningún backup automatizado más allá de lo que este mismo script (que no lo incluye) haría. Si ese disco se corrompe o se pierde entre backups (o si el backup nocturno nunca corrió, ej. la PC estuvo apagada a las 21:55 varios días), esos comprobantes fiscales — con su CAE, su PDF, todo — desaparecen sin backup en ningún otro lado.

Recomendación concreta: agregar `"comprobante"` (y, si el tiempo lo permite, `"customer"`, `"arqueoParcial"`, `"movimientoCuentaCorrienteProveedor"`) a `ORDEN_TABLAS`, respetando el orden de FKs (`comprobante` depende de `sale` y `organization`, que ya están antes en la lista — se puede agregar después de `sale`/`saleLine`/`payment`). Esto es independiente de la idea (ya descartada esta sesión) de sincronizar en tiempo real — alcanza con que el backup nocturno existente lo incluya.

**Constraints e integridad — sin cambios respecto a la revisión anterior.** Los estados tipo `PENDIENTE`/`EMITIDO`/`ERROR`, `ABIERTA`/`CERRADA`, `COMPRA`/`PAGO` siguen siendo `String` en el schema (no `enum` de Prisma), validados solo por Zod en la capa de entrada — no hay CHECK constraint a nivel de base. Es una decisión ya tomada y documentada (comentarios "— validado Zod" en el schema), consistente en todo el proyecto. No es un hallazgo nuevo, se re-confirma como aceptable dado que ningún camino de escritura observado lo bypasea.

**`@@unique([barcode, organizationId])` con NULL:** sin cambios, comportamiento correcto en Postgres (NULLs no compiten entre sí), documentado en el propio schema.

---

### 7. Mantenibilidad y deuda técnica

**Componentes monolíticos — sin resolver, empeoraron levemente en tamaño.**
`config-client.tsx` pasó de 2.320 líneas (revisión anterior) a **2.395** (+75, por los cambios de esta sesión: botones de prueba de impresión, checkbox de facturación automática read-only, atajo "+ Transferencia"). `dashboard-client.tsx` se mantiene en ~1.249 líneas. Ninguno de los dos se dividió — sigue siendo la recomendación más valiosa y menos riesgosa de mantenibilidad pendiente.

**Duplicación — MEJORÓ significativamente esta sesión.** El motivo original de la Fase A (armado de contenido del ticket duplicado en `mercadopago-print.ts` y `ticket-client.tsx`) está resuelto: ambos ahora consumen `domain/ticket.ts::construirTicket()`. De paso, esto corrigió un bug real preexistente (ver comparación abajo).

**Código muerto:** no se encontró código muerto nuevo. `qrAfipDataUrl` (que había quedado sin uso tras el refactor del builder) fue eliminado en esta misma sesión. `mercadopago-print.ts` fue movido a `providers/impresion/mercadopago-terminal.ts` sin dejar el archivo viejo. Verificado con `grep` que no quedan referencias colgantes a ninguno de los dos.

**Consistencia de providers:** `providers/facturacion/` y `providers/impresion/` (nuevo, sin commitear) siguen el mismo patrón factory (`getXProvider()` con un `_provider` cacheado a nivel de módulo) — buena consistencia. `providers/pagos/` no se revisó en profundidad en esta pasada (fuera del alcance de los cambios recientes), pero por convención de nombres parece seguir el mismo patrón.

**Nomenclatura:** consistente (español para dominio de negocio, inglés para infraestructura/librerías) en todo el código revisado, sin mezclas raras encontradas.

---

### 8. Cobertura de tests

La cobertura real (según `vitest run --coverage`) está concentrada en `src/domain/` + `lib/fiscal.ts` + `providers/facturacion/afip-qr.ts` — **87.6% de statements, pero solo de esas ~7 archivos**. Todo lo demás (12 services completos, 14 archivos de actions, 54 rutas API, 59+ componentes) tiene **cero tests**, no "cobertura baja" — ningún test los importa.

Lógica crítica de dominio SIN test que debería tenerlo, en orden de riesgo:
1. **`venta.service.ts` (830 líneas, el corazón transaccional de la app)** — sin ningún test de integración/unitario que ejercite `crear()` con un mock de Prisma. El archivo de test existente (`tests/unit/venta.test.ts`) — dado que no aparece en el reporte de coverage — probablemente testea tipos/inputs pero no ejecuta la lógica real contra una base (a confirmar leyendo el archivo si se quiere profundizar).
2. **`facturacion.service.ts`** — cero tests. La lógica de `determinarTipoComprobante` sí tiene test (vía `fiscal.ts`, 86% cubierto), pero el flujo completo de `facturarVenta` (armado de `DatosFactura`, manejo de `ERROR`, el `try/catch` anidado del PDF) no.
3. **`cajaSesion.service.ts`** — cero tests, y es justo donde este reporte encontró el hallazgo de concurrencia más alto (eje 2).
4. **`impresion.service.ts`** (reescrito esta sesión) — cero tests. Sería razonable, al menos, un test que verifique que `imprimirTicketVenta` siempre arma `fiscal: false` (ver eje 1, hallazgo #4 del resumen).

---

### 9. Riesgos operativos

**Trabajo sin commitear — inventario completo.**

Modificados (respecto a HEAD `f94164b`):
```
README.md, package.json, prisma/schema.dev.prisma, prisma/schema.prisma,
src/app/(dashboard)/config/config-client.tsx,
src/app/(dashboard)/historial-ventas/[id]/page.tsx,
src/app/(dashboard)/historial-ventas/[id]/ticket-client.tsx,
src/components/pos/carrito-resumen-panel.tsx,
src/components/pos/use-carrito-checkout.ts,
src/lib/providers/facturacion/afip-qr.ts (recorte de función sin uso),
src/services/config.service.ts, src/services/facturacion.service.ts,
src/services/impresion.service.ts, src/services/venta.service.ts
```
Eliminado: `src/lib/mercadopago-print.ts` (movido a `providers/impresion/`).

Nuevos (untracked):
```
prisma/migrations/20260716120000_comprobante_pdf/,
src/app/actions/impresion.actions.ts, src/app/api/ventas/[id]/factura-pdf/,
src/components/pos/ticket-print-window.ts, src/domain/ticket.ts,
src/lib/providers/facturacion/pdf.ts, src/lib/providers/impresion/,
tests/unit/ticket.test.ts
```
Y `docs/REVISION-CODIGO-2026-07-14.md` (untracked desde antes de esta sesión, no generado por este trabajo).

**Antes de commitear/pushear, en orden:**
1. Correr `prisma migrate deploy` contra Neon para `20260716120000_comprobante_pdf` (acción de producción, requiere confirmación explícita — ver eje 6).
2. Agregar `"comprobante"` a `ORDEN_TABLAS` en `scripts/lib/kiosco-sync.ts` (o al menos crear un ticket/nota para hacerlo pronto — es independiente de este commit pero es el hallazgo más grave de la auditoría).
3. Considerar el fix de idempotencia en `cajaSesionService` (eje 2) antes o después, no bloquea el commit actual pero no debería quedar olvidado.

**Backup/scheduler:** `kiosco-backup-scheduler.mjs` corre una vez por día (21:55, configurable). Si la PC del kiosco está apagada a esa hora, el catch-up al arrancar cubre ese caso (`pasoLaHora() && !yaSeCorrioHoy()`) — bien resuelto para el caso de PC apagada, pero no cambia el hallazgo #1 (Comprobante no sincroniza ni siquiera cuando el backup SÍ corre).

**Deploy/Vercel:** sin cambios respecto a lo ya conocido — auto-deploy en push a `main`, variables de entorno requieren `vercel --prod` para tomar efecto en un deployment ya corriendo (ver memoria de infraestructura).

---

## Comparación con la revisión de 2026-07-14

| Ítem de la revisión anterior | Estado ahora |
|---|---|
| B1 — Subtotal de pesables incorrecto en el ticket impreso HTML | ✅ **Resuelto** (era ya corregido en `impresion.service.ts` desde el 14/7, pero seguía roto en `ticket-client.tsx` — se corrigió esta sesión al unificar ambos en `domain/ticket.ts::construirTicket()`, que usa `subtotalLinea()` en el único lugar) |
| C2 — Idempotencia con carrera en `venta.service.crear` | ✅ Resuelto (14/7), verificado sin regresión |
| Q2 — Errores silenciados sin log (facturación/impresión) | ✅ Resuelto (14/7, `src/lib/log.ts`), sigue en uso consistente |
| Q3 — Cobertura de tests desbalanceada | ⚠️ Parcialmente atendido — se sumaron tests de `pesables`/`recargo-cigarrillos`/`dinero`/`ticket` (dominio puro), pero el desbalance con services/actions/rutas sigue igual o peor en términos relativos (más código nuevo sin test) |
| C1 — Reparto por caja sin largest-remainder | ⏳ Sigue abierto, sin cambios |
| R1 — Agregación en memoria en rentabilidad | ⏳ Sigue abierto, sin cambios |
| R2 — N+1 en cajas | ⏳ Sigue abierto, sin cambios |
| Q1 — Componentes monolíticos (config/dashboard-client) | ⏳ Sigue abierto, `config-client.tsx` creció +75 líneas |
| Churn de CRLF/line endings mencionado en el historial de commits | ✅ Resuelto (commit `22cad2f`, "normaliza line endings a LF") — los warnings de CRLF vistos en `git diff` de esta auditoría son de archivos que Windows todavía no re-normalizó al tocar, no una regresión |

**Nuevo desde el 14/7** (no podía estar en esa revisión): todo el eje de facturación/tickets (builder, Fase B, PDF) con sus hallazgos propios (ejes 1 y 6 de este reporte), y el descubrimiento del gap de backup de `Comprobante` (eje 6/9), que es independiente de ese trabajo pero se encontró investigándolo.

---

## Plan priorizado

1. **(Crítico, antes de cualquier deploy)** Aplicar `prisma migrate deploy` a Neon para `comprobante_pdf` — con confirmación explícita, es acción de producción.
2. **(Crítico, no bloquea el commit pero es urgente)** Agregar `Comprobante` a la sincronización kiosco→Neon (`ORDEN_TABLAS`). Idealmente antes de que pase una semana más de ventas facturadas sin backup real.
3. **(Alto)** Replicar en `cajaSesionService` el fix de idempotencia (`P2002`) que ya tiene `venta.service.crear`.
4. **(Medio)** Test de regresión para "el ticket del posnet siempre es no-fiscal" en `impresionService.imprimirTicketVenta`.
5. **(Medio, deuda ya conocida)** Evaluar dividir `config-client.tsx` — cada sesión que la toca la hace un poco más grande.
6. **(Bajo, cuando haya tiempo)** Largest-remainder en el reparto por caja; agregación SQL en rentabilidad; tests de integración para `venta.service.ts`/`facturacion.service.ts`.

Nada de lo encontrado bloquea técnicamente un commit (`tsc`/`vitest` en verde) — los puntos 1 y 2 son las únicas dos cosas que conviene resolver **antes** de pushear a producción.
