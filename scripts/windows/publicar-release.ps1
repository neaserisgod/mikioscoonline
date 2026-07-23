# Automatiza los pasos LOCALES para publicar una actualización de la app de
# escritorio (ver docs/actualizaciones-app.md): sube la versión en
# tauri.conf.json, buildea firmado, y genera dist/latest.json. NO crea la
# Release en GitHub — ese último paso queda manual a propósito (subir algo
# público no debería pasar sin que lo mires antes).
#
# Uso (desde la raíz del repo):
#   .\scripts\windows\publicar-release.ps1 -Version 0.1.1 -Notas "Arreglo de tickets"
#
# Requiere: la clave privada de firma en %USERPROFILE%\.tauri\kiosco.key
# (generada una sola vez con `npx tauri signer generate`, ver el runbook).

param(
    [Parameter(Mandatory=$true)][string]$Version,
    [string]$Notas = "Mejoras y correcciones."
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

$keyPath = "$env:USERPROFILE\.tauri\kiosco.key"
if (-not (Test-Path $keyPath)) {
    Write-Error "No existe $keyPath. Generá el par de claves primero (ver docs/actualizaciones-app.md, sección 'Generar el par de claves de firma')."
    exit 1
}

if ($Version -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "Versión inválida: '$Version'. Formato esperado X.Y.Z (ej. 0.1.1)."
    exit 1
}

$confPath = "src-tauri\tauri.conf.json"
$conf = Get-Content $confPath -Raw
$versionAnterior = if ($conf -match '"version":\s*"([^"]+)"') { $Matches[1] } else { "?" }

Write-Host "`n== Subiendo versión: $versionAnterior -> $Version ==" -ForegroundColor Cyan
$conf = $conf -replace '"version":\s*"[^"]+"', "`"version`": `"$Version`""
Set-Content -Path $confPath -Value $conf -NoNewline

Write-Host "`n== Build standalone de Next ==" -ForegroundColor Cyan
npm run build:standalone
if ($LASTEXITCODE -ne 0) { Write-Error "build:standalone falló."; exit 1 }

Write-Host "`n== Build firmado de Tauri ==" -ForegroundColor Cyan
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $keyPath -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npx tauri build
$buildExitCode = $LASTEXITCODE
Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY, Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
if ($buildExitCode -ne 0) { Write-Error "tauri build falló."; exit 1 }

Write-Host "`n== Generando latest.json ==" -ForegroundColor Cyan
node scripts/gen-latest-json.mjs $Version "$Notas"
if ($LASTEXITCODE -ne 0) { Write-Error "gen-latest-json.mjs falló."; exit 1 }

$nsisDir = "src-tauri\target\release\bundle\nsis"
$setup = Get-ChildItem $nsisDir -Filter "*-setup.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host "`n✅ Listo. Para publicar:" -ForegroundColor Green
Write-Host "   1. Andá a github.com/neaserisgod/mikioscoonline/releases/new"
Write-Host "   2. Tag: v$Version"
Write-Host "   3. Subí como assets:"
Write-Host "        $($setup.FullName)"
Write-Host "        $root\dist\latest.json"
Write-Host "   4. Publicá la release."
Write-Host "`nCada caja con internet va a verla sola en su próximo arranque."
