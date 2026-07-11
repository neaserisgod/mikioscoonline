# Arranca el servidor local (si no está corriendo) contra kiosco.db — SQLite
# local con una copia de los datos reales (ver start-kiosco-server.mjs); login
# y MercadoPago siguen yendo a Neon, el resto queda instantáneo. También
# arranca el scheduler de backup nocturno (kiosco-backup-scheduler.mjs). SOLO
# si el server responde bien, abre la app en una ventana de Chrome en modo
# "app" — sin barra de direcciones, se siente nativa, no depende de instalar
# la PWA a mano. Pensado para correr solo al prender la PC del kiosco (ver
# start-kiosco.vbs + carpeta de Inicio de Windows), pero sirve igual para
# depurar a mano: corrarlo directo muestra en logs/server-error.log cualquier
# falla de arranque del servidor.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $root

New-Item -ItemType Directory -Force -Path "$root\logs" | Out-Null

$puertoEnUso = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $puertoEnUso) {
    Start-Process -FilePath "node" `
        -ArgumentList "scripts/start-kiosco-server.mjs" `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$root\logs\server.log" `
        -RedirectStandardError "$root\logs\server-error.log"
}

# Scheduler de backup nocturno (kiosco.db -> Neon a las 21:55) — proceso
# independiente, no bloquea ni depende de que el server ya haya respondido.
$schedulerCorriendo = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*kiosco-backup-scheduler.mjs*" }
if (-not $schedulerCorriendo) {
    Start-Process -FilePath "node" `
        -ArgumentList "scripts/kiosco-backup-scheduler.mjs" `
        -WorkingDirectory $root `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$root\logs\backup.log" `
        -RedirectStandardError "$root\logs\backup-error.log"
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

if (-not $listo) {
    $mensaje = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] El servidor local no respondió en http://localhost:3000/login tras 20s — no se abrió el navegador. Revisá logs\server-error.log."
    Add-Content -Path "$root\logs\server-error.log" -Value $mensaje
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "El servidor del kiosco no respondió a tiempo. Se guardó el detalle en logs\server-error.log.",
        "Mi Kiosco — error al iniciar",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
if (-not (Test-Path $chrome)) { $chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe" }

if (-not (Test-Path $chrome)) {
    Add-Content -Path "$root\logs\server-error.log" -Value "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] No se encontró chrome.exe en las rutas conocidas."
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        "El servidor arrancó bien, pero no se encontró Google Chrome instalado.",
        "Mi Kiosco — error al iniciar",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

Start-Process -FilePath $chrome -ArgumentList "--app=http://localhost:3000/inicio"
