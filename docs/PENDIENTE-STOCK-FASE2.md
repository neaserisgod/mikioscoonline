# Variantes que comparten stock — Fase 2 (COMPLETA)

> Fase 1 (modelo + lógica de stock) y Fase 2 (UI + ajustes) ya están
> implementadas. Este documento se deja vacío a propósito — no queda trabajo
> pendiente de esta iniciativa.

## Resumen de lo implementado (Fase 1 + Fase 2)

- `Product.variantOfId` (self-relación al dueño del stock) y
  `unidadesPorVenta` (factor) en Neon **y** en `prisma/schema.dev.prisma`
  (paridad de esquema con el kiosco local ya resuelta).
- `venta.service.ts` valida y descuenta stock contra el dueño
  (`stockOwnerId = variantOfId ?? id`), acumulando el requerido por dueño.
- `producto.service.ts`: `validarVariante` (factor ≥ 1, sin pesables, sin
  cadenas, sin autoreferencia, no convertir en variante un producto que ya
  tiene variantes propias); listados/búsquedas (`listar`, `buscar`,
  `listarFiltrado`, `resumenProveedores`, `resumenCategorias`, `stockBajo`,
  `stockBajoPorProveedor`) filtran a solo dueños (`variantOfId: null`);
  `desactivar` desactiva en cascada las variantes de un dueño.
- `stock.service.ts`: ENTRADA aplica el factor `unidadesPorVenta` (recibir
  "5 docenas" = 60 unidades base); AJUSTE **no** aplica el factor — opera
  directo en unidades base del dueño, porque un ajuste corrige contra un
  conteo físico ya expresado en esas unidades.
- `rentabilidad.service.ts`: nuevo agrupador `"producto"` que atribuye cada
  línea de venta de una variante a su dueño (`variantOfId ?? productId`);
  los agrupadores existentes (proveedor/categoría/heladera) ya sumaban bien
  porque las variantes heredan esos campos del dueño al crearse.
- UI Productos: sección "Variantes" en la edición del dueño (alta/edición/baja).
- UI POS: selector de variante al elegir un producto con variantes; el
  escaneo de código de barras de una variante puntual sigue agregándola
  directo (sin pasar por el selector).
- UI Rentabilidad: tab "Por producto".
- Tests: `tests/unit/stock.test.ts` (AJUSTE en unidades base) y
  `tests/unit/rentabilidad.test.ts` (agrupación bajo dueño), además de los ya
  existentes en `tests/unit/venta.test.ts`.
