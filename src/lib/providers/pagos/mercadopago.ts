import type {
  DatosOrdenPosnet,
  DatosOrdenQr,
  DatosPago,
  EstadoOrdenMp,
  PagosProvider,
  ResultadoOrdenMp,
  ResultadoPago,
} from "./types"

const MP_API = "https://api.mercadopago.com"

function centavosAMontoStr(centavos: number): string {
  return (centavos / 100).toFixed(2)
}

async function mpFetch(path: string, init: RequestInit) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detalle = body?.message ?? body?.error ?? res.statusText
    throw new Error(`MercadoPago API (${res.status}): ${detalle}`)
  }
  return body
}

function estadoDesdeOrden(body: { status?: string; transactions?: { payments?: Array<{ status?: string }> } }, finalizadoStatuses: string[]): EstadoOrdenMp {
  const pagos = body?.transactions?.payments ?? []
  const pagado = body?.status === "processed" || pagos.some((p) => p.status === "approved")
  const finalizadoSinPago = !!body?.status && finalizadoStatuses.includes(body.status)
  return { pagado, finalizadoSinPago }
}

/**
 * Provider MercadoPago — QR dinámico y posnet (Point) vía la API de Orders
 * unificada (POST /v1/orders). Para QR (`type: "qr"`, `config.qr.mode: "hybrid"`)
 * el QR físico fijo de la caja no cambia, solo muestra el monto real de la
 * venta en curso. Para posnet (`type: "point"`) el monto se manda a una
 * terminal Point específica (`config.point.terminal_id`), que además requiere
 * cancelación explícita si el cliente no llega a pagar (la terminal queda
 * físicamente esperando la tarjeta hasta que la order se cancele o expire).
 * `crearLinkPago` (Checkout Pro remoto) queda sin implementar hasta que haga falta.
 */
export class MercadoPagoProvider implements PagosProvider {
  async crearLinkPago(_datos: DatosPago): Promise<ResultadoPago> {
    throw new Error(
      "MercadoPagoProvider.crearLinkPago no está implementado. " +
      "Usá PAGOS_PROVIDER=mock para desarrollo."
    )
  }

  async enviarMontoAQr(datos: DatosOrdenQr): Promise<ResultadoOrdenMp> {
    const monto = centavosAMontoStr(datos.montoCentavos)
    const expirationDate = new Date(Date.now() + datos.expiracionMinutos * 60_000).toISOString()

    const body = await mpFetch("/v1/orders", {
      method: "POST",
      headers: { "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        type: "qr",
        external_reference: datos.externalReference,
        total_amount: monto,
        expiration_date: expirationDate,
        config: {
          qr: {
            external_pos_id: datos.externalPosId,
            mode: "hybrid",
          },
        },
        transactions: {
          payments: [{ amount: monto }],
        },
        items: [
          {
            title: datos.descripcion.slice(0, 150),
            unit_price: monto,
            quantity: 1,
            unit_measure: "unit",
            total_amount: monto,
          },
        ],
      }),
    })

    return { orderId: body.id }
  }

  async consultarEstadoOrdenQr(orderId: string): Promise<EstadoOrdenMp> {
    const body = await mpFetch(`/v1/orders/${orderId}`, { method: "GET" })
    return estadoDesdeOrden(body, ["expired", "canceled"])
  }

  async enviarMontoAPosnet(datos: DatosOrdenPosnet): Promise<ResultadoOrdenMp> {
    const monto = centavosAMontoStr(datos.montoCentavos)

    const body = await mpFetch("/v1/orders", {
      method: "POST",
      headers: { "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        type: "point",
        external_reference: datos.externalReference,
        expiration_time: `PT${datos.expiracionMinutos}M`,
        transactions: {
          payments: [{ amount: monto }],
        },
        config: {
          point: {
            terminal_id: datos.terminalId,
            print_on_terminal: "no_ticket",
          },
        },
        description: datos.descripcion.slice(0, 150),
      }),
    })

    return { orderId: body.id }
  }

  async consultarEstadoOrdenPosnet(orderId: string): Promise<EstadoOrdenMp> {
    const body = await mpFetch(`/v1/orders/${orderId}`, { method: "GET" })
    return estadoDesdeOrden(body, ["failed", "expired", "canceled"])
  }

  async cancelarOrdenPosnet(orderId: string): Promise<void> {
    await mpFetch(`/v1/orders/${orderId}/cancel`, { method: "POST" })
  }
}
