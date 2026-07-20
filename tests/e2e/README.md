# e2e (Playwright) — vacío a propósito

`flujo-venta.spec.ts` se borró en la tanda de backlog de 2026-07-20
(hallazgo A10, `docs/REPORTE-NUCLEO.md`): estaba roto contra la UI actual en
cada paso (navegaba a `/punto-de-venta`, la ruta real es `/vender`; buscaba
un placeholder e input de hace varias versiones; esperaba un `<table>` para
el carrito, hoy son `motion.div`; exigía cliente para toda venta, hoy solo
para fiado; esperaba redirección a `/ventas/:id` con un `<h1>` de factura,
hoy la confirmación es un panel inline en el mismo POS) y con credenciales
de login (`admin@mipyme.com.ar`/`admin123`) que no existen en el seed
actual. `vitest run` nunca lo ejecuta (Playwright corre aparte con
`npm run test:e2e`), así que daba falsa sensación de cobertura sin fallar
nunca la suite normal.

**Antes de escribir uno nuevo, revisar `playwright.config.ts`:** el
`webServer` corre `npm run dev:local` (LOCAL_DEV=1 + sqlite local) a
propósito — nunca cambiarlo a `npm run dev` a secas, porque sin `LOCAL_DEV`
`DATABASE_URL` cae en `.env.local`, que apunta a **Neon producción real**
(y con `facturacionModoProduccion=true`, a una factura AFIP real y no
anulable).

Para escribir un e2e real del flujo de venta hace falta, como mínimo:
1. Seed dedicado para e2e contra `dev.db` (org, usuario admin con contraseña
   conocida, un producto con stock, caja abierta, medio de pago efectivo) —
   hoy `prisma/seed.ts` no necesariamente deja ese estado listo para test.
2. Selectores contra la UI real: `/vender`, el input con
   `data-pos-search-input` (ver `vender-client.tsx`), las líneas del carrito
   como `motion.div` (ver `carrito-items-list.tsx`), y la confirmación
   inline en `carrito-resumen-panel.tsx` (no una navegación a otra URL).
3. Correrlo de verdad con `npm run test:e2e` y confirmar que pasa antes de
   commitear — no volver a dejar un spec sin verificar.
