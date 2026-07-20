import Afip from "@afipsdk/afip.js"
import type { DatosFactura, FacturacionProvider, ResultadoFacturacion } from "./types"

// Tabla oficial ARCA — tipos de comprobante WSFE relevantes (facturas, no notas de crédito/débito).
// Claves iguales al TipoComprobante de fiscal.ts (determinarTipoComprobante).
const CBTE_TIPO: Record<string, number> = { FACTURA_A: 1, FACTURA_B: 6, FACTURA_C: 11 }

// Tabla oficial ARCA — "Condición frente al IVA del receptor" (RG 5616/2024).
// Mapea el mismo enum que ya usa el resto de la app (Organization.condicionIva,
// clienteSchema.condicionIVA): RESPONSABLE_INSCRIPTO | MONOTRIBUTO | EXENTO | CONSUMIDOR_FINAL.
const CONDICION_IVA_RECEPTOR: Record<string, number> = {
  RESPONSABLE_INSCRIPTO: 1,
  EXENTO: 4,
  CONSUMIDOR_FINAL: 5,
  MONOTRIBUTO: 6,
}

// Tabla oficial ARCA — alícuotas de IVA, % → Id.
const ALICUOTA_ID: Record<number, number> = { 0: 3, 10.5: 4, 21: 5, 27: 6, 5: 8, 2.5: 9 }

// Exportada solo para test (tests/integration/afip-provider.test.ts) — el
// comportamiento para quien la llama vía emitir() no cambia.
export function afipClient(modoProduccion: boolean): Afip {
  const CUIT = process.env.AFIP_CUIT
  const access_token = process.env.AFIP_ACCESS_TOKEN
  if (!CUIT || !access_token) {
    throw new Error("Faltan AFIP_CUIT / AFIP_ACCESS_TOKEN en el entorno — ver .env.example")
  }
  // Certificado solo en producción — homologación usa el CUIT de prueba de AfipSDK sin certificado.
  const cert = process.env.AFIP_CERT ? Buffer.from(process.env.AFIP_CERT, "base64").toString("utf8") : undefined
  const key = process.env.AFIP_PRIVATE_KEY ? Buffer.from(process.env.AFIP_PRIVATE_KEY, "base64").toString("utf8") : undefined

  // Organization.facturacionModoProduccion puede estar en true en la DB sin que
  // el proceso tenga cargadas las credenciales reales de producción (deploy
  // nuevo sin configurar, variable borrada por error). Antes esto degradaba en
  // silencio a homologación — el SDK defaultea production:false si no se le
  // pasa el flag (ver Afip.js) — y el negocio recibía un CAE de prueba como si
  // fuera real. Ahora se corta acá: facturacionService ya deja el Comprobante
  // en ERROR ante cualquier excepción de emitir(), así que esto se vuelve un
  // fallo visible y reintentable en vez de una factura trucha silenciosa
  // (ver docs/REPORTE-NUCLEO.md, hallazgo C3).
  if (modoProduccion && !(cert && key)) {
    throw new Error(
      "facturacionModoProduccion está activado pero faltan AFIP_CERT/AFIP_PRIVATE_KEY en el entorno — no se factura en homologación por error"
    )
  }

  return new Afip({
    CUIT: Number(CUIT),
    access_token,
    ...(cert && key ? { cert, key, production: modoProduccion } : {}),
  })
}

/** Fecha → yyyymmdd (formato que exige WSFE). */
function fechaWSFE(fecha: Date): number {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, "0")
  const d = String(fecha.getDate()).padStart(2, "0")
  return Number(`${y}${m}${d}`)
}

export class AfipFacturacionProvider implements FacturacionProvider {
  async emitir(datos: DatosFactura): Promise<ResultadoFacturacion> {
    const afip = afipClient(datos.modoProduccion)

    const cbteTipo = CBTE_TIPO[datos.tipo]
    if (!cbteTipo) throw new Error(`Tipo de comprobante desconocido: "${datos.tipo}"`)

    const condicionIVAReceptorId = CONDICION_IVA_RECEPTOR[datos.condicionIVACliente]
    if (!condicionIVAReceptorId) {
      throw new Error(`Condición de IVA de receptor desconocida: "${datos.condicionIVACliente}"`)
    }

    // WSFE quiere un renglón de IVA por alícuota, no por línea de producto.
    const porAlicuota = new Map<number, { neto: number; iva: number }>()
    for (const item of datos.items) {
      const acc = porAlicuota.get(item.alicuotaIVA) ?? { neto: 0, iva: 0 }
      acc.neto += item.netoCentavos
      acc.iva += item.ivaCentavos
      porAlicuota.set(item.alicuotaIVA, acc)
    }

    const esConsumidorFinal = !datos.cuitCliente

    const ivaItems = [...porAlicuota.entries()]
      .filter(([alicuota]) => alicuota > 0)
      .map(([alicuota, { neto, iva }]) => {
        const id = ALICUOTA_ID[alicuota]
        if (!id) throw new Error(`Alícuota de IVA sin mapear en la tabla ARCA: ${alicuota}%`)
        return { Id: id, BaseImp: neto / 100, Importe: iva / 100 }
      })

    const data = {
      PtoVta: datos.puntoVenta,
      CbteTipo: cbteTipo,
      Concepto: 1, // 1 = productos — este kiosco no factura servicios
      DocTipo: esConsumidorFinal ? 99 : 80,
      DocNro: esConsumidorFinal ? 0 : Number(datos.cuitCliente),
      CondicionIVAReceptorId: condicionIVAReceptorId,
      CbteFch: fechaWSFE(datos.fechaEmision),
      ImpTotal: datos.totalCentavos / 100,
      ImpTotConc: 0,
      ImpNeto: datos.subtotalCentavos / 100,
      ImpOpEx: 0,
      ImpIVA: datos.ivaTotalCentavos / 100,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      // AFIP rechaza el comprobante si se manda el objeto Iva (aunque sea vacío)
      // en un tipo C — un monotributista no discrimina IVA, no hay que informarlo.
      ...(ivaItems.length > 0 ? { Iva: ivaItems } : {}),
    }

    // createNextVoucher pide a AFIP el próximo número de comprobante y lo crea en el
    // mismo paso — evita el riesgo de dos ventas concurrentes pisándose el número
    // (que sí existiría si calculáramos "el número siguiente" nosotros a mano).
    try {
      const res = await afip.ElectronicBilling.createNextVoucher(data)

      return {
        cae: res.CAE,
        caeFechaVencimiento: new Date(res.CAEFchVto),
        numeroComprobante: res.voucherNumber,
      }
    } catch (e) {
      // AfipSDK (app.afipsdk.com, no AFIP directo) adjunta el detalle real de
      // un error HTTP al Error que tira axios: status/statusText/data — para
      // un 400, error.message queda en el genérico de axios ("Request failed
      // with status code 400"), la razón real vive en error.data.message. Se
      // relanza con esas propiedades explícitas (no solo confiar en que el
      // SDK las siga adjuntando en versiones futuras) para que
      // facturacionService las pueda persistir/loguear — antes se perdían
      // porque nada las leía más allá de e.message.
      const original = e as { message?: string; status?: number; statusText?: string; data?: unknown }
      const error = new Error(original?.message ?? "Error desconocido al llamar a AFIP") as Error & {
        status?: number; statusText?: string; data?: unknown
      }
      if (original?.status !== undefined) error.status = original.status
      if (original?.statusText !== undefined) error.statusText = original.statusText
      if (original?.data !== undefined) error.data = original.data
      throw error
    }
  }
}
