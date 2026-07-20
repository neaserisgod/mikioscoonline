import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import { resolve } from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    // Arma una sqlite descartable (schema real, Prisma real) una sola vez antes
    // de toda la suite — ver tests/helpers/global-setup.ts. Nunca toca Neon.
    globalSetup: ["./tests/helpers/global-setup.ts"],
    // Los tests de integración comparten un único archivo sqlite (better-sqlite3,
    // una sola conexión por proceso) — correr archivos de test en paralelo
    // dispararía SQLITE_BUSY entre workers. La suite es chica, el costo es bajo.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
