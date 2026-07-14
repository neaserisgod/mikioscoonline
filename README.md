# Kiosco El Barrio — Sistema de Gestión

Backend completo para gestión de kiosco/almacén en Argentina.  
Stack: Next.js 16 · Prisma 7 · PostgreSQL · TypeScript · Zod 4 · Vitest

---

## Setup

### 1. Variables de entorno

```bash
cp .env.example .env.local
```

Completar en `.env.local`:

```env
# Neon: https://console.neon.tech
# Supabase: https://app.supabase.com
DATABASE_URL="postgresql://user:pass@host/dbname?sslmode=require"

AUTH_SECRET="$(openssl rand -base64 32)"

# Password del usuario admin que crea el seed. Obligatorio, sin default.
SEED_ADMIN_PASSWORD="algo-fuerte-de-12-o-mas-caracteres"

# Dejar "mock" en desarrollo. Cambiar a "mercadopago" en producción.
PAGOS_PROVIDER="mock"

# Dejar "mock" en desarrollo. Cambiar a "afip" en producción (todavía sin SDK real conectado).
FACTURACION_PROVIDER="mock"
```

Ver `.env.example` para la lista completa de variables (incluye `SEED_ADMIN_EMAIL`, `MP_*`, `AFIP_*`).

### 2. Instalar dependencias

```bash
npm install
```

> **Modo dev local con SQLite** (sin depender de Neon): seteando `LOCAL_DEV=1`, Prisma usa `prisma/schema.dev.prisma` (SQLite) en vez de `prisma/schema.prisma` (PostgreSQL) — ver `prisma.config.ts` y `src/lib/prisma.ts`. Por eso `better-sqlite3` y `@prisma/adapter-better-sqlite3` siguen como dependencias activas, no son código muerto.

### 3. Migraciones (primera vez o DB nueva)

```bash
# Genera el cliente Prisma y crea las tablas en PostgreSQL
npm run db:migrate

# O en producción:
npx prisma migrate deploy
```

### 4. Seed (datos mínimos)

```bash
npm run db:seed
```

Crea únicamente: 1 organización ("Mi negocio", sin onboarding completado) y 1 usuario ADMIN. No carga categorías, proveedores, productos ni ventas de ejemplo — el alta inicial se hace con el wizard de onboarding (`/onboarding`) o a mano desde Configuración.

El script falla si no está seteado `SEED_ADMIN_PASSWORD` (no hay password default por seguridad).

**Credenciales seed:**
- Email: `SEED_ADMIN_EMAIL` si está seteado, sino `admin@kiosco.ar` (rol ADMIN)
- Password: el valor de `SEED_ADMIN_PASSWORD`

### 5. Reset completo

```bash
npm run db:reset   # borra todo y re-aplica seed
```

---

## Tests

```bash
npm run test          # corre todos los tests (Vitest)
npm run test:watch    # modo watch
```

Los tests de dominio son puramente unitarios (sin DB):
- `tests/unit/markup.test.ts` — triángulo costo-precio-markup
- `tests/unit/comisiones.test.ts` — cálculo de comisiones
- `tests/unit/equilibrio.test.ts` — punto de equilibrio mensual
- `tests/unit/venta.test.ts` — flujo de venta (costo-foto, stock, ganancia)

---

## Arquitectura

