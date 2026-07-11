# Sesión 2026-07-10 — Perfiles con PIN, finanzas del kiosco, y fixes de MercadoPago

Resumen técnico de todo lo agregado/corregido en esta sesión, para referencia futura (propia o de quien retome el proyecto).

## 1. Perfiles con PIN (cambio rápido de usuario en el kiosco)

- **Schema**: `User.pinHash` (String?, PIN de 4 dígitos hasheado con bcrypt), `User.email` ahora nullable (perfiles sin login propio), `Caja.manejaEfectivo` (Boolean, para cajas 100% digitales).
- **Auth**: nuevo provider `"pin"` en `src/auth.ts`, usa `getToken()` (no `auth()`) para leer la sesión activa sin recursión y evitar que se pueda "pinear" hacia otra organización. Lockout compartido con password (`src/lib/verificar-credenciales.ts::verificarPin`, mismo `MAX_INTENTOS_FALLIDOS`/`BLOQUEO_MINUTOS` que login normal).
- **Decisión de seguridad (2026-07-10, revertida a pedido del dueño más tarde en la misma sesión)**: originalmente el switcher y `resetearPin` bloqueaban asignar PIN a cuentas ADMIN (una sesión ADMIN completa protegida por un PIN de 4 dígitos es un riesgo real si cualquiera con acceso físico al kiosco lo sabe). El dueño pidió explícitamente habilitarlo para su propia cuenta por practicidad — ver `usuarioService.listarPerfilesConPin`/`resetearPin` en `src/services/config.service.ts`. El switcher (`src/components/layout/perfil-switcher.tsx`) muestra un badge "Admin" visible para que quede claro qué perfil es cuál.
- **UI**: `PerfilSwitcher` (selector con teclado numérico) accesible desde el drawer de navegación. Gate de cajas de efectivo abiertas: no se puede cambiar de perfil si hay una caja con `manejaEfectivo=true` con sesión abierta (evita perder la trazabilidad del efectivo entre turnos).
- **Config → Usuarios**: toggle "Con login" / "Perfil con PIN" al crear, botón de llave para asignar/resetear PIN en cualquier fila (incluida ADMIN, con advertencia visible en el formulario).

## 2. Cajas — fondo inicial sugerido al reabrir

**Bug real encontrado y corregido**: el formulario de "Abrir caja" siempre arrancaba en $0, sin sugerir lo contado al cerrar la sesión anterior. Causó una pérdida aparente de ~$1,38M del saldo de Mercado Pago cuando esa caja se reabrió sin arrastrar el fondo. Fix: `cajaService.listarActivas` ahora incluye `ultimoCierreCentavos` (lo contado al último cierre) para cajas sin sesión abierta, y `AbrirCajaSheet`/`CajaEstadoBar` lo usan como valor sugerido (editable) en vez de partir de $0.

## 3. Traspaso de cigarrillos — cola sin bloquear

**Problema**: el popup bloqueante de "confirmá el traspaso físico" aparecía aunque no hubiera efectivo en Caja general para hacerlo, forzando a mentir o quedar trabado.
**Fix**: `ventaService.listarTraspasosPendientes` ahora calcula si hay efectivo suficiente en la Caja principal (`efectivoDisponibleCajaPrincipal`, mismo cálculo que el cierre real de caja — solo ventas en efectivo, no digitales) y devuelve `{ pendientes, totalCentavos, bloqueante }`. El gate (`TraspasoCigarrillosGate`) solo bloquea si `bloqueante=true`; si no, muestra un chip flotante no bloqueante ("Traspaso en cola") que se puede cerrar, y el popup bloqueante aparece solo. Cuando entra efectivo suficiente.

## 4. Gastos fijos — vínculo real con pagos + botón "Pagar"

- **Schema**: `MovimientoCaja.fixedExpenseId` (opcional, FK a `FixedExpense`).
- `gastoFijoService.pagar()` crea un EGRESO real en la caja elegida, vinculado al gasto fijo.
- `gastoFijoService.listar()` ahora incluye `pagadoMesActualCentavos` (suma de EGRESOs vinculados dentro del mes).
- `resumenService.mes()` neteé lo pagado del monto presupuestado — sin esto, el efectivo que salió de caja para pagar un gasto fijo se restaba del disponible SIN reducir lo que aún "faltaba pagar", doblando el impacto.
- UI: Config → Gastos Fijos muestra badge Pagado/Pendiente y botón "Pagar" por gasto.

## 5. Cascada financiera ("¿Cómo estamos?") + retiro de ganancia

