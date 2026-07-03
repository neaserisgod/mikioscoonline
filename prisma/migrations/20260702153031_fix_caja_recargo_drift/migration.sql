-- Migración de reconciliación (sin cambios reales).
-- Esta migración ya estaba aplicada directamente en la base de Neon (fuera del
-- flujo de Prisma Migrate) desde una sesión anterior. Se introspeccionó la base
-- real y se confirmó que coincide exactamente con el schema.prisma commiteado
-- (mismos campos, tipos y relaciones) — no hay ningún cambio pendiente que aplicar.
-- Esta carpeta existe solo para que el historial local de migraciones coincida
-- con lo que _prisma_migrations ya registra en la base.
SELECT 1;
