# Actualizaciones automáticas de la app (Tauri updater)

La app de escritorio (Tauri) ahora chequea GitHub Releases **cada vez que arranca**
y, si hay una versión más nueva, la descarga e instala sola **antes de abrir la
caja**. La base de datos local (`dev.db`) y la configuración (`config.env`) viven
en la carpeta de datos del usuario (`%APPDATA%\ar.kioscoelbarrio.pos`) y **NO se
tocan** al actualizar — se conservan intactas.

Servidor de actualizaciones: la propia **Release "latest" del repo**
`github.com/neaserisgod/mikioscoonline` (gratis, no hace falta infra extra).

---

## Preparación por única vez

### 1. Generar el par de claves de firma

Los updates van firmados: sin la firma correcta, la app rechaza el paquete (evita
que alguien te sirva un instalador trucho). Se genera una sola vez y la clave
privada **nunca** se sube a GitHub.

```powershell
npx tauri signer generate -w $env:USERPROFILE\.tauri\kiosco.key
```

Esto crea dos archivos:

- `%USERPROFILE%\.tauri\kiosco.key` → **clave privada** (secreta, guardala bien)
- `%USERPROFILE%\.tauri\kiosco.key.pub` → **clave pública**

Te va a pedir una password para la clave privada (podés dejarla vacía).

### 2. Pegar la clave pública en la config

Abrí `%USERPROFILE%\.tauri\kiosco.key.pub`, copiá **todo** su contenido y pegalo
en `src-tauri/tauri.conf.json`, reemplazando el placeholder:

```json
"updater": {
  "endpoints": [
    "https://github.com/neaserisgod/mikioscoonline/releases/latest/download/latest.json"
  ],
  "pubkey": "ACÁ_VA_EL_CONTENIDO_DEL_.pub"
}
```

Commiteá este cambio (la pública sí puede ir al repo; la privada no).

---

## Publicar una actualización (cada release)

### 0. ¿Cambiaste `prisma/schema.dev.prisma`? Generá la migración ANTES que nada

El auto-updater reemplaza el bundle pero nunca toca `dev.db` de las cajas ya
instaladas. Si el schema cambió, hay que generar el SQL que las pone al día —
**antes** de actualizar `src-tauri/resources/dev-template.db` al nuevo schema
(el diff necesita comparar contra la plantilla VIEJA):

```powershell
node scripts/gen-migracion-sqlite.mjs nombre-corto-del-cambio
```

Esto deja un `.sql` nuevo en `src-tauri/resources/migraciones-sqlite/`.
Revisalo, y recién después actualizá `dev-template.db` al schema nuevo (mismo
`prisma db push` de siempre). Commiteá los dos juntos. Al abrir la app
actualizada, `apply_pending_migrations` (`src-tauri/src/lib.rs`) aplica
cualquier `.sql` pendiente contra `dev.db` antes de levantar el server —
instalaciones nuevas no re-ejecutan nada (la plantilla ya viene con el schema
horneado). Ver detalle técnico y por qué no se usa `prisma migrate deploy`
directamente en el comentario de `apply_pending_migrations`.

Si NO tocaste el schema, saltá directo al paso 1.

### 1. Subir el número de versión

En `src-tauri/tauri.conf.json`, subí `"version"` (ej. `0.1.0` → `0.1.1`). Ese
número es el que el updater compara. Usá el mismo para el tag de GitHub (`v0.1.1`).

### 2. Buildear firmado

```powershell
# Cargar la clave privada en el entorno (solo para esta terminal)
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:USERPROFILE\.tauri\kiosco.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tu-password-o-vacio"

# Primero el server Next standalone, después el bundle Tauri
npm run build:standalone
npx tauri build
```

`npx tauri build` deja el instalador y su firma en
`src-tauri/target/release/bundle/nsis/` (`*-setup.exe` y `*-setup.exe.sig`).

### 3. Generar `latest.json`

```powershell
node scripts/gen-latest-json.mjs 0.1.1 "Notas de esta versión"
```

Deja `dist/latest.json` apuntando al instalador de la release `v0.1.1`.

