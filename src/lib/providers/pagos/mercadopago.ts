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

// MercadoPago exige X-Idempotency-Key en este endpoint igual que en la
// creación de la orden — sin él responde 400 empty_required_header. Además,
// una vez que la order ya llegó a la terminal física (status "at_terminal" —
// lo normal para cuando alguien realmente llega a cancelar, porque ya está
// mostrando "acercar tarjeta") hace falta el header
// x-allow-cancelable-status: at_terminal; sin él, MP solo cancela orders que
// todavía están en status "created" (409 cannot_cancel_order en cualquier
// otro caso) y la cancelación nunca llega al dispositivo. Mandamos el header
// siempre — no molesta cuando la order sigue en "created".
async function cancelarOrden(orderId: string): Promise<void> {
  await mpFetch(`/v1/orders/${orderId}/cancel`, {
    method: "POST",
    headers: {
      "X-Idempotency-Key": crypto.randomUUID(),
      "x-allow-cancelable-status": "at_terminal",
    },
  })
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

    const body = await mpFetch("/v1/orders", {
      method: "POST",
      headers: { "X-Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        type: "qr",
        external_reference: datos.externalReference,
        total_amount: monto,
        expiration_time: `PT${datos.expiracionMinutos}M`,
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
          // Sin esto, la terminal deja elegir entre tarjeta y QR — lo fijamos en
          // tarjeta para que vaya directo a "apoyar" sin pantalla de selección.
          payment_method: {
            default_type: "credit_card",
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
    await cancelarOrden(orderId)
  }

  // El external_pos_id de QR puede estar atado a una terminal Point real
  // (compartida con posnet) en vez de a un POS suelto sin dispositivo — en
  // ese caso la terminal también queda mostrando algo en pantalla hasta que
  // se cancela de verdad. Mismo endpoint que posnet.
  async cancelarOrdenQr(orderId: string): Promise<void> {
    await cancelarOrden(orderId)
  }
}
