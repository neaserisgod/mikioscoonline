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

Mismo patrón en `src/lib/providers/facturacion/` (`getFacturacionProvider()`). `AfipFacturacionProvider` (`afip.ts`) ya está implementado con `@afipsdk/afip.js` y probado contra homologación (CAE real obtenido con el CUIT de prueba `20409378472`) — falta únicamente conectarlo a un flujo real de venta (todavía no hay ningún caller de `getFacturacionProvider()` en la app) y, para producción, el certificado digital propio.

- **Homologación (ya funciona):** con `AFIP_ACCESS_TOKEN` (gratis en https://app.afipsdk.com) y `AFIP_CUIT=20409378472` alcanza — no hace falta certificado.
- **Producción:** CUIT real + certificado de https://auth.afip.gob.ar/ codificado en base64 en `AFIP_CERT`/`AFIP_PRIVATE_KEY`, y `AFIP_ENVIRONMENT="production"`.
- Cambiar `FACTURACION_PROVIDER="afip"` para activar el provider real (usa `"mock"` mientras tanto).
- Mapeos hardcodeados en `afip.ts` a verificar contra la tabla oficial de ARCA si se agregan más casos: tipos de comprobante (A/B/C), condición de IVA del receptor, alícuotas de IVA.
- Pendiente: decidir en qué punto del flujo de venta se dispara `emitir()`, y qué hacer con el `cae`/`caeFechaVencimiento` resultante (guardarlo en la `Sale`, mostrarlo/imprimirlo).
