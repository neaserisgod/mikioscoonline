import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // dev:local (LOCAL_DEV=1 + sqlite file:./dev.db), NUNCA "npm run dev" a secas —
  // sin LOCAL_DEV, DATABASE_URL cae en .env.local, que apunta a Neon PRODUCCIÓN
  // real. Un e2e corriendo contra prod podría registrar ventas reales y, con
  // facturacionModoProduccion=true, hasta emitir un CAE real no anulable.
  webServer: {
    command: "npm run dev:local",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
