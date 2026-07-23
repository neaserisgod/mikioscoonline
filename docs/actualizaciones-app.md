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

### ⚠️ Gotcha importante: las actualizaciones NO corren migraciones de Prisma

El updater reemplaza el bundle (Rust + Next standalone), pero **`dev.db` del
usuario no se toca** — que es justamente lo que se busca para no perder datos.
El problema: si una actualización incluye un cambio de schema de Prisma
(nueva columna, tabla, etc.), la app nueva va a intentar consultar contra la
`dev.db` vieja y va a romper con errores tipo
`PrismaClientKnownRequestError: la columna X no existe` (se reprodujo en la
prueba con una `dev.db` de un test anterior que no tenía la columna
`facturacionModoProduccion`).

**Antes de publicar cualquier release que incluya una migración de Prisma**,
hay que resolver cómo se aplica esa migración a las `dev.db` ya instaladas en
las cajas (por ejemplo, corriendo `prisma migrate deploy` contra la
`DATABASE_URL` local al arrancar, antes de `spawn_node_server`, en
`src-tauri/src/lib.rs`). Mientras eso no exista, publicar un release con
cambios de schema **rompe las cajas que ya están instaladas**. No es parte de
este alcance (auto-update en sí funciona perfecto), pero es un bloqueante real
para el próximo release que toque el schema.

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
