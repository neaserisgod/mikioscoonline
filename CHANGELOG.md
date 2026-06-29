# Changelog

Todas las versiones notables de este proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/), versionado [SemVer](https://semver.org/) (MAYOR.MENOR.PARCHE).

## [Unreleased]

### Agregado
- **Onboarding wizard**: alta guiada post-login en `/onboarding` (negocio, datos fiscales, categorías, proveedores, ubicaciones, medios de pago, gastos fijos, caja), con skip individual o total. Gateado por `Organization.onboardingCompletadoAt`; re-ejecutable desde Configuración.
- Seed mínimo: ahora crea solo 1 organización + 1 usuario ADMIN (sin datos de demo). Email configurable vía `SEED_ADMIN_EMAIL` (default `admin@kiosco.ar`); password obligatorio vía `SEED_ADMIN_PASSWORD`, sin default.

### Corregido
- Si el `organizationId` de la sesión no existe en la DB (ej. después de un reset), ya no crashea: redirige a `/login`.
- Overflow responsive en la tarjeta de Equilibrio (home) y en los botones de exportar de Reportes en pantallas chicas (375px).

## [1.0.0] — 2026-06-28

Primera versión funcional del sistema de gestión para kiosco/almacén. App rentabilidad-first.

### Incluye
- **Punto de venta (POS)**: búsqueda/escaneo, carrito, medios de pago con comisión, confirmación de venta con descuento de stock.
- **Ventas en paralelo**: varias ventas abiertas a la vez con "venta activa", switcher dentro de Vender.
- **Escáner global y contextual**: vende desde cualquier pantalla; en Productos da de alta o suma stock (configurable).
- **Rentabilidad**: markup y ganancia por proveedor, categoría y heladera. Costo-foto (el costo al momento de la venta).
- **Termómetro (home)**: ganancia neta del día, ventas, y punto de equilibrio del mes.
- **Productos**: alta/edición con triángulo costo–precio–markup, costo provisional, import CSV, código de barras.
- **Cajas múltiples**: apertura/cierre de turno con arqueo, recargo por pago virtual (porcentual o fijo).
- **Configuración**: categorías (con markup default), proveedores, heladeras, medios de pago, gastos fijos, cajas, escáner.
- **Navegación**: menú hamburguesa + pestañas fijas personalizables, PWA instalable, dark mode.
- **Multi-tenant** por organización (base para escalar a SaaS).

### Técnico
- Next.js 16, React 19, TypeScript, Tailwind v4, Prisma 7, NextAuth v5.
- Lógica de dominio testeada (markup, comisiones, equilibrio, flujo de venta).
- Montos en centavos (sin floats).
- Migrado a PostgreSQL (Neon) para producción; SQLite disponible para dev local vía `LOCAL_DEV=1`.

### Pendiente (próximas versiones)
- CRUD completo + usuarios/roles en Configuración.
- Facturación AFIP/ARCA y MercadoPago real: ya existe el scaffold de providers (`src/lib/providers/`) con stubs que tiran error; falta conectar los SDKs.
- Modo offline (v2).
- Hardening multi-tenant (ver `NOTAS-ESCALADO-SAAS.md`).
