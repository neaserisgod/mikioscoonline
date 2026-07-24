# Prompt para Claude Code (correr en la PC Windows)

Copiá y pegá esto en Claude Code, parado en la raíz del repo `pyme-ventas`.

---

Trabajá sobre este repo (Next.js 16 + Tauri, app de escritorio "Kiosco El
Barrio"). En una sesión anterior se pulió la descarga y la actualización de la
app. Tu tarea es **verificar que todo compila y funciona en Windows** y, si está
todo verde, **publicar la primera release con el flujo nuevo**.

## Contexto de lo que ya se cambió (no lo rehagas, solo verificalo)

- `src-tauri/tauri.conf.json`: la versión se alineó de `0.1.0` a `1.0.2` para
  que coincida con `package.json` y los tags git (el updater compara ese
  número).
- `src/lib/descarga.ts`: helper que consulta la API de GitHub Releases y
  devuelve el instalador `-setup.exe` de la última release (cacheado 5 min).
- `src/app/descargar/page.tsx`: página pública de descarga (versión, botón,
  instrucciones).
- `src/app/descargar/exe/route.ts`: link estable que redirige (307) al
  instalador más nuevo.
- `src/app/page.tsx`: se agregó el link "Descargar app" en header y hero.
- `scripts/release.mjs` + npm script `release`: publica una versión en un solo
  comando (sube versión en los dos archivos, buildea firmado, genera
  `latest.json`, commitea el bump y crea la Release con `gh` si está).
- Docs: `docs/actualizaciones-app.md` y `README.md`.

## Paso 1 — Verificación (obligatorio, no publiques si algo falla)

1. `npx tsc --noEmit` → sin errores.
2. `npm run lint` → sin errores nuevos en los archivos de arriba.
3. `npm run build` (o `npm run build:standalone`) → que compile la web,
   incluida la ruta `/descargar`.
4. Levantá `npm run dev` y abrí `http://localhost:3000/descargar`: confirmá que
   la página renderiza y que el botón apunta al `.exe` de la última release (o,
   si todavía no hay ninguna release publicada, que cae a la página de releases
   de GitHub sin romper). Probá también `http://localhost:3000/descargar/exe`.

Si algo de esto falla, arreglalo (revisá imports, tipos, y el `render` prop del
componente `Button` de Base UI) y volvé a correr hasta que quede verde. No
avances al paso 2 con errores.

## Paso 2 — Publicar la primera release con el flujo nuevo (solo si el paso 1 pasó)

Requisitos: tener la clave privada de firma (`%USERPROFILE%\.tauri\kiosco.key`)
y, opcionalmente, GitHub CLI (`gh auth status` OK) para que suba los assets solo.

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $env:USERPROFILE\.tauri\kiosco.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "tu-password-o-vacio"

npm run release 1.0.3 "Página de descarga y actualización pulida"
```

Confirmá que:
- Quedó una Release `v1.0.3` en GitHub con dos assets: el `*-setup.exe` y
  `latest.json`.
- Instalás ese `-setup.exe` en una PC de prueba, y al reabrir la app, si después
  publicás una `v1.0.4`, se actualiza sola.

Si NO cambiaste `prisma/schema.dev.prisma`, no hace falta nada más. Si lo
cambiaste, seguí primero el "paso 0" de `docs/actualizaciones-app.md` (generar la
migración SQLite) antes de `npm run release`.

Al terminar, resumime qué verificaste, qué salió y el link de la Release.
