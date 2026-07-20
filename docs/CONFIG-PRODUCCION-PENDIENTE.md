# Config pendiente en producción — fixes de C1, C3 y backlog del núcleo

Este documento es para que Bruno lo aplique a mano. Ninguna de las sesiones que
lo fueron completando tocó producción: ni Vercel, ni env vars, ni Neon. Todo lo
de abajo es lo que hace falta revisar/configurar aparte del deploy del código
en sí.

## ⚠️ Acción pendiente más importante ahora mismo: migración de Neon (C1 residual)

La sesión de backlog (2026-07-20) agregó una tabla nueva (`OrdenMpPendiente`,
el snapshot del carrito para el backstop de C1 — ver más abajo) y escribió la
migración a mano, pero **no la aplicó a Neon** (regla dura de esa sesión: nada
de migraciones a Neon sin que vos la confirmes).

**Para aplicarla:**
```
npx prisma migrate deploy
```
(usa `DIRECT_URL`/`DATABASE_URL` de `.env.local`, apunta a Neon real — revisá
el diff en `prisma/migrations/20260720180000_orden_mp_pendiente/migration.sql`
antes de correrlo si querés confirmar qué hace: crea la tabla `OrdenMpPendiente`
con sus foreign keys a `Organization`/`PaymentMethod`/`User`, nada más — no
toca ninguna tabla existente).

Hasta que se aplique, el código nuevo de `enviarMontoMpAction` va a fallar al
intentar `prisma.ordenMpPendiente.create(...)` cada vez que se inicie un cobro
por QR/posnet — **hay que aplicar esta migración ANTES de desplegar el código
de esa sesión a producción**, no después.

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

## C1 — Mercado Pago: ahora recrea la venta sola (backstop real, no solo alerta)

**Actualizado 2026-07-20 (sesión de backlog) — esto reemplaza lo que decía
antes este documento.** Al principio (sesión de Fase 2) el backstop solo podía
*avisar* que una venta se había perdido, porque la orden de MercadoPago no
lleva el detalle del carrito. Ahora `enviarMontoMpAction` persiste un snapshot
del carrito (organización, medio de pago, usuario, líneas, descuento) en la
tabla nueva `OrdenMpPendiente` al crear la orden, y `completarComisionReal`
(`src/lib/mercadopago-comisiones.ts`) lo usa para **recrear la venta de
verdad** — stock descontado, `Payment` creado, todo — cuando detecta que una
orden se pagó pero no existe ningún `Payment` local. Esto requiere la
migración de la sección de arriba.

**No hace falta ninguna variable nueva ni ningún cron nuevo**: esto corre
automáticamente en los dos lugares donde ya se llama a
`completarComisionReal`:
- El webhook `/api/mp-webhook` (tiempo real, apenas MP notifica).
- El cron existente `mp-reconciliar-comisiones` (cada hora, mismo
  `CRON_SECRET` ya configurado — cubre el caso de que el webhook en sí nunca
  haya llegado).

**Si la recreación falla** (ej. se quedó sin stock mientras tanto), cae al
alerta fuerte de siempre (`logError("mp-webhook.orden-pagada-sin-venta", ...)`)
y el snapshot se conserva para poder revisar/reintentar a mano — no se pierde
en silencio en ningún caso.

**Lo que SÍ conviene hacer, cuando haya tiempo (no bloqueante):**

1. **Configurar alertas reales sobre las líneas de log nuevas.** Hoy
   `logError`/`logWarn` solo escriben a `console.error`/`console.warn`
   (capturado por los logs de Vercel, visibles en el dashboard, pero nadie los
   mira en tiempo real). Sin algo que dispare un aviso activo (Vercel Log
   Drain a Slack/email, Sentry, lo que sea), esto sigue siendo "silencioso" en
   la práctica. Sugerido: filtrar por
   `"mp-webhook.orden-pagada-sin-venta"` (fallo real, revisar a mano) y
   `"mp-webhook.orden-recuperada-automaticamente"` (se recuperó sola, pero
   vale la pena que alguien lo note igual — es la señal de que algo en el
   flujo normal está fallando y conviene investigar por qué).
2. El `external_reference` de las órdenes de MP incluye el `organizationId`
   (antes era solo un UUID random) — puramente informativo para triagear más
   rápido, no requiere nada de tu lado.

## Decisión pendiente: `Payment.referencia @unique` (Bajo, no aplicado)

El reporte original sugería agregar `@unique` a `Payment.referencia` como
protección extra de idempotencia (defensa en profundidad — la idempotencia
real ya está cubierta por `id` + `P2002` en `venta.service.ts`, esto sería
solo un extra). **No se aplicó**, por dos motivos encontrados al revisar:

1. El campo está compartido para dos propósitos distintos: el order id de
   MercadoPago (genuinamente único por diseño de MP) y una referencia de
   transferencia bancaria tipeada a mano por el cajero (no necesariamente
   única).
2. Verificado contra Neon (solo lectura): **hoy existen 2 valores duplicados
   reales** — `"1234"` (4 veces) y `"6989"` (2 veces) — que parecen texto
   genérico tipeado por cajeros para transferencias, no ids de MP. Un
   `@unique` liso y llano fallaría al aplicarse contra estos datos, o si se
   fuerza, rompería el flujo de transferencias manuales la próxima vez que un
   cajero repita ese mismo texto.

**Si en algún momento se quiere esta protección de verdad**, la vía correcta
sería un índice único parcial (`CREATE UNIQUE INDEX ... WHERE` scoped a pagos
de MercadoPago específicamente) o separar el campo en dos — no algo para
decidir a la ligera, queda como pendiente de diseño, no de código.

## Nada más pendiente de C2 / C4 / A1 / A4 / A5 / A7 / etc.

El resto de los fixes de esta sesión de backlog (A1, A4, A5, A7, lint, A8, A9,
A10, M2, M3, M5, M6, limpiezas Bajas) son cambios 100% de código, sin ninguna
dependencia de configuración externa ni de Neon — se despliegan igual que
cualquier otro cambio normal, sin nada que aplicar a mano.
