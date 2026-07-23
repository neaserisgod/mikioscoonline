# Prompt para Claude Code — pasos a seguir en producción

Copiá el bloque de abajo como primer mensaje en una sesión de Claude Code dentro
de este repo (en tu Windows, con acceso a las cajas / a `origin`).

---

Sos mi guía de puesta en producción de la app de escritorio del kiosco. NO quiero
que escribas features ni cambies código todavía — quiero que primero **revises el
estado real** del repo y de la app, y después me des un **checklist ordenado,
concreto y accionable** de los pasos a seguir para poner esto en producción bien.

Contexto: pyme-ventas, POS "Kiosco El Barrio". Next.js 16 + Prisma + SQLite local,
empaquetado con Tauri v2 (`src-tauri/`) como app Windows con auto-update por GitHub
Releases (repo neaserisgod/mikioscoonline). Hay varias cajas físicas, cada una con
su `dev.db` y `config.env` en %APPDATA%\ar.kioscoelbarrio.pos.

Leé primero, en este orden, y basá TODO en lo que encuentres (no en supuestos):
1. AGENTS.md
2. docs/actualizaciones-app.md (runbook de release + migraciones + sync)
3. docs/resumen-sesion-2026-07-22-app-escritorio.md (estado y pendientes)
4. src-tauri/tauri.conf.json (versión actual, endpoint, ¿pubkey real o placeholder?)
5. src-tauri/src/lib.rs (apply_pending_migrations, apply_update_if_available)
6. src/app/actions/sincronizar-caja.actions.ts y scripts/lib/kiosco-sync.ts

Antes de darme los pasos, verificá y decime el estado de cada cosa (✅/❌/⚠️):
- ¿`tauri.conf.json` tiene la clave pública real pegada o quedó el placeholder?
- ¿Qué versión declara la app hoy y hay alguna Release publicada en GitHub? ¿El
  `latest.json` del endpoint resuelve?
- ¿`main` está en sync con `origin/main` y el working tree limpio?
- ¿La `dev-template.db` empaquetada está al día con `prisma/schema.dev.prisma`
  (sin migraciones pendientes sin generar)?
- ¿La credencial `NEON_DATABASE_URL` que va en las cajas usa un rol de Neon de
  privilegio mínimo, o todavía es el rol full? (pendiente de seguridad conocido:
  RLS/rol acotado documentado pero NO aplicado — decime cómo cerrarlo).

Después dame el checklist de producción, agrupado en:
A. Pre-flight (qué confirmar/arreglar antes de publicar la primera release real).
B. Publicar la primera release (pasos exactos, con los comandos del runbook).
C. Provisionar cada caja (config.env con credenciales, NEON_DATABASE_URL, primer
   vínculo con /vincular-caja, verificación de que vende y factura).
D. Releases siguientes (incluyendo el caso con cambio de schema → migración SQLite).
E. Seguridad y respaldo (cerrar lo del rol de Neon, backups, qué hacer si una caja
   se pierde/roba dado que tiene credencial de prod).
F. Verificación post-deploy y plan de rollback si una release sale mal.

Para cada paso: qué comando/acción exacta, en qué máquina se hace, y cómo verifico
que salió bien. Marcá claramente lo que es bloqueante vs. lo que puede esperar.
NO ejecutes nada que publique releases, toque las cajas o mueva dinero sin
confirmarme antes — primero el plan, después lo hacemos juntos paso a paso.
