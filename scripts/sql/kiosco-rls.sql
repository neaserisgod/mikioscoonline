-- A2 (producción): rol de Neon de privilegio mínimo para las cajas de kiosco,
-- con Row-Level Security fijada a la organización real de Bruno.
--
-- NO SE CORRIÓ TODAVÍA. Es una propuesta versionada para revisar y correr a
-- mano (psql, Neon SQL editor, o el cliente que uses) contra la Neon de
-- producción, cuando estés listo. Ver docs/seguridad-neon-database-url-kiosco.md
-- para el análisis completo.
--
-- Reemplazá 'ORG_ID_REAL_AQUI' por tu Organization.id real ANTES de correr
-- esto (SELECT id, nombre FROM "Organization"; para encontrarlo) y
-- 'UNA_PASSWORD_FUERTE_ACA' por una contraseña generada (ej.
-- `openssl rand -base64 32` o el generador de Neon).
--
-- Alcance: exactamente las tablas que tocan subirCambiosLocales,
-- bajarCambiosDeNeon y el login/vincular-caja (ver ORDEN_TABLAS y whereOrg en
-- scripts/lib/kiosco-sync.ts) -- ninguna tabla de otros tenants ni de
-- suscripción/paywall del SaaS (OrdenMpPendiente, etc.) queda accesible.

-- ─── 1. Rol nuevo, sin privilegios de superusuario/owner ──────────────────────

CREATE ROLE kiosco_role WITH LOGIN PASSWORD 'UNA_PASSWORD_FUERTE_ACA';
GRANT USAGE ON SCHEMA public TO kiosco_role;

-- ─── 2. Grants por tabla (igual para todas las cajas, no cambia por org) ───────
-- Upload (subirCambiosLocales) necesita SELECT+INSERT+UPDATE en TODAS estas;
-- download (bajarCambiosDeNeon, vincular-caja, login) solo necesita SELECT,
-- pero como el mismo rol hace las dos cosas, se otorgan juntas.

GRANT SELECT, INSERT, UPDATE ON
  "Organization", "User", "Caja", "Category", "Provider",
  "MovimientoCuentaCorrienteProveedor", "Location", "Customer",
  "PaymentMethod", "FixedExpense", "FixedExpenseMonto", "CajaSesion",
  "ArqueoParcial", "Product", "Sale", "SaleLine", "Payment", "Comprobante",
  "StockMovement", "MovimientoCaja"
TO kiosco_role;

-- Borrado espejo (borrarHuerfanos) -- solo estos 3 tienen hard-delete real:
GRANT DELETE ON "Category", "Provider", "Location" TO kiosco_role;

-- ─── 3. Row-Level Security: cada policy calca exactamente whereOrg() de
--        scripts/lib/kiosco-sync.ts -- mismo criterio para decidir "esta fila
--        es de mi organización" que ya usa el código de la app. ────────────────

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosco_org ON "Organization"
  USING (id = 'ORG_ID_REAL_AQUI') WITH CHECK (id = 'ORG_ID_REAL_AQUI');

-- Tablas con organizationId directo (caso default de whereOrg()):
DO $$
DECLARE
  tabla TEXT;
BEGIN
  FOREACH tabla IN ARRAY ARRAY[
    'User', 'Caja', 'Category', 'Provider', 'MovimientoCuentaCorrienteProveedor',
    'Location', 'Customer', 'PaymentMethod', 'FixedExpense', 'CajaSesion',
    'ArqueoParcial', 'Product', 'Sale', 'Comprobante', 'MovimientoCaja'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tabla);
    EXECUTE format(
      'CREATE POLICY kiosco_org ON %I USING ("organizationId" = %L) WITH CHECK ("organizationId" = %L)',
      tabla, 'ORG_ID_REAL_AQUI', 'ORG_ID_REAL_AQUI'
    );
  END LOOP;
END $$;

-- Tablas SIN organizationId directo -- policy vía join a la tabla padre
-- (mismo camino que whereOrg() arma con { fixedExpense: {...} } / { sale: {...} } / { product: {...} }):

ALTER TABLE "FixedExpenseMonto" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosco_org ON "FixedExpenseMonto"
  USING ("fixedExpenseId" IN (SELECT id FROM "FixedExpense" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'))
  WITH CHECK ("fixedExpenseId" IN (SELECT id FROM "FixedExpense" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'));

ALTER TABLE "SaleLine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosco_org ON "SaleLine"
  USING ("saleId" IN (SELECT id FROM "Sale" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'))
  WITH CHECK ("saleId" IN (SELECT id FROM "Sale" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosco_org ON "Payment"
  USING ("saleId" IN (SELECT id FROM "Sale" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'))
  WITH CHECK ("saleId" IN (SELECT id FROM "Sale" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'));

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
CREATE POLICY kiosco_org ON "StockMovement"
  USING ("productId" IN (SELECT id FROM "Product" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'))
  WITH CHECK ("productId" IN (SELECT id FROM "Product" WHERE "organizationId" = 'ORG_ID_REAL_AQUI'));

-- ─── 4. Verificación (correr conectado COMO kiosco_role, no como owner) ────────
-- SET ROLE kiosco_role; -- o conectate directo con la connection string nueva
-- SELECT count(*) FROM "Sale";              -- debe dar solo las de tu organización
-- SELECT count(*) FROM "Organization";      -- debe dar 1 (la tuya)
-- INSERT/UPDATE de prueba en una tabla, confirmar que solo afecta tu org.
-- Probar TAMBIÉN "Sincronizar ahora" desde una caja de prueba con la
-- connection string nueva antes de rolarla a las cajas reales.

-- ─── Rollback ───────────────────────────────────────────────────────────────
-- Si algo rompe: las cajas vuelven a andar apenas les restaurés en config.env
-- el NEON_DATABASE_URL viejo (el rol actual, sin RLS). Para deshacer esto del
-- lado de Neon (opcional, no urgente):
--   DROP OWNED BY kiosco_role; DROP ROLE kiosco_role;
--   -- y por cada tabla: ALTER TABLE "X" DISABLE ROW LEVEL SECURITY;
