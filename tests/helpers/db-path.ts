// Ruta fija (no aleatoria) para la sqlite de test: vitest globalSetup corre en un
// proceso separado de los workers que ejecutan los tests, así que coordinar por
// env var no es confiable — una ruta fija relativa (mismo formato que dev.db/
// kiosco.db) que todos calculan igual es más simple que pasar estado entre procesos.
export const TEST_DB_RELATIVE_PATH = "tests/.tmp/vitest-test.db"
export const TEST_DATABASE_URL = `file:./${TEST_DB_RELATIVE_PATH}`
