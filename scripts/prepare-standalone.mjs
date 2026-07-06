import { cpSync, existsSync } from "node:fs"

// `output: "standalone"` no copia automáticamente `public/` ni `.next/static/`
// dentro de `.next/standalone/` — es un paso manual documentado por Next.js.
// Node puro (no `cp` de shell) para que funcione igual en Windows.
const STANDALONE_DIR = ".next/standalone"

if (!existsSync(STANDALONE_DIR)) {
  console.error(`❌ No existe ${STANDALONE_DIR} — corré "next build" primero`)
  process.exit(1)
}

cpSync("public", `${STANDALONE_DIR}/public`, { recursive: true })
cpSync(".next/static", `${STANDALONE_DIR}/.next/static`, { recursive: true })

console.log("✅ public/ y .next/static/ copiados a .next/standalone/")
