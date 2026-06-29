# Changelog

Todas las versiones notables de este proyecto se documentan acá.
Formato basado en [Keep a Changelog](https://keepachangelog.com/), versionado [SemVer](https://semver.org/) (MAYOR.MENOR.PARCHE).

## [1.0.0] — 2026-06-29

Primera versión funcional del sistema de gestión para kiosco/almacén. App rentabilidad-first.

### Incluye
- **Punto de venta (POS)**: búsqueda/escaneo, carrito, medios de pago con comisión, confirmación de venta con descuento de stock.
- **Ventas en paralelo**: varias ventas abiertas a la vez con "venta activa", switcher dentro de Vender.
- **Escáner global y contextual**: vende desde cualquier pantalla; en Productos da de alta o suma stock (configurable).
- **Rentabilidad**: markup y ganancia por proveedor, categoría y heladera. Costo-foto (el costo al momento de la venta).
- **Termómetro (home)**: ganancia neta del día, ventas, y punto de equilibrio del mes.
- **Productos**: alta/edición con triángulo costo–precio–markup, costo provisional, import CSV, código de barras.
- **Configuración**: categorías (con markup default), proveedores, heladeras, medios de pago, gastos fijos, escáner.
- **Navegación**: menú hamburguesa + pestañas fijas personalizables, PWA instalable, dark mode.
- **Multi-tenant** por organización (base para escalar a SaaS).

### Técnico
- Next.js 16, React 19, TypeScript, Tailwind v4, Prisma 7, NextAuth v5.
- Lógica de dominio testeada (markup, comisiones, equilibrio, flujo de venta).
- Montos en centavos (sin floats).

### Pendiente (próximas versiones)
- Migración a PostgreSQL + deploy en la nube (ver `Guia_Deploy`).
- Cajas múltiples con apertura/cierre y arqueo; recargo por pago virtual; montos fijos en markup/recargo.
- CRUD completo + usuarios/roles en Configuración.
- Facturación AFIP/ARCA, MercadoPago real, offline (v2).
- Hardening multi-tenant (ver `NOTAS-ESCALADO-SAAS.md`).
