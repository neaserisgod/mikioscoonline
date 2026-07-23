# Prompt para una sesión nueva de Claude Code — App de escritorio con auto-update

Copiá todo el bloque de abajo como primer mensaje en una sesión limpia de Claude Code
dentro de este repo.

---

Contexto del proyecto
----------------------
Repo: pyme-ventas (POS/caja para "Kiosco El Barrio"). GitHub: neaserisgod/mikioscoonline.
Es un Next.js 16 (App Router) + Prisma + SQLite local, empaquetado como app de
escritorio Windows con Tauri v2 en la carpeta `src-tauri/`. El shell Tauri levanta
el server Next standalone (`node server.js`) en 127.0.0.1:3210 y navega el webview
a http://localhost:3210. La base y la config del kiosco viven en
%APPDATA%\ar.kioscoelbarrio.pos (dev.db + config.env).

IMPORTANTE: leé primero AGENTS.md — este Next.js tiene breaking changes respecto a
lo que conocés, consultá node_modules/next/dist/docs/ antes de tocar código Next.

Objetivo
--------
Dejar la app de escritorio como "una app como cualquier otra": se instala con un
instalador, tiene su ícono/ventana, y se ACTUALIZA SOLA cuando publico una versión
nueva. Debe verse EXACTAMENTE igual a la web (es el mismo Next.js en un webview, así
que esto ya está garantizado; no reescribas la UI).

Estado actual (ya scaffoldeado, verificá y completá)
----------------------------------------------------
Ya se agregó el auto-updater de Tauri, pero NO está buildeado ni testeado:
- src-tauri/Cargo.toml: dependencia `tauri-plugin-updater = "2"`.
- src-tauri/tauri.conf.json: bloque plugins.updater (endpoint = GitHub Releases
  "latest" del repo) + bundle.createUpdaterArtifacts:true. El campo `pubkey` tiene
  un PLACEHOLDER que hay que reemplazar.
- src-tauri/src/lib.rs: fn `apply_update_if_available` que chequea updates al
  arranque ANTES de spawnear node (para no dejar el server huérfano en el puerto),
  y registra el plugin en el builder.
- scripts/gen-latest-json.mjs: genera dist/latest.json desde el instalador buildeado.
- docs/actualizaciones-app.md: runbook completo.

Tareas
------
1. Revisá lib.rs, tauri.conf.json y Cargo.toml y confirmá que compilan; corregí
   cualquier error de la API del updater de Tauri v2 (firmas de updater_builder(),
   check(), download_and_install(), restart()).
2. Generá el par de claves de firma (`npx tauri signer generate`) y pegá la clave
   pública en tauri.conf.json (reemplazá el placeholder). La privada NO va al repo.
3. Buildeá firmado en Windows: `npm run build:standalone` y luego `npx tauri build`
   con las env vars TAURI_SIGNING_PRIVATE_KEY(_PASSWORD). Resolvé lo que falle.
4. Verificá que el instalador arranca la app y se ve idéntica a la web, que la DB y
   config locales persisten, y que al haber una versión mayor publicada la app se
   actualiza sola al abrir (probá el flujo update de punta a punta con una v0.1.0 -> v0.1.1).
5. Documentá cualquier ajuste en docs/actualizaciones-app.md.

Restricciones
-------------
- El build final es en Windows (necesita Rust). No rompas el flujo actual del server.
- Nunca subas secretos: .env.local ni la clave privada de firma van a GitHub.
- Las actualizaciones NO deben pisar dev.db ni config.env del usuario (viven en APPDATA).
- No cambies la UI ni el look; el requisito es que quede igual a la web.

Entregable
----------
App instalable + auto-update funcionando y probado, con el runbook actualizado.
