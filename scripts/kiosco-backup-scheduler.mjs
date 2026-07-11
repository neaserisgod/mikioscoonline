// Proceso de larga duración: dispara el backup de kiosco.db → Neon una vez al
// día a las 21:55 (hora local), corriendo scripts/kiosco-backup-once.ts como
// child process (así un fallo/cuelgue del backup no tumba el scheduler).
// Lanzado por scripts/windows/start-kiosco.ps1 en paralelo al server.
//
// Hora configurable para pruebas: KIOSCO_BACKUP_HORA / KIOSCO_BACKUP_MINUTO.
import { execFile } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import path from "node:path"

const root = process.cwd()
mkdirSync(path.join(root, "logs"), { recursive: true })
const MARKER = path.join(root, "logs", "ultimo-backup.txt")

const HORA = Number(process.env.KIOSCO_BACKUP_HORA ?? 21)
const MINUTO = Number(process.env.KIOSCO_BACKUP_MINUTO ?? 55)
const REINTENTO_MS = 15 * 60_000

let corriendo = false
let proximoIntentoPermitidoEn = 0

function pad(n) {
  return String(n).padStart(2, "0")
}

// Fecha LOCAL (no UTC) — 21:55 en Argentina (UTC-3) cae después de medianoche
// UTC, así que toISOString() daría la fecha de mañana y rompería la lógica de
// "ya corrió hoy" / catch-up cerca de la medianoche.
function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function yaSeCorrioHoy() {
  if (!existsSync(MARKER)) return false
  return readFileSync(MARKER, "utf-8").trim() === fechaLocal()
}

function pasoLaHora() {
  const n = new Date()
  return n.getHours() > HORA || (n.getHours() === HORA && n.getMinutes() >= MINUTO)
}

function correrBackup() {
  if (corriendo || Date.now() < proximoIntentoPermitidoEn) return
  corriendo = true
  console.log(`[${new Date().toISOString()}] Iniciando backup nocturno...`)

  execFile(
    "npx",
    ["tsx", "scripts/kiosco-backup-once.ts"],
    { cwd: root, shell: true, timeout: 15 * 60_000 },
    (err, stdout, stderr) => {
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)
      corriendo = false

      if (err) {
        console.error(`[${new Date().toISOString()}] Backup FALLÓ: ${err.message}. Reintenta en 15 min.`)
        proximoIntentoPermitidoEn = Date.now() + REINTENTO_MS
        return // no se marca como hecho -> queda reintentable
      }

      writeFileSync(MARKER, fechaLocal())
      console.log(`[${new Date().toISOString()}] Backup OK.`)
    }
  )
}

console.log(`[kiosco-backup-scheduler] arrancado — backup diario a las ${pad(HORA)}:${pad(MINUTO)}.`)

// Catch-up: si el proceso arranca después de la hora de hoy sin backup
// registrado (ej. la PC prendió tarde), correr de inmediato en vez de
// esperar hasta mañana.
if (pasoLaHora() && !yaSeCorrioHoy()) correrBackup()

setInterval(() => {
  if (pasoLaHora() && !yaSeCorrioHoy()) correrBackup()
}, 60_000)
