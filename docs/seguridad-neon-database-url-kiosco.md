# Seguridad de `NEON_DATABASE_URL` en las cajas de kiosco

**Fecha:** 2026-07-23. Tarea 3 de `docs/prompt-cc-pendientes.md`. Cada caja
física tiene, en `config.env` (texto plano, `%APPDATA%\ar.kioscoelbarrio.pos`),
`NEON_DATABASE_URL`: conexión directa de **lectura y escritura** a la Neon
Postgres de producción (no pooled, no scoped — el mismo rol/privilegios que
usa el resto de la app).

## (a) ¿`resolverUsuarioGoogle` rechaza cuentas que no son de la organización?

**No — la suposición era incorrecta, y era un agujero real.** Confirmado
leyendo el código (`src/lib/resolver-usuario-google.ts`, `src/auth.ts`): el
`signIn` callback solo rechaza emails de Google no verificados y usuarios
existentes desactivados. `resolverUsuarioGoogle` no tenía ningún chequeo de
membresía — si el email no existía como `User`, **creaba una Organization +
User ADMIN nuevos automáticamente**. Es el comportamiento correcto y
deliberado para el alta de un tenant nuevo en el SaaS multi-tenant (Vercel,
donde `NEON_DATABASE_URL` nunca se setea) — pero corriendo en una caja de
kiosco (`NEON_DATABASE_URL` seteada), significaba que **cualquier cuenta de
Google verificada, no solo la de Bruno, podía autenticarse** ahí, y si el email
no era conocido, terminaba creando una organización nueva de verdad en la Neon
de producción con esa misma credencial de escritura compartida.

El gate de "0 ventas locales" en `(dashboard)/layout.tsx` (que redirige a
`/vincular-caja`) es defensivo para no pisar datos locales — nunca fue una
verificación de identidad. El authz real pasa enteramente por si la sesión
autenticada corresponde a un usuario existente en Neon.

**Alcance real del agujero** (antes del fix): un desconocido que lograra
autenticarse con SU PROPIA cuenta de Google en la app corriendo en la PC física
del kiosco:
- No accedía a los datos de Bruno — cada consulta de la app sigue filtrando
  por `organizationId` de la sesión (misma garantía de aislamiento que ya
  depende el SaaS multi-tenant entero); su organización nueva quedaba vacía.
- Pero sí quedaba con una sesión válida, con el server corriendo contra
  `NEON_DATABASE_URL` (producción real, no un tenant de prueba), y quedaba una
  Organization/User espurios creados de verdad en la base de producción.

**Fix aplicado** (`src/lib/resolver-usuario-google.ts`): si
`process.env.NEON_DATABASE_URL` está seteada (señal ya usada en el resto del
código para "esto es un kiosco") y el email no corresponde a un usuario
existente, se rechaza el login (`return null`) en vez de crear una
organización nueva. El alta automática de tenants nuevos sigue funcionando sin
cambios en el deploy real de Vercel. La vinculación de una caja nueva con la
cuenta real de Bruno (`/vincular-caja`) no se ve afectada — su email ya existe
como usuario en Neon, así que nunca pasa por esta rama.

## (b) ¿Conviene acotar `NEON_DATABASE_URL` a un rol de Neon de menor privilegio?

**Sí, es la mitigación de fondo — pero no la implementé, porque tocar roles y
permisos en la Neon de producción es una acción sobre infraestructura
compartida que preferí no hacer sin tu confirmación explícita.** Análisis:

- Acotar por TABLA no ayuda mucho acá: el sync manual (tarea 1, ver
  `docs/actualizaciones-app.md`) necesita lectura/escritura real en
  prácticamente todas las tablas con datos de negocio — no hay forma de
  recortar por tabla sin romper la funcionalidad legítima.
- Lo que sí cambia el panorama es **Row-Level Security (RLS) de Postgres,
  fijada a la organización real de Bruno**, sobre un rol nuevo y separado del
  que usa el resto de la app:
  ```sql
  -- Una vez, en la Neon real:
  CREATE ROLE kiosco_role WITH LOGIN PASSWORD '...';
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kiosco_role;

  -- Por cada tabla con organizationId directo (Organization, User, Caja,
  -- Category, Provider, Location, Customer, PaymentMethod, FixedExpense,
  -- Product, Sale, MovimientoCaja, etc.):
  ALTER TABLE "Sale" ENABLE ROW LEVEL SECURITY;
  CREATE POLICY kiosco_solo_su_org ON "Sale"
    USING ("organizationId" = 'ORG_ID_REAL_DE_BRUNO')
    WITH CHECK ("organizationId" = 'ORG_ID_REAL_DE_BRUNO');
  -- Para las tablas sin organizationId directo (SaleLine, Payment,
  -- StockMovement, FixedExpenseMonto) la policy va vía join/subquery a su
  -- tabla padre, mismo patrón que whereOrg() en scripts/lib/kiosco-sync.ts.
  ```
  Con esto, aunque el fix de (a) fallara o el código de la app tuviera un bug
  de scoping en algún query, **la base misma** impediría que esa conexión
  toque una fila de otra organización — el ataque quedaría acotado a "puede
  romper/leer su propia organización nueva", no a "puede tocar la de Bruno".
  Cada caja pasaría a usar `NEON_DATABASE_URL` con `kiosco_role` en vez del rol
  actual (probablemente el owner de la DB).

- **No lo apliqué** porque: (1) es un cambio de permisos sobre la base de
  producción real, (2) requiere generar y distribuir una connection string
  nueva a `config.env` en cada caja física, y (3) conviene probarlo primero
  (confirmar que ninguna query legítima del kiosco depende de leer/escribir
  fuera de esas policies, ej. si alguna vez necesita crear una Organization
  nueva — que con el fix de (a) ya no debería pasar). Si querés, lo armo como
  un script SQL versionado (`scripts/sql/kiosco-rls.sql` o similar) para que lo
  corras vos mismo contra Neon cuando estés listo, en vez de ejecutarlo yo
  directamente.

## Conclusión

- (a) Estaba mal — corregido, verificado con `tsc` limpio.
- (b) Recomendado (RLS + rol dedicado), no aplicado — requiere tu ok explícito
  para tocar la Neon de producción y actualizar `config.env` en las dos cajas.
