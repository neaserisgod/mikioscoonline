# Notas para escalar a SaaS — hardening multi-tenant

> Pendiente. NO hace falta para un solo kiosco. Hacer esta pasada **antes de abrir la app a terceros (varias cuentas reales)**.

## Estado actual (junio 2026) — está bien encaminado

- `organizationId` presente en las 22 tablas tenant (las únicas sin él son `Organization`, que es el tenant, y `FixedExpenseMonto`, que se alcanza por su padre).
- La organización viaja **firmada en el JWT** y se lee de `session.user.organizationId` — no de input del cliente. No se puede falsear.
- Los servicios filtran por `organizationId` en el `where`, y antes de update/delete hacen `findFirstOrThrow({ where: { id, organizationId } })` para verificar pertenencia. Patrón correcto de SaaS B2B.

## El riesgo a tapar al escalar

El aislamiento hoy es **por convención**: depende de que cada query se acuerde de filtrar por `organizationId`. Una sola consulta futura sin ese filtro = fuga entre cuentas. A más código (o más código generado por IA), más riesgo.

## Pasada de hardening (cuando se escale)

1. **Prisma Client Extension / middleware**: inyectar `organizationId` automáticamente en toda operación desde un solo lugar, para que sea imposible olvidarlo. Enforcement por construcción, no por convención.
2. **`updateMany` / `deleteMany` scope-eados**: reemplazar el patrón `findFirstOrThrow(id, org)` + `update(id)` por `updateMany({ where: { id, organizationId } })`, que scope-ea de forma atómica (sin ventana TOCTOU).
3. **`FixedExpenseMonto`**: agregar `organizationId` o garantizar que siempre se consulte vía el padre scope-eado.
4. **Migrar a PostgreSQL + Row-Level Security (RLS)**: el aislamiento lo impone la base de datos, sin importar cómo esté escrita la query. Estándar de oro. El cambio en código es sobre todo el `provider` + connection string (ya usamos Prisma).

## Decisión de diseño a tomar antes de escalar

**¿Un usuario pertenece a una sola cuenta o a varias?**
- Hoy: cada `User` está atado a una sola `organizationId`.
- Si en el futuro un contador o un dueño de varios kioscos quiere manejar varias cuentas con un login → hace falta una tabla de **membresía** (`User` ↔ `Organization`, con rol por org) y un selector de "cuenta activa".
- Definirlo temprano evita una migración dolorosa.

## Otros pendientes del salto SaaS (no urgentes)

- Planes / suscripción / límites por cuenta (billing).
- Onboarding self-service (alta de organización + primer usuario).
- Backup/exportación por cuenta.
