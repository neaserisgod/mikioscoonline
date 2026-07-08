# Arranca el servidor local (si no está corriendo) y abre la app en una
# ventana de Edge en modo "app" (sin barra de direcciones — se siente nativa,
# no depende de instalar la PWA a mano). Pensado para correr solo al prender
# la PC del kiosco (ver start-kiosco.vbs + carpeta de Inicio de Windows).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null

$puertoEnUso = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $puertoEnUso) {
    Start-Process -FilePath "node" `
        -ArgumentList "scripts/start-local-server.mjs" `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$root\logs\server.log" `
        -RedirectStandardError "$root\logs\server-error.log"
}

# Espera a que el server realmente responda (hasta ~20s) antes de abrir la ventana.
$listo = $false
for ($i = 0; $i -lt 20; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/login" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $listo = $true; break }
    } catch {
        Start-Sleep -Seconds 1
    }
}

$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" }

Start-Process -FilePath $edge -ArgumentList "--app=http://localhost:3000/inicio"
