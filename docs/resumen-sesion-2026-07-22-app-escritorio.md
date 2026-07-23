# Resumen de sesión — App de escritorio Tauri (2026-07-22)

Contexto para quien retome esto (Cowork u otra sesión): este resumen cubre
todo lo hecho en una sesión larga que arrancó con el objetivo puntual de
"dejar funcionando el auto-updater de la app Tauri" y terminó destapando y
resolviendo varios problemas reales encontrados en el camino, más una
funcionalidad nueva no planeada originalmente (vincular una caja nueva a la
cuenta real por login de Google). Los 3 commits de esta sesión están en
`main` (no pusheados a `origin` todavía): `4e30f77`, `5f878cf`, `c9f0dc7`.

**Nota importante de historial**: hay una memoria de una sesión previa que
dice "Tauri abandonado por bugs de service worker, tercer intento con
Cowork". Esa memoria está desactualizada respecto al estado real: en esta
sesión el enfoque Tauri se retomó, se completó el auto-updater, se probó de
punta a punta, y quedó funcionando en dos PCs distintas con datos reales de
producción. No está abandonado.

---

## 1. Auto-updater de la app de escritorio (objetivo original)

Ya estaba scaffoldeado (dependencia `tauri-plugin-updater`, bloque
`plugins.updater` en `tauri.conf.json`, función `apply_update_if_available`
en `lib.rs`) pero sin buildear ni probar. Se completó:

- Generado el par de claves de firma real (`%USERPROFILE%\.tauri\kiosco.key`
  + `.pub`), la pública ya está en `tauri.conf.json` (committeada), la
  privada nunca salió de la PC.
- Verificado que compila limpio con la API de `tauri-plugin-updater` 2.10
  (`updater_builder()`, `.check()`, `.download_and_install()`, `.restart()`)
  — no hizo falta corregir nada de esa integración.
- **Probado de punta a punta** con un endpoint local simulando GitHub
  Releases (el updater real rechaza `http`, así que el test usó
  `dangerousInsecureTransportProtocol: true` solo temporalmente, nunca
  committeado): se instaló una v0.1.0, se armó una v0.1.1, y al abrir la app
  detectó, descargó, instaló y reinició sola. `dev.db`/`config.env` del
  usuario quedaron intactos (mismo tamaño/fecha antes y después).
