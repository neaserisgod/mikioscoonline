# Puesta en producción — app de escritorio Kiosco (estado + checklist)

Estado verificado al momento de escribir esto. Repo: neaserisgod/mikioscoonline.

## Estado verificado

| Punto | Estado |
|---|---|
| `tauri.conf.json` con pubkey real (no placeholder) | ✅ es una clave minisign real |
| Versión declarada / Release publicada en GitHub | ⚠️ no hay releases (`/releases` devuelve `[]`, el `latest.json` da 404) |
| `main` en sync con `origin/main`, tree limpio | ✅ (solo 3 `.md` sueltos sin trackear, no bloqueante) |
| `dev-template.db` al día con el schema | ✅ (diff vs `migraciones-sqlite/` vacío a propósito) |
| `NEON_DATABASE_URL` con rol acotado | ❌ sigue siendo rol full (RLS documentado en `docs/seguridad-neon-database-url-kiosco.md`, no aplicado) |
| Backup automático de ventas (app Tauri) | ✅ **RESUELTO 2026-07-23** — ver abajo |

### A1 — RESUELTO: backup automático de ventas en la app Tauri

Implementado y probado de punta a punta (con bases SQLite descartables, nunca
contra Neon real): `POST /api/kiosco-backup-automatico`
(`src/app/api/kiosco-backup-automatico/route.ts`, protegido con
`KIOSCO_BACKUP_TOKEN`) corre `subirCambiosLocales` (upload-only, nunca
baja/borra nada local). `src-tauri/src/lib.rs` lo dispara con un timer propio
cada `KIOSCO_BACKUP_INTERVALO_MIN` minutos (default 10) mientras la caja está
abierta, más un último intento best-effort (timeout 5s) al cerrar la ventana —
cubre el caso de un comercio que cierra antes de cualquier hora fija. Probado:
sube datos nuevos correctamente, es idempotente (correrlo seguido no duplica
ni falla), auth con token rechaza requests sin/con token incorrecto,
`cargo check` limpio. Detalle completo en `docs/actualizaciones-app.md`,
sección "Backup automático de ventas".

---

## Checklist de producción

### A. Pre-flight (bloqueante antes de la primera release real)

1. ~~**[BLOQUEANTE] Backup automático para la app Tauri.**~~ **RESUELTO
   2026-07-23**, ver arriba.
2. **A2 — Cerrar el pendiente de seguridad de `NEON_DATABASE_URL`** (rol de Neon
   acotado + RLS). Plan concreto YA armado en `scripts/sql/kiosco-rls.sql`
   (permisos exactos por tabla + policies RLS, derivados de `whereOrg()`) y
   `docs/seguridad-neon-database-url-kiosco.md` — falta correrlo contra la Neon
   real (trabajo de infraestructura, no de código) y actualizar `config.env` en
   las dos cajas. Hoy cualquier `config.env` filtrado da lectura/escritura total
   a producción.
3. **Confirmar que las cajas físicas ya instaladas corren la versión actual** del
   código (con el fix de auth y el sync manual). Si están en una versión vieja,
   actualizarlas a mano antes de que dependan del auto-updater.
4. **Decidir la versión del primer release real** (¿`0.1.0`, o saltar a `1.0.0`
   para marcar "primera de producción"?). Decisión de negocio.

### B. Publicar la primera release

Correr `.\scripts\windows\publicar-release.ps1` (automatiza bump de versión + build
firmado + `latest.json`; NO crea la Release, eso es manual). Después:
`github.com/neaserisgod/mikioscoonline/releases/new`, tag `vX.Y.Z`, subir el
`*-setup.exe` + `dist/latest.json`. Detalle completo en `docs/actualizaciones-app.md`.

**Verificación:** `curl -I https://github.com/neaserisgod/mikioscoonline/releases/latest/download/latest.json`
debe dar `200` (hoy da `404`).

### C. Provisionar cada caja

1. Instalar con el `*-setup.exe` (por usuario, sin admin).
2. `config.env` en `%APPDATA%\ar.kioscoelbarrio.pos\`: generarlo con
   `scripts/gen-config-caja-nueva.mjs` (copia las credenciales reales desde
   `.env.local` — incluye `AUTH_GOOGLE_ID/SECRET`, MP, AFIP, `NEON_DATABASE_URL`).
3. Primer login con la cuenta Google real → gate de 0 ventas → `/vincular-caja`
   (trae todo desde Neon).
4. **Verificación:** hacer una venta de prueba, confirmar que descuenta stock,
   que factura si corresponde, y que aparece en Neon después de "Sincronizar ahora".

### D. Releases siguientes

- Sin cambio de schema: pasos 1–4 del runbook (`docs/actualizaciones-app.md`).
- Con cambio de schema: **paso 0 obligatorio primero** —
  `node scripts/gen-migracion-sqlite.mjs <nombre>` ANTES de actualizar
  `dev-template.db`, revisar el `.sql`, recién ahí `db push` a la plantilla y
  seguir el flujo normal.
- **Verificación post-release:** abrir una caja de prueba con una `dev.db` vieja,
  confirmar en los logs que aplicó la migración y arrancó bien.

### E. Seguridad y backup

- Cerrar A1 (backup automático) y A2 (rol de Neon acotado).
- **Caja perdida/robada:** hoy tiene `NEON_DATABASE_URL` en texto plano con acceso
  total a producción. El único plan actual sería rotar la contraseña del rol de
  Neon (lo que tira todas las cajas hasta reconfigurarlas). Con el rol acotado +
  RLS esto se vuelve mucho menos grave. Decidir antes de repartir más cajas.
- **Backups de la base central:** además del sync a Neon, ¿hay point-in-time
  recovery de Neon (plan pago)? Pendiente de revisar.

### F. Verificación post-deploy y rollback

- **Post-deploy:** abrir la app en una caja con internet y confirmar que detecta e
  instala la versión nueva sola (mismo test end-to-end del 22/07).
- **Rollback:** no hay mecanismo automático de "volver atrás" — el endpoint siempre
  sirve la última Release. Si una release sale mal: despublicar/borrar esa Release y
  re-publicar la anterior con su `latest.json`. (Conviene documentar esto en el
  runbook.)
