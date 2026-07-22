# Arma un paquete instalable del kiosco para llevar a otra PC: exporta el
# repo tal cual está en HEAD (git archive, respeta .gitignore — no arrastra
# node_modules/.next/dev.db/etc.) y le agrega .env.local (no versionado, pero
# necesario: son las mismas credenciales de Neon/MercadoPago/AFIP que usa
# este negocio en la caja principal). Correrlo desde la raíz del repo o desde
# cualquier lado, da igual — resuelve la raíz solo.
#
# OJO: el .zip resultante contiene secretos reales (DATABASE_URL de
# producción, token de MercadoPago, clave privada de AFIP). Transferir solo
# por USB o red local de confianza — nunca por mail, chat, ni subirlo a un
# servicio en la nube.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if (-not (Test-Path (Join-Path $root ".env.local"))) {
    Write-Error ".env.local no existe en $root — hace falta para que el kiosco tenga las credenciales de Neon/MercadoPago/AFIP."
    exit 1
}

$fecha = Get-Date -Format "yyyyMMdd-HHmm"
$distDir = Join-Path $root "dist"
$staging = Join-Path $distDir "kiosco-paquete-$fecha"
$tempZip = Join-Path $distDir "_archive-$fecha.zip"
$zipPath = Join-Path $distDir "kiosco-paquete-$fecha.zip"

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }

$commitCorto = git rev-parse --short HEAD
Write-Host "Exportando el repo -- HEAD, commit $commitCorto ..."
git archive --format=zip -o $tempZip HEAD
Expand-Archive -Path $tempZip -DestinationPath $staging -Force
Remove-Item -Force $tempZip

Write-Host "Copiando .env.local..."
Copy-Item (Join-Path $root ".env.local") (Join-Path $staging ".env.local")

Write-Host "Comprimiendo a $zipPath..."
if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item -Recurse -Force $staging

Write-Host ""
Write-Host "== Listo: $zipPath =="
Write-Host "Contiene secretos reales — pasalo a la otra PC solo por USB o red local, nunca por mail/nube."
Write-Host "En la PC de destino: descomprimir en cualquier carpeta y correr, desde adentro:"
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts\windows\instalar-kiosco.ps1"
