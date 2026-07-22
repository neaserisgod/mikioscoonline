# Instala el kiosco en esta PC: instala dependencias, compila la build
# standalone (webpack, no Turbopack — ver next.config.ts), crea la base local
# (kiosco.db) con los datos reales bajados de Neon, y deja el arranque
# automático al prender Windows + un acceso directo en el escritorio para
# probarlo ya mismo.
#
# Correr este script parado adentro de la carpeta ya descomprimida del
# paquete (el que arma empaquetar-kiosco.ps1), no copiarlo suelto a otro lado.
#
# Requisitos: Windows, conexión a internet (para instalar Node/paquetes y
# bajar los datos de Neon la primera vez), Google Chrome instalado.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

if (-not (Test-Path (Join-Path $root "package.json"))) {
    Write-Error "No se encontró package.json en $root. Este script tiene que vivir en scripts\windows\ dentro de la carpeta ya descomprimida del paquete del kiosco."
    exit 1
}

if (-not (Test-Path (Join-Path $root ".env.local"))) {
    Write-Error ".env.local no está en este paquete — sin las credenciales de Neon/MercadoPago/AFIP el kiosco no puede arrancar. Volvé a armar el paquete con empaquetar-kiosco.ps1 en la PC original."
    exit 1
}

# 1) Node.js
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host "No se encontró Node.js."
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        Write-Host "Instalando Node.js LTS con winget..."
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        Write-Host "`nNode.js instalado. Cerrá esta terminal y volvé a correr este script (PowerShell) para que tome el PATH nuevo."
        exit 0
    } else {
        Write-Error "No hay winget disponible en esta PC. Instalá Node.js LTS a mano desde https://nodejs.org y volvé a correr este script."
        exit 1
    }
}
Write-Host "Node.js detectado: $(node --version)"

# 2) Chrome (solo advertencia, no bloquea la instalación)
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) { $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) {
    Write-Warning "No se encontró Google Chrome instalado. Hace falta para que el kiosco abra su ventana — instalalo antes de usarlo (la instalación puede seguir igual)."
}

# 3) Dependencias
Write-Host "`n== Instalando dependencias (npm install) — puede tardar varios minutos =="
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install falló." }

# 4) Build standalone
Write-Host "`n== Compilando la build standalone =="
npm run build:standalone
if ($LASTEXITCODE -ne 0) { throw "npm run build:standalone falló." }

# 5) Base local del kiosco (solo la primera vez)
$kioscoDb = Join-Path $root "kiosco.db"
if (Test-Path $kioscoDb) {
    Write-Host "`nkiosco.db ya existe — se omite la creación/descarga inicial para no pisar datos. Si querés forzar una descarga nueva, borrá kiosco.db a mano y volvé a correr este script."
} else {
    Write-Host "`n== Creando la base local (kiosco.db) =="
    npm run db:push:kiosco
    if ($LASTEXITCODE -ne 0) { throw "db:push:kiosco falló." }

    Write-Host "`n== Bajando los datos reales desde Neon =="
    npm run kiosco:download-data
    if ($LASTEXITCODE -ne 0) { throw "kiosco:download-data falló." }
}

# 6) Arranque automático (Startup) + acceso directo en escritorio.
# Shortcuts, no copias del .vbs: start-kiosco.vbs resuelve su propia carpeta
# via WScript.ScriptFullName, y con un acceso directo (.lnk) apuntando al
# .vbs real, Windows resuelve esa ruta al ORIGINAL (acá, dentro del paquete
# instalado) en vez de a la carpeta del acceso directo.
$vbsOrigen = Join-Path $root "scripts\windows\start-kiosco.vbs"
$WshShell = New-Object -ComObject WScript.Shell

$startupDir = [Environment]::GetFolderPath("Startup")
$startupShortcut = $WshShell.CreateShortcut((Join-Path $startupDir "Mi Kiosco.lnk"))
$startupShortcut.TargetPath = $vbsOrigen
$startupShortcut.WorkingDirectory = $root
$startupShortcut.Save()
Write-Host "`nArranque automático configurado en: $startupDir"

$desktop = [Environment]::GetFolderPath("Desktop")
$desktopShortcut = $WshShell.CreateShortcut((Join-Path $desktop "Mi Kiosco.lnk"))
$desktopShortcut.TargetPath = $vbsOrigen
$desktopShortcut.WorkingDirectory = $root
$desktopShortcut.Description = "Mi Kiosco"
$desktopShortcut.Save()

Write-Host "`n== Listo =="
Write-Host "El kiosco va a arrancar solo la próxima vez que se prenda esta PC."
Write-Host "Para probarlo ahora sin reiniciar, hacé doble clic en 'Mi Kiosco' del escritorio."
