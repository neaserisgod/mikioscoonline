// Levanta el server standalone localmente pero contra los datos REALES de
// producción (Neon Postgres) — es la terminal de venta del negocio, tiene que
// mostrar los productos/ventas reales, no una base de pruebas. A diferencia
// de start-local-server.mjs (para desarrollo), acá NO se fuerza SQLite: se
// deja el DATABASE_URL que ya trae .env.local (el mismo que usa
// mikioscoonline.vercel.app). `createPrismaClient` (src/lib/prisma-client-factory.ts)
// elige el adapter de Postgres automáticamente en cuanto el DATABASE_URL no
// empieza con "file:".
import { loadEnvFiles } from "./lib/load-env.mjs"

const root = process.cwd()
loadEnvFiles(root)

process.env.NODE_ENV = "production"

// Ver la explicación completa en start-local-server.mjs: sin esto, Next arma
// el redirect_uri de Google (y cualquier URL absoluta) con el hostname de
// bind (0.0.0.0) en vez del Host real del navegador.
process.env.HOSTNAME = "localhost"

await import("../.next/standalone/server.js")
