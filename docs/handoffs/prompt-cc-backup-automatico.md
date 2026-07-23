# Prompt para Claude Code — A1: backup automático en la app Tauri

Copiá el bloque de abajo como primer mensaje en una sesión de Claude Code en tu
Windows (con Rust para poder buildear/testear).

---

Contexto: pyme-ventas, POS "Kiosco El Barrio". Next.js 16 + Prisma + SQLite local,
empaquetado con Tauri v2 (`src-tauri/`). Ver `docs/pasos-produccion.md` y
`docs/actualizaciones-app.md`. Leé AGENTS.md primero (este Next.js tiene breaking
changes; consultá node_modules/next/dist/docs/ antes de tocar Next).

Problema a resolver (bloqueante de producción): la app Tauri **no respalda las
ventas sola**. `src-tauri/src/lib.rs` nunca dispara ningún backup/sync; el scheduler
nocturno (`scripts/kiosco-backup-scheduler.mjs`) lo lanzaba solo el lanzador viejo
`scripts/windows/start-kiosco.ps1`, que ya no se usa. Hoy `subirCambiosLocales`
(`scripts/lib/kiosco-sync.ts`) solo corre desde el botón manual "Sincronizar ahora"
(`src/app/actions/sincronizar-caja.actions.ts`) o el CLI `kiosco-backup-once.ts`.
Resultado: si nadie aprieta el botón, la caja nunca sube sus ventas a Neon y una
pérdida de la PC = pérdida de ventas.

Objetivo: que cada caja Tauri **suba sus ventas a Neon automáticamente**, sin
depender de que el operador se acuerde.

Diseño recomendado (evaluá y proponé mejor si lo ves):
- **Upload-only.** Reusar `subirCambiosLocales` (la mitad segura del sync): sube y
  nunca baja/borra nada local → riesgo cero de pisar datos. NO reuses la bajada.
- **Endpoint interno en el server Next** (no correr `.ts` con tsx en runtime: tsx es
  devDependency y no está en el bundle standalone; la lógica ya compilada en el
  server sí está disponible). Crear una API route protegida (solo localhost / con un
  token compartido que el shell conozca) que ejecute `subirCambiosLocales` para la
  organización de la caja. Fijate cómo `sincronizarCajaAction` arma el cliente de
  Neon (`NEON_DATABASE_URL`) y resuelve `organizationId` para reusar ese patrón.
- **Timer en `lib.rs`** (hilo con loop + sleep, mismo estilo que el resto del
  archivo): que llame a ese endpoint (a) poco después de arrancar, (b) cada N
  minutos mientras la app corre (empezá con 10 min, configurable), y (c) best-effort
  al cerrar la ventana (ya hay un handler `CloseRequested` que mata el child — hacer
  el intento de subida ANTES del kill, con timeout corto para no colgar el cierre).
- **Offline-safe:** si Neon no responde, logear y reintentar en el próximo intervalo;
  nunca trabar el arranque ni el cierre.

Restricciones:
- No romper el flujo actual (updater, spawn del server, migraciones).
- No tocar la UI. La app se ve igual que la web.
- No exponer el endpoint de backup a la red: solo localhost / autenticado.
- Nada de secretos al repo.

Criterios de aceptación (probar en Windows):
1. Con la app abierta y sin tocar nada, tras el intervalo las ventas locales
   aparecen en Neon.
2. Cerrar la app dispara una última subida (si hay red).
3. Sin internet, la app abre, funciona y cierra normal; al volver la red, el
   siguiente ciclo sube lo pendiente.
4. Es upload-only: correrlo no modifica ni borra ninguna fila local.
5. `cargo check` limpio y `npx tauri build` genera el instalador.

Entregable: backup automático funcionando y probado, documentado en
`docs/actualizaciones-app.md` (o donde corresponda). Actualizá el estado del punto
A1 en `docs/pasos-produccion.md`. Commiteá; no pushees sin confirmarme.
