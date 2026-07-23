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

**Sí — plan concreto listo en `scripts/sql/kiosco-rls.sql`, NO corrido
todavía.** Acotar por tabla no alcanza (el sync necesita lectura/escritura real
en casi todas las tablas de negocio); lo que sí cambia el panorama es **Row-Level
Security fijada a tu organización**, sobre un rol nuevo separado del que usa el
resto de la app. Permisos exactos, derivados 1:1 de `ORDEN_TABLAS`/`whereOrg()`
en `scripts/lib/kiosco-sync.ts` (la misma fuente de verdad que ya usa el código
para decidir "esta fila es de mi organización"):

- **SELECT + INSERT + UPDATE** en las 19 tablas que tocan `subirCambiosLocales`
  / `bajarCambiosDeNeon` / login (`Organization`, `User`, `Caja`, `Category`,
  `Provider`, `MovimientoCuentaCorrienteProveedor`, `Location`, `Customer`,
  `PaymentMethod`, `FixedExpense`, `FixedExpenseMonto`, `CajaSesion`,
  `ArqueoParcial`, `Product`, `Sale`, `SaleLine`, `Payment`, `Comprobante`,
  `StockMovement`, `MovimientoCaja`).
- **DELETE** solo en `Category`/`Provider`/`Location` (borrado espejo,
  `MODELOS_CON_BORRADO`).
- **RLS por fila**, fijada a `'ORG_ID_REAL_DE_BRUNO'` (constante, no una
  sesión/variable — no hace falta, el rol es de UNA sola organización) —
  directa donde hay columna `organizationId`, vía subquery a la tabla padre
  donde no la hay (`FixedExpenseMonto`→`FixedExpense`, `SaleLine`/`Payment`→
  `Sale`, `StockMovement`→`Product`).
- **Ninguna tabla fuera de esta lista queda accesible** — en particular
  `OrdenMpPendiente` y todo lo de suscripción/paywall del SaaS quedan
  completamente fuera del alcance del rol de la caja.

Con esto, aunque el fix de (a) fallara o el código de la app tuviera un bug de
scoping en algún query, la base misma impide tocar una fila de otra
organización.

**Antes de correr `scripts/sql/kiosco-rls.sql` en producción:**
1. Reemplazar los placeholders (`ORG_ID_REAL_AQUI`, la password) en el script.
2. Confirmar que no hay OTRO rol/servicio que dependa de leer estas tablas SIN
   ser el owner de la DB — activar RLS en una tabla no afecta al owner (lo
   bypassea por default) pero sí a cualquier otro rol no-owner que ya exista.
   No tengo visibilidad completa de qué roles están configurados hoy en tu
   proyecto de Neon — confirmalo vos antes de correr esto.
3. Generar la connection string nueva (`postgresql://kiosco_role:...@...`) y
   probarla primero en UNA caja de prueba (o local, apuntando `NEON_DATABASE_URL`
   a esa connection string) — confirmar login, `/vincular-caja` y "Sincronizar
   ahora" antes de rolarla a las cajas reales.
4. Recién ahí, actualizar `config.env` en cada caja física con la connection
   string nueva.

Rollback si algo rompe: restaurar el `NEON_DATABASE_URL` viejo en `config.env`
de la caja afectada (vuelve a andar al toque); deshacer el rol/RLS en Neon es
opcional y está documentado al final del script.

## Conclusión

- (a) Estaba mal — corregido, verificado con `tsc` limpio.
- (b) Plan concreto en `scripts/sql/kiosco-rls.sql`, no corrido — requiere que
  vos lo ejecutes contra la Neon de producción (o me confirmes que lo haga yo)
  y actualices `config.env` en las cajas físicas.
