// Logger mínimo del servidor. Escribe a stderr/stdout (que en el kiosco van a
// logs/server-error.log / server.log — ver scripts/start-local-server.mjs), con
// un prefijo de scope y contexto serializable, para poder diagnosticar en
// producción los errores que a propósito no rompen la venta (facturación AFIP,
// impresión, webhooks de MercadoPago). No es para reemplazar un APM: es el
// mínimo para que un error tragado deje rastro.

type Meta = Record<string, unknown>

function serializar(meta?: Meta): string {
  if (!meta) return ""
  try {
    return " " + JSON.stringify(meta)
  } catch {
    return ""
  }
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

/** Error que NO debe romper el flujo pero sí quedar registrado. */
export function logError(scope: string, error: unknown, meta?: Meta): void {
  const ts = new Date().toISOString()
  console.error(`[${ts}] [error] [${scope}] ${mensajeError(error)}${serializar(meta)}`)
  if (error instanceof Error && error.stack) {
    console.error(error.stack)
  }
}

/** Aviso de algo inesperado pero no necesariamente un error. */
export function logWarn(scope: string, mensaje: string, meta?: Meta): void {
  const ts = new Date().toISOString()
  console.warn(`[${ts}] [warn] [${scope}] ${mensaje}${serializar(meta)}`)
}