```
src/
├── domain/          # Funciones puras, sin DB ni framework
│   ├── dinero.ts    # Helpers centavos ↔ display
│   ├── markup.ts    # Triángulo costo-precio-markup
│   ├── comisiones.ts
│   └── equilibrio.ts
│
├── services/        # Lógica de negocio con Prisma (agnóstica de Next.js)
│   ├── producto.service.ts
│   ├── venta.service.ts
│   ├── stock.service.ts
│   ├── rentabilidad.service.ts
│   ├── resumen.service.ts
│   ├── config.service.ts
│   ├── caja.service.ts        # Alta/edición de cajas (admin)
│   └── cajaSesion.service.ts  # Apertura/cierre de turno, arqueo
│
├── lib/
│   ├── prisma.ts              # Singleton PrismaClient (Postgres o SQLite según DATABASE_URL)
│   └── providers/
│       ├── pagos/              # PAGOS_PROVIDER: "mock" (dev) | "mercadopago" (stub, falta SDK)
│       │   ├── types.ts
│       │   ├── mock.ts
│       │   ├── mercadopago.ts
│       │   └── index.ts        # getPagosProvider()
│       └── facturacion/        # FACTURACION_PROVIDER: "mock" (dev) | "afip" (stub, falta SDK)
│           ├── types.ts
│           ├── mock.ts
│           ├── afip.ts
│           └── index.ts        # getFacturacionProvider()
│
├── components/
│   ├── ui/            # Primitivas (shadcn-style)
│   ├── pos/           # Carrito, overlay y switcher de venta activa
│   ├── productos/     # Formulario de alta/edición
│   ├── clientes/      # Formulario de cliente
│   ├── dashboard/     # KPI cards, gráfico de ventas
│   ├── layout/        # Nav drawer, tabs-bar, bottom-nav, top-bar, theme-toggle
│   ├── scanner/       # Montaje del escáner global (cámara)
│   └── providers/     # Query (react-query), session (NextAuth), theme, service worker
│
├── stores/          # Estado cliente (zustand) — ventas en paralelo, etc.
│
└── app/
    ├── (auth)/login/
    ├── (onboarding)/onboarding/   # Wizard post-signup; gateado por organization.onboardingCompletadoAt
    ├── (dashboard)/               # Home (termómetro), vender, productos, rentabilidad, reportes, config
    ├── api/                       # Route Handlers — solo lectura (GET)
    │   ├── productos/             # incluye /[id], /codigo/[barcode], /importar (POST)
    │   ├── ventas/
    │   ├── rentabilidad/
    │   ├── resumen/
    │   ├── reportes/              # /dashboard, /exportar/ventas, /exportar/stock
    │   ├── cajas/                 # incluye /[cajaId]/sesion
    │   ├── stock/movimientos/
    │   ├── config/                # categorias, proveedores, ubicaciones, medios-pago,
    │   │                          # gastos-fijos, cajas, negocio, usuarios, backup
    │   └── auth/[...nextauth]/
    └── actions/                   # Server Actions — mutaciones
        ├── productos.actions.ts
        ├── ventas.actions.ts
        ├── stock.actions.ts
        ├── config.actions.ts
        ├── caja.actions.ts        # Alta/edición/baja de cajas (ADMIN)
        ├── cajaSesion.actions.ts  # Abrir/cerrar turno, movimientos de ingreso/egreso
        └── onboarding.actions.ts  # Pasos del wizard (negocio, fiscal, categorías, etc.)
```

---

## Convenciones del dominio

| Concepto | Valor |
|----------|-------|
| **Montos** | Siempre en **centavos** (`Int`). $10,00 = `1000`. Sin float. |
| **Porcentajes** | En **basis points** (`Int`). 70% = `7000`. 3.99% = `399`. |
| **Costo-foto** | `SaleLine.costoUnitarioCentavos` y `precioUnitarioCentavos` son inmutables post-venta. La rentabilidad histórica usa estos, nunca el costo actual. |
| **Multi-tenant** | Toda entidad principal lleva `organizationId`. Toda query lo filtra. |

---

## API Reference

### Lectura (GET)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/productos` | Lista productos. `?q=texto` busca por nombre/sku/barcode. `?stockBajo=1` filtra alertas. |
| `GET /api/productos/:id` | Producto con categoría, proveedor y ubicación. |
| `GET /api/productos/codigo/:barcode` | Busca un producto por código de barras (escáner). |
| `GET /api/productos/importar` | — (POST para importar CSV) |
| `GET /api/ventas` | Lista ventas. `?desde=&hasta=&limit=` |
| `GET /api/ventas/:id` | Venta con líneas y pagos. |
| `GET /api/rentabilidad` | Agrega rentabilidad. `?por=categoria|proveedor|heladera&desde=&hasta=` |
| `GET /api/resumen` | Termómetro hoy + equilibrio del mes. `?mes=YYYY-MM` para mes anterior. |
| `GET /api/reportes/dashboard` | KPIs y gráfico de ventas para el dashboard de reportes. |
| `GET /api/reportes/exportar/ventas` | Exporta ventas (CSV). |
| `GET /api/reportes/exportar/stock` | Exporta stock (CSV). |
| `GET /api/cajas` | Lista cajas de la organización. |
| `GET /api/cajas/:cajaId/sesion` | Sesión de caja abierta (si existe) para esa caja. |
| `GET /api/stock/movimientos` | Historial de movimientos de stock. `?productId=` filtra por producto. |
| `GET /api/config/categorias` | — |
| `GET /api/config/proveedores` | — |
| `GET /api/config/ubicaciones` | — |
| `GET /api/config/medios-pago` | — |
| `GET /api/config/gastos-fijos` | — |
| `GET /api/config/cajas` | — |
| `GET /api/config/negocio` | Datos fiscales/de negocio de la organización. |
| `GET /api/config/usuarios` | Usuarios de la organización (solo ADMIN). |
| `GET /api/config/backup` | Exporta un backup de los datos de la organización. |

