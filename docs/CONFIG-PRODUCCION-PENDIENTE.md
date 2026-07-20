# Config pendiente en producción — fixes de C1 y C3

Este documento es solo para que Bruno lo aplique a mano. Esta sesión **no tocó
producción**: ni Vercel, ni env vars, ni Neon. Todo lo de abajo es lo que hace
falta revisar/configurar aparte del deploy del código en sí.

## C3 — AFIP: importante revisar ANTES de respirar tranquilo tras el deploy

El fix de C3 (`src/lib/providers/facturacion/afip.ts`) hace que
`facturacionModoProduccion=true` sin `AFIP_CERT`/`AFIP_PRIVATE_KEY` cargadas en
el entorno **ahora falle fuerte** (el `Comprobante` queda en `ERROR`, visible
en `/historial-ventas` y reintentado por el cron `afip-retry`) en vez de
degradar en silencio a homologación como hacía antes.

**Antes de asumir que esto no cambia nada en producción, verificá que las 4
variables de entorno de AFIP estén cargadas de verdad en Vercel producción:**
`AFIP_CUIT`, `AFIP_ACCESS_TOKEN`, `AFIP_CERT`, `AFIP_PRIVATE_KEY`.

- Si ya están las 4 cargadas (lo esperable, según la memoria de la sesión del
  2026-07-13 que documentó la puesta en producción): este fix no cambia el
  comportamiento actual, solo agrega la protección para el futuro (un deploy
  nuevo, una variable borrada por error, etc.).
- Si **faltara** alguna de `AFIP_CERT`/`AFIP_PRIVATE_KEY` en este momento (por
  ejemplo, si el switch `facturacionModoProduccion` está en `true` pero en
  algún momento se rotaron/borraron las credenciales): después de este deploy,
  la facturación automática con medios no-efectivo va a empezar a fallar de
  forma visible (ERROR en vez de emitir en homologación como venía haciendo
  hasta ahora sin que nadie lo notara). Esto es la intención del fix, pero
  conviene saberlo de antemano y no como sorpresa.

No hace falta ninguna migración ni cambio de variable para este fix — es
puramente defensivo. Solo hace falta **confirmar el estado actual de esas 4
variables** antes/después de desplegar.

## C1 — Mercado Pago: alertas nuevas, sin cambios de config obligatorios

El backstop de C1 (`src/lib/mercadopago-comisiones.ts`) agrega un
`logError("mp-webhook.orden-pagada-sin-venta", ...)` cuando MercadoPago
confirma que una orden se pagó pero no existe ningún `Payment` local para
esa referencia — la señal de que el flujo normal (polling del navegador) no
llegó a crear la venta.

**No hace falta ninguna variable nueva ni ningún cron nuevo**: esta alerta
corre automáticamente en los dos lugares donde ya se llama a
`completarComisionReal`:
- El webhook `/api/mp-webhook` (tiempo real, apenas MP notifica).
- El cron existente `mp-reconciliar-comisiones` (cada hora, mismo
  `CRON_SECRET` ya configurado — cubre el caso de que el webhook en sí nunca
  haya llegado).

**Lo que SÍ conviene hacer, cuando haya tiempo (no bloqueante):**

1. **Configurar alertas reales sobre esa línea de log.** Hoy `logError` solo
   escribe a `console.error` (capturado por los logs de Vercel, visibles en el
   dashboard, pero nadie los mira en tiempo real). Sin algo que dispare un
   aviso activo (Vercel Log Drain a Slack/email, Sentry, lo que sea), esta
   alerta sigue siendo "silenciosa" en la práctica — solo se vuelve útil si
   alguien la busca a mano. Sugerido: filtrar por el string
   `"mp-webhook.orden-pagada-sin-venta"` en el sistema de logging/alertas que
   se elija.
2. **Residual conocido, no resuelto esta sesión:** el backstop actual solo
   puede *avisar* que una venta se perdió — no puede recrearla, porque la
   orden de MercadoPago no lleva el detalle del carrito (solo el monto total,
   ver gotcha ya documentado en la memoria de integración MP: "items[].total_amount
   no es válido"). Para que el sistema pudiera reconstruir la venta sola
   haría falta persistir un snapshot del carrito al crear la orden — eso es un
   cambio de schema (tabla nueva) que esta sesión **no hizo a propósito**,
   porque hubiera requerido correr una migración contra Neon, algo
   explícitamente fuera de alcance acá. Si se decide encarar esto en el
   futuro, es la vía para cerrar el hallazgo del todo (hoy queda "detectado y
   alertable", no "autorecuperable").
3. El `external_reference` de las órdenes de MP ahora incluye el
   `organizationId` (antes era solo un UUID random) — puramente informativo
   para que la alerta de arriba sea más fácil de triagear, no requiere nada
   de tu lado.

## Nada más pendiente de C2 / C4

C2 (edición de producto) y C4 (polling no se cuelga) son cambios 100% de
código, sin ninguna dependencia de configuración externa — se despliegan
igual que cualquier otro cambio normal.