- Instalador NSIS confirmado: instala **por usuario, sin admin**, en
  `%LOCALAPPDATA%\Kiosco El Barrio\`. Soporta `/S` (silencioso) para
  instalar/desinstalar.
- Runbook completo en `docs/actualizaciones-app.md`: cómo generar claves,
  cómo publicar cada release, cómo se vive del lado del usuario.
- Nuevo `scripts/windows/publicar-release.ps1`: automatiza bump de versión +
  build standalone + build firmado + `latest.json`. La publicación en sí
  (crear la Release de GitHub) quedó manual a propósito.

## 2. Bugs reales encontrados y arreglados en el camino

Ninguno de estos era el objetivo original — aparecieron probando la app de
verdad.

### 2.1 — Logs del server perdidos en la app empaquetada
`spawn_node_server` en `lib.rs` usaba `Stdio::inherit()`, que en una app
`windows_subsystem="windows"` (sin consola) no va a ningún lado. Se redirige
ahora a `%APPDATA%\ar.kioscoelbarrio.pos\logs\server.log` /
`server-error.log` (se pisan en cada arranque). Sin esto, ningún
`console.error`/`logError` del server era diagnosticable en la app instalada.

### 2.2 — `dev-template.db` (la plantilla del instalador) desactualizada
Tanto la plantilla empaquetada como una `dev.db` de pruebas vieja tenían el
schema de Prisma de varias semanas atrás (faltaban ~20 migraciones,
incluyendo `facturacionModoProduccion`) — cualquier instalación nueva iba a
romper con `PrismaClientKnownRequestError`. Se corrió `prisma db push`
contra ambas para ponerlas al día. **Además**: `dev-template.db` estaba
bloqueada por el `*.db` de `.gitignore` — nunca se había committeado, así
que el instalador no se podía buildear desde un clone limpio. Se agregó una
excepción puntual en `.gitignore` y se committeó.

### 2.3 — Venta simulada (mock) rechazada con "Invalid input"
Sin `PAGOS_PROVIDER`/credenciales de MP en `config.env`, el sistema cae al
proveedor **mock** (no MercadoPago real). `MockPagosProvider` codifica a
propósito el `externalReference` + timestamp dentro del `orderId` (no tiene
estado compartido entre llamadas), y `"mp-" + orderId` superaba el
`max(64)` del `id` de `CrearVentaSchema` — rechazaba toda venta simulada por
QR/posnet. Se subió el límite a 128 y se agregó logging del detalle
completo del `ZodError` (antes el cajero solo veía el mensaje genérico de
Zod, sin rastro server-side de qué campo/valor exacto falló).

### 2.4 — Hallazgo de seguridad/privacidad (no es un bug de este repo)
Al correr `prisma db push`, apareció en la salida de la CLI un "tip"
promocional del paquete npm `dotenv` (v17.4.2, hardcodeado en
`node_modules/dotenv/lib/main.js`) que incluye la línea `⌁ auth for agents
[www.vestauth.com]` — publicidad de un dominio de terceros con una frase
dirigida específicamente a agentes de IA, mezclada entre tips legítimos. No
es malware ni ejecuta nada (es un `console.log`), pero vale que Bruno lo
sepa — no se visitó esa URL ni se actuó sobre ella.

## 3. Credenciales reales cargadas en el kiosco local

`config.env` (en `%APPDATA%\ar.kioscoelbarrio.pos\` de cada PC, **no** en el
repo) ahora tiene, copiadas desde `.env.local` de producción:
`PAGOS_PROVIDER`, `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `FACTURACION_PROVIDER`,
`AFIP_CUIT`, `AFIP_CERT`, `AFIP_PRIVATE_KEY`, `AFIP_ACCESS_TOKEN`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, y la nueva `NEON_DATABASE_URL` (ver
sección 4).

**Deliberadamente excluidas** (importante para cualquiera que toque esto
después): `DATABASE_URL`/`DIRECT_URL` (apuntarían la caja directo a Neon en
vez de su sqlite local, rompiendo el sentido de tener base local),
`AUTH_SECRET` (cada caja genera el suyo, no se comparte), `MP_WEBHOOK_SECRET`
(vacío hasta en prod, y de todos modos un webhook nunca llega a un
desktop sin URL pública), `SEED_ADMIN_PASSWORD`/`KIOSCO_OWNER_EMAIL`/
`MP_PREAPPROVAL_PLAN_ID` (scripts de seed o suscripción del SaaS, no
runtime del POS).

Nuevo `scripts/gen-config-caja-nueva.mjs`: genera un `config.env` completo
listo para copiar a una caja nueva, en vez de cargar credenciales campo por
campo.

## 4. Funcionalidad nueva: vincular caja nueva a la cuenta real (no planeada)

Bruno pidió que una caja nueva, al iniciar sesión con Google, reconozca sola
si esa cuenta ya tiene un negocio real en producción y se traiga los datos
— reemplazando el proceso manual de copiar `kiosco.db` a mano. Implementado
y **verificado funcionando en una segunda PC física con datos reales**.

**Cómo funciona**: `src/lib/prisma-auth.ts` (infraestructura preexistente,
no tocada) ya resuelve el login contra Neon directo cuando
`NEON_DATABASE_URL` está seteada, incluso si el resto de la app usa sqlite
local. Con eso, `resolverUsuarioGoogle` funciona sin cambios. Lo nuevo: si
la caja nunca vendió nada (`Sale.count === 0`), el gate en
`(dashboard)/layout.tsx` redirige a `/vincular-caja`
(`src/app/(vincular-caja)/`), que con un click borra lo que haya localmente
bajo esa organización y trae TODO desde Neon (`scripts/lib/kiosco-sync.ts`,
mismo código que ya usaba `kiosco-download-data.ts`): organización,
usuarios, cajas, categorías, proveedores, ubicaciones, medios de pago,
gastos fijos, clientes, catálogo completo, ventas/pagos/stock/comprobantes
(con PDF) y movimientos de caja.