### Mutaciones (Server Actions)

Importar desde `@/app/actions/...` en Server Components o Client Components con `"use server"`.

```ts
// Productos
crearProductoAction(input)
editarProductoAction(id, input)
actualizarCostoAction({ id, costoCentavos })
desactivarProductoAction(id)
importarProductosCSVAction(csvString)

// Ventas
crearVentaAction({ lineas: [{productId, cantidad}], pagos: [{paymentMethodId, montoCentavos}] })

// Stock
entradaStockAction({ productId, cantidad, motivo? })
ajusteStockAction({ productId, stockNuevo, motivo? })

// Cajas (alta/edición solo ADMIN)
crearCajaAction({ nombre, recargoTipo?, recargoVirtualBp?, recargoVirtualFijoCentavos? })
editarCajaAction(id, input)
desactivarCajaAction(id)

// Sesión de caja (cualquier usuario autenticado)
abrirCajaAction(cajaId, { fondoInicialCentavos })
cerrarCajaAction(cajaSesionId, { efectivoContadoCentavos, nota? })
// + movimientos de INGRESO/EGRESO sobre la sesión abierta

// Onboarding (wizard post-signup, multi-paso, con skip individual o total)
// pasos: negocio, datos fiscales, categorías, proveedores, ubicaciones, medios de pago, gastos fijos, caja

// Config (solo ADMIN)
crearCategoriaAction({ nombre, markupDefaultBp })
crearProveedorAction({ nombre })
crearUbicacionAction({ nombre })
crearMedioPagoAction({ nombre, comisionBp, esMercadoPago? })
crearGastoFijoAction({ nombre, montoMensualCentavos, mesAnio? })
actualizarMontoGastoFijoAction(id, montoCentavos, mesAnio?)
```

---

## Importación masiva de productos (CSV)

```
POST /api/productos/importar   Content-Type: text/plain
```

Formato del CSV (header obligatorio):

```csv
sku,nombre,costo,precio,categoria,proveedor,heladera,barcode
CIG-001,Marlboro x20,4000,4200,Cigarrillos,Philip Morris,,7790387000014
GAS-001,Coca-Cola 500ml,800,1120,Gaseosas y Aguas,Coca-Cola FEMSA,Heladera,7790580558025
```

- `costo` y `precio` en **pesos** (no centavos). El sistema convierte internamente.
- Si no se provee `costo`, se estima con el markup default de la categoría (`costoEsProvisional = true`).
- Categorías, proveedores y heladeras se crean automáticamente si no existen.

---

## Integración MercadoPago (TODO)

El switch por entorno ya existe en `src/lib/providers/pagos/` (`getPagosProvider()`), pero `MercadoPagoProvider` (`mercadopago.ts`) es un **stub que tira error** — falta conectar el SDK real.

1. `npm install mercadopago`.
2. Completar `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` en `.env.local`.
3. Cambiar `PAGOS_PROVIDER="mercadopago"`.
4. Implementar `MercadoPagoProvider.crearLinkPago()` en `mercadopago.ts` con el SDK oficial.
5. Crear el endpoint de webhook (ej. `/api/cobros/mp-webhook`) y, al confirmar el pago, completar `Payment.comisionRealCentavos`.

## Integración AFIP/ARCA

