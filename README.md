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

# Dejar "mock" en desarrollo. Cambiar a "mercadopago" en producción.
PAGOS_PROVIDER="mock"
```

### 2. Instalar dependencias

```bash
npm install
```

> **Paquetes SQLite ya no usados** (pueden desinstalarse):  
> `npm uninstall @prisma/adapter-better-sqlite3 better-sqlite3 @types/better-sqlite3`

### 3. Migraciones (primera vez o DB nueva)

```bash
# Genera el cliente Prisma y crea las tablas en PostgreSQL
npm run db:migrate

# O en producción:
npx prisma migrate deploy
```

### 4. Seed (datos de ejemplo)

```bash
npm run db:seed
```

Crea: organización "Kiosco El Barrio", 2 usuarios, 6 categorías, 4 proveedores, 2 ubicaciones, 3 medios de pago, 4 gastos fijos y 20 productos con ventas de ejemplo.

**Credenciales seed:**
- `admin@kiosco.ar` / `admin123` (ADMIN)
- `vendedor@kiosco.ar` / `vendedor123` (VENDEDOR)

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
│   └── config.service.ts
│
├── lib/
│   ├── prisma.ts          # Singleton PrismaClient
│   └── pagos/
│       ├── pagos.interface.ts  # Interface PagosProvider
│       └── mp.mock.ts          # Mock MercadoPago (dev)
│
└── app/
    ├── api/               # Route Handlers — solo lectura (GET)
    │   ├── productos/
    │   ├── ventas/
    │   ├── rentabilidad/
    │   ├── resumen/
    │   └── config/
    └── actions/           # Server Actions — mutaciones
        ├── productos.actions.ts
        ├── ventas.actions.ts
        ├── stock.actions.ts
        └── config.actions.ts
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
| `GET /api/productos/importar` | — (POST para importar CSV) |
| `GET /api/ventas` | Lista ventas. `?desde=&hasta=&limit=` |
| `GET /api/ventas/:id` | Venta con líneas y pagos. |
| `GET /api/rentabilidad` | Agrega rentabilidad. `?por=categoria|proveedor|heladera&desde=&hasta=` |
| `GET /api/resumen` | Termómetro hoy + equilibrio del mes. `?mes=YYYY-MM` para mes anterior. |
| `GET /api/config/categorias` | — |
| `GET /api/config/proveedores` | — |
| `GET /api/config/ubicaciones` | — |
| `GET /api/config/medios-pago` | — |
| `GET /api/config/gastos-fijos` | — |

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

1. Completar `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` en `.env`.
2. Cambiar `PAGOS_PROVIDER="mercadopago"` en `.env`.
3. Crear `src/lib/pagos/mp.adapter.ts` implementando `PagosProvider`.
4. Al recibir webhook de pago, completar `Payment.comisionRealCentavos`.

## Integración AFIP/ARCA (TODO)

Variables documentadas en `.env.example`.  
Requiere certificado digital de AFIP y la implementación de la capa fiscal.
