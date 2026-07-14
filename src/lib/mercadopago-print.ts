function formatearARS(centavos: number): string {
  return "$" + (centavos / 100).toLocaleString("es-AR", { minimumFractionDigits: 2 })
}

export interface DatosTicketImpresion {
  nombreNegocio: string
  cuit: string | null
  condicionIVA: string | null
  fecha: Date
  items: { descripcion: string; precioCentavos: number }[]
  /** Subtotal de productos, sin el recargo de cigarrillos (ver recargoCentavos). */
  totalCentavos: number
  /** Recargo por pagar cigarrillos con QR/Posnet (ver src/domain/recargo-cigarrillos.ts) — se discrimina aparte del total de productos. */
  recargoCentavos?: number
  // Presente solo si la venta ya tiene un comprobante AFIP EMITIDO al momento
  // de imprimir (ver impresionService — espera a la facturación primero).
  comprobante?: {
    tipoLabel: string
    puntoVenta: number
    numero: number
    cae: string
    caeFechaVencimientoLabel: string
    qrUrl: string
  }
}

/**
 * Imprime un tiquet en una terminal Point vía POST /terminals/v1/actions
 * (type: "print") — acción independiente de cualquier cobro, no requiere que
 * la venta se haya pagado con esa terminal. Usa el lenguaje de tags propio de
 * MercadoPago: {b} negrita, {w} letra grande, {s} chica, {center}, {br}.
 *
 * IMPORTANTE — verificado a mano contra una terminal Newland N950 real, no
 * documentado así por MercadoPago: el tag {left} en la práctica alinea el
 * texto a la DERECHA, y el texto sin ningún tag de alineación queda a la
 * izquierda por default. Se usa así a propósito acá abajo (descripción sin
 * tag = izquierda, precio con {left} = derecha) para lograr un layout de dos
 * líneas por ítem — no hay tag de columnas/tabla en esta API.
 */
export async function imprimirTicketEnPosnet(terminalId: string, datos: DatosTicketImpresion): Promise<void> {
  const lineasItems = datos.items
    .map((i) => `${i.descripcion}{br}{left}${formatearARS(i.precioCentavos)}{/left}{br}`)
    .join("")

  const datosEmisor =
    (datos.cuit ? `{center}{s}CUIT ${datos.cuit}${datos.condicionIVA ? ` - ${datos.condicionIVA}` : ""}{/s}{/center}{br}` : "")

  // Bloque de datos fiscales — solo si ya hay CAE. Incluye el QR de
  // verificación de AFIP (RG 4291), obligatorio en la representación impresa
  // de todo comprobante electrónico.
  const bloqueComprobante = datos.comprobante
    ? "--------------------------------{br}" +
      `${datos.comprobante.tipoLabel} Pto.Vta ${datos.comprobante.puntoVenta} Nro ${datos.comprobante.numero}{br}` +
      `CAE ${datos.comprobante.cae}{br}` +
      `Vto. CAE ${datos.comprobante.caeFechaVencimientoLabel}{br}` +
      `{center}{qr}${datos.comprobante.qrUrl}{/qr}{/center}{br}`
    : ""

  const totalConRecargo = datos.totalCentavos + (datos.recargoCentavos ?? 0)
  const lineaRecargo = datos.recargoCentavos
    ? `Recargo cigarrillos{br}{left}${formatearARS(datos.recargoCentavos)}{/left}{br}`
    : ""

  const content =
    `{center}{w}${datos.nombreNegocio}{/w}{/center}{br}` +
    datosEmisor +
    `{center}{s}${datos.fecha.toLocaleString("es-AR")}{/s}{/center}{br}` +
    "--------------------------------{br}" +
    lineasItems +
    lineaRecargo +
    "--------------------------------{br}" +
    `{left}{b}TOTAL ${formatearARS(totalConRecargo)}{/b}{/left}{br}` +
    bloqueComprobante +
    "{center}Gracias por su compra{/center}{br}"

  const res = await fetch("https://api.mercadopago.com/terminals/v1/actions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": crypto.randomUUID(),
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      type: "print",
      external_reference: `ticket_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      config: { point: { terminal_id: terminalId, subtype: "custom" } },
      content,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`MercadoPago Terminals API (${res.status}): ${body?.message ?? res.statusText}`)
  }
}
