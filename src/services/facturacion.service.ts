import { prisma } from "@/lib/prisma"
import { getFacturacionProvider } from "@/lib/providers/facturacion"
import type { DatosFactura } from "@/lib/providers/facturacion"
import { determinarTipoComprobante, type CondicionIVA } from "@/lib/fiscal"

export const facturacionService = {
  /**
   * Emite (o reintenta) el comprobante fiscal de una venta. Nunca lanza — si
   * AFIP falla o faltan datos, deja el Comprobante en estado ERROR con el
   * motivo, para poder reintentar después desde el historial de ventas. Se
   * puede llamar varias veces sobre la misma venta sin efecto duplicado: si
   * ya está EMITIDO, no vuelve a pedir un comprobante nuevo a AFIP.
   */
  async facturarVenta(saleId: string, organizationId: string): Promise<void> {
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, organizationId },
      include: { lines: true, customer: true, organization: true, comprobante: true },
    })
    if (!sale) return
    if (sale.comprobante?.estado === "EMITIDO") return

    const org = sale.organization
    const faltanDatosFiscales = !org.cuit || !org.puntoDeVenta || !org.condicionIva
    if (faltanDatosFiscales) {
      await guardarError(sale.id, organizationId, sale, "Faltan datos fiscales del negocio (CUIT, punto de venta o condición de IVA) — completalos en Configuración > Negocio")
      return
    }

    const emisorCondicion = org.condicionIva as CondicionIVA
    // El Customer no tiene condición de IVA propia todavía — no hace falta:
    // determinarTipoComprobante ya da FACTURA_C para cualquier cliente cuando
    // el emisor es MONOTRIBUTO (el caso real de este negocio), sea quien sea el cliente.
    const tipo = determinarTipoComprobante(emisorCondicion, "CONSUMIDOR_FINAL")

    // Factura C (monotributista) no discrimina IVA — todo el importe es "neto"
    // sin alícuota. El recargo de cigarrillos (si lo hay) se suma al total: es
    // plata real que pagó el cliente por esta operación.
    const totalCentavos = sale.totalCentavos + sale.recargoCentavos

    const datos: DatosFactura = {
      tipo,
      puntoVenta: org.puntoDeVenta!,
      numero: 0, // lo asigna AFIP con createNextVoucher — este valor no se usa para eso
      fechaEmision: sale.fecha,
      cuit: org.cuit!,
      razonSocial: org.nombre,
      condicionIVAEmisor: emisorCondicion,
      // El Customer todavía no tiene CUIT propio — siempre se emite a Consumidor Final.
      razonSocialCliente: sale.customer?.nombre ?? "Consumidor Final",
      condicionIVACliente: "CONSUMIDOR_FINAL",
      items: [
        {
          descripcion: `Venta ${sale.id}`,
          cantidad: 1,
          precioUnitarioCentavos: totalCentavos,
          alicuotaIVA: 0,
          netoCentavos: totalCentavos,
          ivaCentavos: 0,
          subtotalCentavos: totalCentavos,
        },
      ],
      subtotalCentavos: totalCentavos,
      ivaTotalCentavos: 0,
      totalCentavos,
      modoProduccion: org.facturacionModoProduccion,
    }

    try {
      const resultado = await getFacturacionProvider().emitir(datos)
      await prisma.comprobante.upsert({
        where: { saleId: sale.id },
        create: {
          saleId: sale.id,
          organizationId,
          tipo,
          puntoVenta: org.puntoDeVenta!,
          numero: resultado.numeroComprobante,
          cae: resultado.cae,
          caeFechaVencimiento: resultado.caeFechaVencimiento,
          estado: "EMITIDO",
          error: null,
          cuitCliente: null,
          razonSocialCliente: datos.razonSocialCliente,
          condicionIVACliente: datos.condicionIVACliente,
          subtotalCentavos: datos.subtotalCentavos,
          ivaTotalCentavos: datos.ivaTotalCentavos,
          totalCentavos: datos.totalCentavos,
        },
        update: {
          numero: resultado.numeroComprobante,
          cae: resultado.cae,
          caeFechaVencimiento: resultado.caeFechaVencimiento,
          estado: "EMITIDO",
          error: null,
        },
      })
    } catch (e) {
      await guardarError(sale.id, organizationId, sale, e instanceof Error ? e.message : "Error desconocido al facturar")
    }
  },
}

async function guardarError(
  saleId: string,
  organizationId: string,
  sale: { totalCentavos: number; recargoCentavos: number },
  mensaje: string
) {
  const totalCentavos = sale.totalCentavos + sale.recargoCentavos
  await prisma.comprobante.upsert({
    where: { saleId },
    create: {
      saleId,
      organizationId,
      tipo: "FACTURA_C",
      puntoVenta: 0,
      estado: "ERROR",
      error: mensaje,
      razonSocialCliente: "Consumidor Final",
      condicionIVACliente: "CONSUMIDOR_FINAL",
      subtotalCentavos: totalCentavos,
      ivaTotalCentavos: 0,
      totalCentavos,
    },
    update: { estado: "ERROR", error: mensaje },
  })
}