**Gotcha central del diseño** (importante para quien lo revise):
`Organization.id` de la plantilla vacía del instalador (`org_principal`,
sembrada por `prisma/seed.ts`) es el **mismo id** que la organización real
de Bruno en Neon — este código nació pensado para un solo negocio, antes de
que existiera multi-tenancy, y ese id quedó fijo. El primer diseño
comparaba por `organizationId`/email para distinguir "plantilla" de "real"
y se hubiera roto en producción: hasta el email admin por default
(`admin@kiosco.ar`) coincide con un usuario real en Neon, y un `upsert`
directo hubiera chocado contra `User.email @unique`. La señal correcta que
se usó en su lugar es **"0 ventas locales"**, sin comparar identidad — y la
action borra la plantilla local antes de importar en vez de intentar
diferenciarla de la real.

**Edge case documentado, no resuelto**: si el import se corta a mitad de
camino justo copiando la tabla `sale`, algunas filas pueden quedar locales
y el chequeo de seguridad ("esta caja ya tiene ventas, no vinculo encima")
bloquearía un reintento por la UI — requeriría limpiar esas filas a mano.
No pasó en la práctica todavía.

## 5. Pendientes / cosas para que Cowork (u otra sesión) tenga en cuenta

- **[PRINCIPAL] Falta un botón de sincronización manual (bien hecho, sin
  sobreescribir).** La idea de que los datos se sincronicen "solos" quedó medio
  obsoleta: `/vincular-caja` es un pull de **una sola vez** y es **destructivo**
  (borra todo lo local bajo la organización y reimporta desde Neon). Eso solo es
  seguro en una caja virgen (0 ventas) — no sirve para re-sincronizar una caja ya
  en uso, porque pisaría datos locales (p. ej. ventas hechas offline que todavía
  no subieron a Neon). Hace falta un **sync manual explícito** (un botón), pensado
  para NO sobreescribir: upsert idempotente por id que traiga novedades de Neon
  (catálogo, precios, etc.) sin borrar filas que existen solo localmente, con una
  política de conflicto clara por tabla (qué lado gana, y en qué dirección va cada
  tabla). Punto clave: separar "traer cambios de arriba" de "no perder lo de
  abajo" — hoy `vincularCajaAction` mezcla ambas cosas con un delete-all previo
  que no se puede reusar tal cual para esto. El auto-updater
  reemplaza el bundle (Rust + Next), pero nunca corre `prisma db push`/
  `migrate deploy` contra la `dev.db` ya instalada en una caja. Cualquier
  release futura que cambie el schema de Prisma va a romper las cajas ya
  instaladas de la misma manera que se encontró en el punto 2.2, hasta que
  se agregue ese paso (candidato: correrlo en `lib.rs` antes de
  `spawn_node_server`).
- **Credenciales MP/AFIP siguen siendo por-proceso, no por-organización**
  (hallazgo A2 de `docs/REPORTE-NUCLEO.md`, preexistente, no tocado esta
  sesión). Mientras eso no cambie, cada caja nueva necesita su propio
  `config.env` con las mismas credenciales copiadas a mano (con
  `gen-config-caja-nueva.mjs`) — no hay forma de que se auto-provisionen
  junto con los datos de `/vincular-caja`, porque esas credenciales no viven
  en la base de datos.
- **No se pusheó nada a `origin`.** Los 3 commits están solo en el `main`
  local.
- Ver `docs/actualizaciones-app.md` para el runbook completo actualizado
  (auto-update + vincular caja nueva).
