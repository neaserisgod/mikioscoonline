import type { PagosProvider } from "./pagos.interface"

// Mock de MercadoPago para desarrollo y tests.
// Simula aprobación inmediata con comisión de 3.99%.

export const mpMock: PagosProvider = {
  async crearPago({ montoCentavos, descripcion, referencia }) {
    return {
      externalId: `mock_${Date.now()}_${referencia}`,
      linkPago: `https://www.mercadopago.com.ar/checkout/mock?amount=${montoCentavos}`,
      estado: "acreditado",
    }
  },

  async consultarComision(externalId) {
    // Simula comisión real = 3.99%
    // En producción: GET https://api.mercadopago.com/v1/payments/{id}
    // TODO: implementar con MP_ACCESS_TOKEN cuando PAGOS_PROVIDER="mercadopago"
    void externalId
    return {
      comisionRealCentavos: 0, // se completa en la implementación real
      estado: "acreditado",
    }
  },
}

export function getPagosProvider(): PagosProvider {
  if (process.env.PAGOS_PROVIDER === "mercadopago") {
    // TODO: importar mp.adapter cuando esté implementado
    throw new Error("Adaptador MercadoPago no implementado aún. Configurar MP_ACCESS_TOKEN y crear mp.adapter.ts")
  }
  return mpMock
}
