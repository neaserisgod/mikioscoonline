# Prompt para Claude Code — pendientes app de escritorio (post 2026-07-22)

Copiá el bloque de abajo como primer mensaje en una sesión limpia de Claude Code
dentro de este repo.

---

Contexto
--------
Repo: pyme-ventas (POS/caja "Kiosco El Barrio"). GitHub: neaserisgod/mikioscoonline.
Next.js 16 (App Router) + Prisma + SQLite local, empaquetado como app de escritorio
Windows con Tauri v2 (`src-tauri/`). El shell Tauri levanta `node server.js` en
127.0.0.1:3210 y muestra el webview; la base y la config de cada caja viven en
%APPDATA%\ar.kioscoelbarrio.pos (dev.db + config.env).

LEÉ PRIMERO, en este orden:
1. AGENTS.md (este Next.js tiene breaking changes; consultá node_modules/next/dist/docs/ antes de tocar Next).
2. docs/resumen-sesion-2026-07-22-app-escritorio.md (estado completo de la última sesión).
3. docs/actualizaciones-app.md (runbook de updates + vincular-caja).

Ya funciona y NO hay que rehacerlo: el auto-updater Tauri (via GitHub Releases,
probado de punta a punta) y `/vincular-caja` (pull inicial de una caja virgen desde
Neon). Los 3 commits de esa sesión están en `main` local, NO pusheados a origin.

Tareas (en orden de prioridad)
------------------------------

1. [PRINCIPAL] Botón de sincronización manual NO destructivo.
   Problema: `src/app/actions/vincular-caja.actions.ts` hace delete-all + reimport;
   solo es seguro en caja virgen (0 ventas) y NO sirve para re-sincronizar una caja
   en uso (pisaría ventas hechas offline que aún no subieron a Neon). La idea de
   sync "automático" quedó descartada a favor de un sync manual explícito.
   Hacer: un botón de "Sincronizar" que traiga novedades de Neon (catálogo, precios,
   proveedores, etc.) con upsert idempotente por id, SIN borrar filas que existen
   solo localmente, con política de conflicto clara por tabla (qué lado gana y en
   qué dirección viaja cada tabla — reference/catálogo baja de Neon; ventas/pagos
   locales NO se pisan). Separá "traer cambios de arriba" de "no perder lo de
   abajo"; no reuses el delete-all de `vincularCajaAction` tal cual.
   Criterio de aceptación: correr el sync en una caja CON ventas locales no borra ni
   modifica esas ventas, y sí actualiza el catálogo. Idempotente (correrlo dos veces
   seguidas no cambia nada la segunda vez).

2. Migraciones de schema en updates (rotura garantizada si no se resuelve).
   El auto-updater reemplaza el bundle pero nunca migra la dev.db ya instalada. La
   primera release que cambie el schema de Prisma rompe todas las cajas (ya pasó una
   vez con la plantilla, ver punto 2.2 del resumen). Ojo: correr migraciones dentro
   de la app empaquetada no es trivial (necesita los archivos de migración + engine
   en runtime, no basta con llamar al CLI). Candidato: aplicar migraciones en
   `src-tauri/src/lib.rs` antes de `spawn_node_server`. Diseñá e implementá esto.
   Criterio: instalar una versión con schema viejo, actualizar a una con schema
   nuevo, y que la caja arranque migrada sin perder datos.

3. Seguridad de la credencial de producción en las cajas.
   Ahora cada caja tiene `NEON_DATABASE_URL` (conexión directa a prod, lectura y
   escritura) en texto plano en config.env. (a) Confirmá que `resolverUsuarioGoogle`
   (src/lib/prisma-auth.ts) RECHAZA cuentas de Google que no estén en la organización
   — el gate de "0 ventas" es defensivo, no es authz; el authz real es el login.
   (b) Evaluá acotar esa credencial a un rol de Neon de menor privilegio para las
   cajas. Documentá conclusiones.

4. Verificación desde clone limpio.
   Como ya hubo un bug de "no se podía buildear desde un clone limpio" (dev-template.db
   sin committear), cloná el repo en limpio y confirmá que `npm ci` + `npm run
   build:standalone` + `npx tauri build` funcionan sin nada suelto en el working tree.

5. Push a origin.
   Nada de la última sesión se pusheó. Cuando lo de arriba esté verificado, pushear
   `main` a origin (confirmar antes que no haya secretos en el diff).

Menores (si sobra tiempo)
- Silenciar el tip promocional de dotenv (`quiet: true` / DOTENV_CONFIG_QUIET). Es
  autopromoción benigna del autor de dotenv, no malware (ver punto 2.4 del resumen).
- Edge case documentado en vincular-caja: corte justo copiando la tabla `sale` deja
  filas parciales que bloquean el reintento por UI. Hacer la importación
  transaccional o con limpieza automática ante fallo.

Restricciones
-------------
- Build final en Windows (necesita Rust). No rompas el flujo actual del server ni la UI.
- Nunca subir secretos: .env.local ni la clave privada de firma van a GitHub.
- Los updates y el sync NO deben pisar dev.db/config.env del usuario ni sus ventas locales.
- La app se ve igual que la web (mismo Next.js en webview); no reescribas UI.

Entregable
----------
Sync manual no destructivo + migraciones en update, ambos probados; conclusión de
seguridad documentada; build desde clone limpio verificado; commits pusheados.