### 4. Crear la Release en GitHub

1. En `github.com/neaserisgod/mikioscoonline` → **Releases → Draft a new release**.
2. Tag: `v0.1.1` (igual que la versión).
3. Subí como **assets**:
   - el `*-setup.exe` de `src-tauri/target/release/bundle/nsis/`
   - `dist/latest.json`
4. Publicá la release.

Listo. La próxima vez que cada caja abra la app, va a ver la versión nueva, la
baja e instala sola, y arranca actualizada.

> El endpoint usa `/releases/latest/`, así que **siempre gana la última release
> publicada**. No hace falta tocar nada más.

---

## Cómo lo vive el usuario final

1. Instala la app **una sola vez** con el `*-setup.exe` (o el `.msi`).
2. Cada arranque: chequeo silencioso contra GitHub (timeout de 15 s — si no hay
   internet, abre igual sin trabarse).
3. Si hay update: lo baja, lo instala y reinicia la app **antes** de mostrar la
   caja. Si no, abre normal.

---

## Vincular una caja nueva a la cuenta real (sin copiar bases a mano)

Antes, preparar una segunda caja significaba copiarle un `kiosco.db` a mano.
Ahora, si el `config.env` de esa caja tiene `NEON_DATABASE_URL` (conexión
directa a Neon, ver [Preparación por única vez](#preparación-por-única-vez)
más abajo) además de `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, la propia app se
encarga:

1. Al iniciar sesión con Google en una caja que **nunca vendió nada todavía**
   (`Sale.count === 0` en su sqlite local), la app redirige a
   `/vincular-caja` en vez de al dashboard.
2. Esa pantalla, con un click, borra lo que haya localmente bajo esa
   organización (no hay nada real que perder — el gate ya garantiza 0 ventas)
   y trae TODO lo de la cuenta real desde Neon: organización, usuarios,
   cajas, categorías, proveedores, ubicaciones, medios de pago, gastos fijos,
   clientes, catálogo completo, y todo el historial (ventas, pagos, stock,
   comprobantes con PDF incluido, movimientos de caja). Reusa
   `scripts/lib/kiosco-sync.ts` (mismo código que ya usaba
   `kiosco-download-data.ts`), así que es upsert idempotente por id — un
   reintento no duplica nada.
3. Al terminar, redirige a `/inicio` con todo cargado.

**Gotcha importante**: `Organization.id` de la plantilla vacía del instalador
(`org_principal`, sembrada por `prisma/seed.ts`) es el MISMO id que la
organización real de Bruno en Neon — este código nació pensado para un solo
negocio. Por eso la señal para decidir "¿vinculo?" es **0 ventas locales**, no
comparar organizationId/email contra la plantilla (eso se rompía: hasta el
email admin por default puede coincidir con un usuario real, y un upsert
directo hubiera chocado contra `User.email @unique`).

---

## Sincronizar una caja YA en uso (botón "Sincronizar ahora", Config → Datos)

`/vincular-caja` (arriba) solo sirve una vez, en una caja virgen: borra todo lo
local y reimporta. Para una caja que ya tiene ventas, ese borrado es peligroso
(pisaría ventas offline que todavía no subieron a Neon). Para eso existe el
botón **"Sincronizar ahora"** en Config → Datos (solo visible si la caja tiene
`NEON_DATABASE_URL` configurada) — `sincronizarCajaAction` en
`src/app/actions/sincronizar-caja.actions.ts`, solo ADMIN.

Hace dos pasadas, ninguna de las dos borra nada:

1. **Sube** lo local a Neon — la misma lógica que ya usaba el backup nocturno
   (`subirCambiosLocales`, extraída a `scripts/lib/kiosco-sync.ts` para que la
   compartan el cron de las 21:55 y este botón).
2. **Baja** el catálogo de Neon (organización, usuarios, cajas, categorías,
   proveedores, ubicaciones, clientes, medios de pago, gastos fijos,
   productos — `TABLAS_DESCARGA`) por upsert idempotente por id, sin borrar
   nada. Ventas/pagos/movimientos de caja nunca bajan (se suben nomás, para no
   arriesgar nada).

**Protección de campos operativos** (`CAMPOS_SOLO_EN_CREACION` en
`kiosco-sync.ts`): si un producto/proveedor/cliente/caja/usuario YA existe
localmente, la bajada actualiza sus datos de catálogo (precio, nombre,
categoría, etc.) pero **nunca pisa** `stock`, saldos de cuenta corriente,
saldo manual de caja ni contadores de login — esos solo se traen completos si
la fila es NUEVA localmente. Así, dos cajas que venden por separado y cargan
productos distintos pueden sincronizar sin perder ventas ni resetear stock del
día. `Organization` es conservadora a propósito: solo baja identidad fiscal
(nombre/cuit/condicionIva/puntoDeVenta); los toggles de facturación,
montos del modelo financiero y el estado de suscripción del SaaS se preservan
locales si la organización ya existe.

Caso de uso real: cargaste un producto nuevo en la Caja B, la Caja A no lo ve
todavía. En la Caja A, apretás "Sincronizar ahora" — sube lo de A (por si
había algo pendiente) y baja el catálogo de Neon, incluido el producto nuevo
de B (asumiendo que B ya subió, por su propio backup nocturno o su propio
"Sincronizar ahora"). Es idempotente: correrlo de nuevo sin cambios de por
medio no reporta diferencias.

**Si se corta a mitad de camino** (wifi, cierre de la app): la action
devuelve un error sin redirigir, así que se puede reintentar tocando el botón
de nuevo. La única situación que requiere intervención manual es si el corte
pasó justo copiando la tabla `sale` y algunas filas ya quedaron locales — ahí
el chequeo de seguridad ("esta caja ya tiene ventas, no vinculo encima") va a
bloquear el reintento por la UI, y hay que limpiar esas filas parciales a mano
antes de reintentar. No pasó todavía en la práctica, pero vale saberlo.

Archivos: `src/app/actions/vincular-caja.actions.ts`,
`src/app/(vincular-caja)/vincular-caja/`, el gate en
`src/app/(dashboard)/layout.tsx`.

---

## Backup automático de ventas (sin tocar nada)

Antes, una caja Tauri **solo** subía sus ventas a Neon si alguien apretaba
"Sincronizar ahora" a mano — sin eso, perder la PC significaba perder todas
las ventas no sincronizadas. Ahora es automático, sin depender del operador:

- `src-tauri/src/lib.rs` levanta un timer propio (`spawn_backup_uploader`) que,
  mientras la caja está abierta, pega cada `KIOSCO_BACKUP_INTERVALO_MIN`
  minutos (default 10, configurable en `config.env`) contra un endpoint interno
  del propio server: `POST /api/kiosco-backup-automatico`
  (`src/app/api/kiosco-backup-automatico/route.ts`).
- Ese endpoint corre `subirCambiosLocales` (la misma función que ya usa el
  backup nocturno del lanzador viejo y el botón "Sincronizar ahora") — **solo
  sube, nunca baja ni borra nada local**. Correrlo seguido es seguro y barato:
  si no hay nada nuevo, no hace nada.
- Al cerrar la ventana (`on_window_event` / `CloseRequested`), antes de matar
  el proceso del server se hace un último intento de subida con timeout corto
  (5s) — cubre el caso real de un comercio que cierra la caja antes de
  cualquier hora fija de backup.
- El endpoint está protegido con `KIOSCO_BACKUP_TOKEN` (`Authorization: Bearer
  ...`, mismo patrón que ya usan las rutas `/api/cron/*`) — se genera una sola
  vez en `config.env`, igual que `AUTH_SECRET`, y nunca sale de la caja. El
  server solo escucha en `127.0.0.1`, así que ya de por sí no es alcanzable
  desde la red — el token es una segunda capa contra otros procesos locales.
- Log de cada intento (solo OK/FALLÓ, el detalle completo por tabla ya queda
  en `server.log` vía el propio endpoint) en `logs/backup-automatico.log`,
  truncado en cada arranque de la app (mismo criterio que `server.log`).
- No corre si la caja no tiene `NEON_DATABASE_URL` configurada (no hay a dónde
  subir nada), y el lanzador Edge viejo (`start-kiosco.ps1`) no se ve afectado
  — sigue usando su propio `kiosco-backup-scheduler.mjs` como proceso aparte,
  sin relación con este mecanismo.

---

## Verificado (2026-07-22)

Se probó el flujo completo en Windows con un endpoint local simulando GitHub
Releases (el updater de Tauri rechaza endpoints `http`, así que la prueba usó
`dangerousInsecureTransportProtocol: true` **solo durante el test**, nunca
committeado):

- `cargo check` en `src-tauri/` compila limpio con las APIs de
  `tauri-plugin-updater` 2.10 tal como estaban escritas en `lib.rs`
  (`updater_builder()`, `.check()`, `.download_and_install()`, `.restart()`)
  — no hizo falta corregir nada de la integración.
- `npm run build:standalone` + `npx tauri build` (firmado) generan el `.msi` y
  el `*-setup.exe` + `.sig` en `src-tauri/target/release/bundle/`.
- El instalador NSIS se instala **por usuario, sin admin**, en
  `%LOCALAPPDATA%\Kiosco El Barrio\` (soporta instalación silenciosa con
  `Kiosco*-setup.exe /S`, y desinstalación con `uninstall.exe /S`).
- Se instaló una v0.1.0 de prueba, se armó una v0.1.1 con `latest.json`
  servido localmente, y al abrir la app **detectó, descargó, instaló y
  reinició sola** — el `app.exe` instalado pasó de 0.1.0 a 0.1.1 sin
  intervención. `dev.db` y `config.env` en `%APPDATA%\ar.kioscoelbarrio.pos`
  quedaron con el mismo tamaño y fecha de modificación de antes del update:
  **no se tocan**, confirmado.
- El par de claves de firma real ya se generó (`%USERPROFILE%\.tauri\kiosco.key`
  + `.pub`) y la pública ya está pegada en `tauri.conf.json`. La privada nunca
  salió de esta PC ni se subió al repo.

### ✅ RESUELTO: migraciones de schema en las actualizaciones

El updater reemplaza el bundle (Rust + Next standalone), pero **`dev.db` del
usuario no se toca** — correcto para no perder datos, pero significaba que un
cambio de schema rompía las cajas ya instaladas (`PrismaClientKnownRequestError:
la columna X no existe`, se reprodujo con una `dev.db` de prueba sin
`facturacionModoProduccion`).

Resuelto sin bundlear el CLI de Prisma (no viaja en el standalone build, y
`prisma/migrations/` es SQL de Postgres — no corre en SQLite): el diff se
genera en build-time con `prisma migrate diff` (ver paso 0 de "Publicar una
actualización", arriba) y se aplica en runtime con `rusqlite`
(`apply_pending_migrations` en `src-tauri/src/lib.rs`) antes de
`spawn_node_server`. Ver esa sección para el flujo completo cada vez que
cambie `prisma/schema.dev.prisma`.

## Notas técnicas

- El chequeo se hace en `src-tauri/src/lib.rs` (`apply_update_if_available`)
  **antes** de levantar el server Node, para no dejar el proceso `node`
  huérfano ocupando el puerto 3210 al reiniciar.
- El update reemplaza **todo el bundle** (shell Rust + server Next standalone),
  así que los cambios en la UI/lógica de Next viajan en cada actualización.
- La firma de cada release sale de `createUpdaterArtifacts: true` en
  `tauri.conf.json`. No borres esa opción.
- **Automatizar con CI (opcional):** existe la GitHub Action oficial
  `tauri-apps/tauri-action`, que buildea en un runner Windows, crea la release y
  genera el `latest.json` solo. Requiere cargar como *secrets* de GitHub la clave
  privada de firma y las credenciales de `.env.local` (Neon/MercadoPago/AFIP).
  Dado que esos secretos son de producción, por ahora conviene el flujo manual de
  arriba; migrar a CI cuando quieras dejar de buildear a mano.
