import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { version } from "./package.json";

// Identificador único de ESTE build — no el semver de package.json (que solo
// cambia cuando alguien se acuerda de bumpearlo). Se usa para el buildId de
// Next y para invalidar cachés atadas al build (persistencia de React Query,
// Service Worker — ver query-provider.tsx y sw-provider.tsx): cualquier deploy
// nuevo, aunque no toque package.json ni el código, tiene que descartar lo que
// haya quedado persistido/cacheado del build anterior.
//
// Se arma como `${base}-${timestamp}`: `base` identifica el commit (SHA de
// Vercel, o de git local, o la versión de package.json si no hay .git — ej.
// un build fuera de un checkout de git) y el timestamp garantiza que DOS
// builds seguidos del MISMO commit (típico en local, sin commitear entre
// medio) generen igual buster/CACHE_NAME distintos entre sí.
//
// Se calcula UNA sola vez por proceso: generateBuildId (abajo) y el valor
// expuesto al cliente vía `env` tienen que coincidir, así que no puede
// recalcularse por separado en cada uno.
function resolveBuildIdBase(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { cwd: __dirname }).toString().trim();
  } catch {
    return version;
  }
}
const BUILD_ID = `${resolveBuildIdBase()}-${Date.now()}`;

const nextConfig: NextConfig = {
  output: "standalone",
  generateBuildId: async () => BUILD_ID,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  // El file tracing no detecta el require dinámico del client de SQLite solo — hay que incluirlo a mano.
  outputFileTracingIncludes: {
    "/*": [
      "node_modules/.prisma/client-sqlite/**/*",
      "node_modules/@prisma/adapter-better-sqlite3/**/*",
      "node_modules/@prisma/driver-adapter-utils/**/*",
      "node_modules/@prisma/debug/**/*",
    ],
  },
  // Cache de navegación del router (RSC payload) — default es 0s para páginas
  // dinámicas (nuestro caso, todas ƒ). Valor conservador: ayuda en
  // atrás/adelante y navegación repetida sin arriesgar mostrar datos
  // desactualizados por más de unos segundos. El dato mostrado en pantalla de
  // todos modos depende de TanStack Query, que sí se invalida tras cada mutación.
  experimental: {
    staleTimes: { dynamic: 15, static: 180 },
  },
  // Sin esto, next dev bloquea el socket de HMR cuando se accede por una URL
  // que no sea exactamente "localhost" (ej. 127.0.0.1, o la IP de red que el
  // propio `next dev` imprime al arrancar) — la página carga pero queda sin
  // hidratar del todo: los inputs controlados por React siguen "funcionando"
  // (son nativos del navegador) pero el submit del form cae al comportamiento
  // nativo de HTML (GET con los campos como query string) en vez de ejecutar
  // el handler de React. Sin efecto en producción (allowedDevOrigins es
  // exclusivo de `next dev`).
  allowedDevOrigins: ["127.0.0.1"],
};

// IMPORTANTE: el build standalone para uso local/Tauri se hace con
// `npm run build:standalone` (usa `next build --webpack`), NO con `npm run build`
// (Turbopack, el default — el que sigue usando Vercel sin cambios). Con Turbopack,
// las páginas dinámicas que pasan por el chequeo de sesión (next-auth + Prisma)
// rompen en runtime standalone con "Cannot find module '@prisma/client-<hash>'"
// (bug conocido de esta versión de Next: https://github.com/prisma/prisma/issues/29025).
// Webpack no tiene este problema.

export default nextConfig;