Implementada y en uso en producción (`src/lib/providers/facturacion/`, `AfipFacturacionProvider` en `afip.ts` con `@afipsdk/afip.js`).

- **Credenciales** (`AFIP_ACCESS_TOKEN`, `AFIP_CUIT`, `AFIP_CERT`/`AFIP_PRIVATE_KEY` en base64) van por variable de entorno — `FACTURACION_PROVIDER="afip"` activa el provider real (`"mock"` para desarrollo). Sin `AFIP_CERT`/`AFIP_PRIVATE_KEY`, usa el CUIT de prueba de AfipSDK (`20409378472`) sin certificado.
- **El switch homologación/producción NO es una env var** — es `Organization.facturacionModoProduccion` (por organización, en Config > Negocio de la app), porque con certificado propio cargado la elección de ambiente es una decisión de negocio, no de deploy.
- **Disparo:** `ventaService.crear()` llama a `facturacionService.facturarVenta()` en segundo plano (no bloquea la venta) cuando algún medio de pago usado tiene `PaymentMethod.facturarAutomaticamente = true`. El resultado (CAE, número, estado) se guarda en el modelo `Comprobante`, visible en `/historial-ventas/[id]` (con el QR de verificación de AFIP, RG 4291), reintentable manualmente desde ahí o desde el listado si quedó en `ERROR`, y reintentado solo cada 15 min por el cron `/api/cron/afip-retry` (ver [Cron jobs](#cron-jobs-vercel-cron)) — así una caída transitoria de AFIP no deja facturas pendientes hasta que alguien las note.
- **Impresión en posnet** (`src/lib/mercadopago-print.ts`, `impresionService`): si `Organization.imprimirTicketPosnet` está activo, cada venta manda un tiquet con ítems/total/recargo y, si ya hay CAE, los datos fiscales + QR, a la terminal Point marcada como posnet — vía `POST /terminals/v1/actions` de MercadoPago (independiente de cualquier cobro). Ver el comentario en `mercadopago-print.ts` sobre el comportamiento no documentado del tag `{left}` (alinea a la derecha, no a la izquierda) verificado a mano contra una terminal Newland N950 real.
- Mapeos hardcodeados en `afip.ts` a verificar contra la tabla oficial de ARCA si se agregan más casos: tipos de comprobante (A/B/C), condición de IVA del receptor, alícuotas de IVA.
- **Pendiente de confirmar con un contador:** si hace falta agregar el domicilio comercial del negocio (hoy no existe ese campo en ningún lado de la app) y si la entrega impresa del comprobante es obligatoria o alcanza con la emisión electrónica.

## Cron jobs (Vercel Cron)

Definidos en `vercel.json`, corren sobre TODAS las organizaciones del SaaS (no hay nada por-tenant acá). Cada endpoint en `src/app/api/cron/*` valida el header `Authorization: Bearer $CRON_SECRET` que Vercel agrega automáticamente a cada invocación cuando la env var `CRON_SECRET` está seteada en el proyecto — hay que cargarla en Vercel (Settings > Environment Variables), generada con `openssl rand -base64 32`.

- **`/api/cron/afip-retry`** (cada 15 min): reintenta comprobantes en `Comprobante.estado = "ERROR"` (más de 10 min desde el último intento) llamando de nuevo a `facturacionService.facturarVenta()` — idempotente, no vuelve a pedir CAE si ya está `EMITIDO`.
- **`/api/cron/mp-reconciliar-comisiones`** (cada hora): completa `Payment.comisionRealCentavos` para cobros de MercadoPago cuyo webhook (`/api/mp-webhook`) nunca llegó — solo mira pagos de entre 30 min y 7 días de antigüedad. Reutiliza `completarComisionReal()` de `src/lib/mercadopago-comisiones.ts`, la misma función que usa el webhook.

**Ojo con el plan de Vercel:** en el plan Hobby, los cron jobs solo pueden correr como máximo una vez por día — las frecuencias de arriba (`*/15 * * * *` y `0 * * * *`) necesitan plan Pro o superior. Si el proyecto está en Hobby, Vercel va a rechazar el deploy con estos schedules; hay que bajarlos a `0 3 * * *` (una vez al día) o pasar a Pro.
