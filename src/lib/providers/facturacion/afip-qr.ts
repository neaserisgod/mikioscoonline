import QRCode from "qrcode"

// Códigos de tipo de comprobante WSFE — mismos que afip.ts (facturas, no notas de crédito/débito).
const CBTE_TIPO: Record<string, number> = { FACTURA_A: 1, FACTURA_B: 6, FACTURA_C: 11 }

export interface DatosQrAfip {
  fecha: Date
  cuit: string
  puntoVenta: number
  tipo: string // FACTURA_A | FACTURA_B | FACTURA_C
  numero: number
  totalCentavos: number
  cae: string
  cuitCliente?: string | null
}

/**
 * URL del QR obligatorio en todo comprobante electrónico (RG 4291) — al
 * escanearlo, AFIP muestra los datos del comprobante para que el cliente
 * pueda verificarlo.
 */
export function urlQrAfip(datos: DatosQrAfip): string {
  const payload = {
    ver: 1,
    fecha: datos.fecha.toISOString().slice(0, 10),
    cuit: Number(datos.cuit),
    ptoVta: datos.puntoVenta,
    tipoCmp: CBTE_TIPO[datos.tipo] ?? 11,
    nroCmp: datos.numero,
    importe: datos.totalCentavos / 100,
    moneda: "PES",
    ctz: 1,
    tipoDocRec: datos.cuitCliente ? 80 : 99,
    nroDocRec: datos.cuitCliente ? Number(datos.cuitCliente) : 0,
    tipoCodAut: "E",
    codAut: Number(datos.cae),
  }
  const base64 = Buffer.from(JSON.stringify(payload)).toString("base64")
  return `https://www.afip.gob.ar/fe/qr/?p=${base64}`
}

/** Imagen del QR como data URL PNG, lista para <img src=...> en el ticket. */
export async function qrAfipDataUrl(datos: DatosQrAfip): Promise<string> {
  return QRCode.toDataURL(urlQrAfip(datos), { margin: 1, width: 200 })
}