- **Schema**: `Provider.pisoReposicionCentavos` (colchón fijo en pesos, cargado a mano, NO se resetea mensualmente — distinto del `saldoReposicionCentavos` preexistente, que se acumula solo con las ventas).
- `resumenService.reparto()`: cascada de prioridad — 1) gastos fijos pendientes del mes, 2) piso de reinversión (suma de todos los proveedores con piso > 0), 3) ganancia limpia disponible = lo que sobra.
- `resumenService.retirarGanancia()`: crea un EGRESO real, pero recalcula el reparto en el momento y nunca deja retirar más de lo disponible.
- UI: una sola card en Inicio ("¿Cómo estamos?") fusiona lo que antes eran 3 cards separadas (Equilibrio, Reparto, Panorama) — feedback explícito del dueño: "mucho ruido mental" y "lenguaje humano, no técnico" (2026-07-10). Texto en criollo, sin jerga como "disponible real"/"ganancia neta".
- Config → Proveedores: editor de piso + bloque de contexto (costo del stock actual, precio de venta de ese stock, total facturado del mes de ese proveedor) — sin calcular ganancia, a pedido del dueño ("yo hago la cuenta solo").

## 6. Valor de mercadería

`productoService.valorInventario()` (y variante `resumenProveedores` extendida) calculan el valor del stock activo a costo y a precio de lista, reusando `domain/pesables.ts::valoresInventario` (refactor de `gananciaPotencial` para exponer ambos números por separado). Se suma al efectivo disponible en la card de Inicio para el "patrimonio total".

## 7. Historial de movimientos (Config → Movimientos)

Nueva sección admin-only: lista de ventas/ingresos/egresos/ajustes filtrable por caja y rango de fechas (`cajaSesionService.listarMovimientos`), para que el dueño pueda auditar sin pedir ayuda.

## 8. Revisión de permisos VENDEDOR

Auditoría completa (nav + páginas + API/actions). Dos huecos reales encontrados y corregidos:
- `/api/productos/resumen-proveedores` y `/api/productos/resumen-categorias` estaban abiertas a cualquier sesión y devolvían `gananciaPotencialCentavos` sin sanear — pasadas a `requireAdminApi()`.
- Ver sección 1 sobre el hueco de PIN+ADMIN (que luego se habilitó a pedido explícito, con badge de transparencia).

## 9. MercadoPago — fixes reales encontrados con la API en vivo

Diagnosticado reproduciendo llamadas reales contra la cuenta de producción (MCP de MercadoPago), no adivinando por doc.

- **Saldo de Mercado Pago incorrecto en $7.785,90**: corregido con un ajuste puntual (EGRESO con nota explicando el porqué) en la caja "Ventas QR/Posnet" para que coincida con el saldo real de la cuenta.
- **QR físico no funcionaba**: el medio de pago "QR" apuntaba a un POS huérfano ("Caja 1", sin ningún terminal físico atrás) en vez del QR auto-generado y asociado a una de las dos terminales Point reales. Cada terminal Point tiene su propio POS/QR vinculado automáticamente (`pos_id` distinto al `terminal_id`) — hay que asignarle `external_id` vía `PUT /pos/{id}` para poder apuntarle desde `config.qr.external_pos_id`. Reconfigurado: terminal standalone vuelve a ser 100% manual (no la toca la app), terminal PDV atiende tanto "Posnet" (tarjeta) como "QR" (mismo dispositivo físico, dos medios de pago en el sistema).
- **Cancelar un cobro no liberaba la terminal**: dos bugs apilados en `cancelarOrdenPosnet`/`cancelarOrden` (`src/lib/providers/pagos/mercadopago.ts`):
  1. Faltaba el header `X-Idempotency-Key` en `POST /v1/orders/{id}/cancel` (400 `empty_required_header`).
  2. Una vez que la order ya llegó a la terminal (status `at_terminal`, el caso real — la terminal ya está mostrando "acercar tarjeta"), hace falta además el header `x-allow-cancelable-status: at_terminal`; sin él, MP solo cancela orders en status `created` (409 `cannot_cancel_order`).
  Además, la cancelación de QR estaba deshabilitada a propósito en el código (asumiendo "QR nunca necesita cancelar", válido para un sticker suelto) — pero ahora que QR comparte terminal física con Posnet, sí hace falta cancelar de verdad. Se agregó `cancelarOrdenQr` al provider (mismo endpoint que posnet) y `cancelarOrdenMpAction` ya no salta la cancelación para QR.
- **Webhook de notificaciones fallando 100% con 401** (`MP_WEBHOOK_SECRET` probablemente ausente/desincronizado en producción/Vercel) — no bloquea ventas (solo completa `Payment.comisionRealCentavos` en segundo plano), pendiente de revisar en Vercel.

## Notas operativas

- El kiosco corre standalone (`.next/standalone`, `scripts/start-kiosco-server.mjs`) contra `kiosco.db` (SQLite local, copia filtrada de Neon). Cambios de código requieren `npm run build` + reiniciar ese proceso. Cambios de datos/config se aplicaron directo contra `kiosco.db` y Neon en paralelo (Neon no tenía todavía los datos de hoy — se sincroniza con el backup nocturno de las 21:55).
- Todo el trabajo de esta sesión (y de la sesión anterior sobre cigarrillos/proveedores) sigue sin commitear al momento de escribir esto.
