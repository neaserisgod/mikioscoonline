import { prisma } from "@/lib/prisma"
import { resolverCajaId } from "@/domain/cajas"
import { subtotalLinea } from "@/domain/pesables"

export type AgrupadorRentabilidad = "proveedor" | "heladera" | "categoria" | "caja"

export interface FilaRentabilidad {
  id: string
  nombre: string
  unidadesVendidas: number
  ventasCentavos: number
  costoCentavos: number
  gananciaBrutaCentavos: number
  markupBp: number // basis points promedio ponderado
}

export interface QueryRentabilidadInput {
  organizationId: string
  agrupador: AgrupadorRentabilidad
  /** Sin fecha = histórico completo, sin límite en ese extremo. */
  fechaDesde?: Date
  fechaHasta?: Date
}

export const rentabilidadService = {
  async porAgrupador(input: QueryRentabilidadInput): Promise<FilaRentabilidad[]> {
    const { organizationId, agrupador, fechaDesde, fechaHasta } = input

    // Obtener caja principal (solo para agrupador "caja")
    const cajaPrincipal =
      agrupador === "caja"
        ? await prisma.caja.findFirst({
            where: { organizationId, esPrincipal: true },
            select: { id: true, nombre: true },
          })
        : null

    if (agrupador === "caja" && !cajaPrincipal) {
      throw new Error("No se encontró la caja principal. Verificá la configuración de cajas.")
    }

    // Traer todas las líneas de venta del período — solo los campos usados abajo
    // (esta tabla puede ser grande: un mes entero de ventas de todos los productos).
    const lineas = await prisma.saleLine.findMany({
      where: {
        sale: {
          organizationId,
          ...((fechaDesde || fechaHasta) && {
            fecha: {
              ...(fechaDesde && { gte: fechaDesde }),
              ...(fechaHasta && { lte: fechaHasta }),
            },
          }),
        },
      },
      select: {
        cantidad: true,
        gramos: true,
        precioUnitarioCentavos: true,
        costoUnitarioCentavos: true,
        product: {
          select: {
            esPesable: true,
            categoryId: true,
            providerId: true,
            locationId: true,
            category: { select: { nombre: true, cajaId: true, caja: { select: { id: true, nombre: true } } } },
            provider: { select: { nombre: true } },
            location: { select: { nombre: true } },
          },
        },
      },
    })

    // Agrupar en memoria para mayor flexibilidad
    const mapa = new Map<
      string,
      {
        id: string
        nombre: string
        unidadesVendidas: number
        ventasCentavos: number
        costoCentavos: number
        gananciaBrutaCentavos: number
      }
    >()

    for (const linea of lineas) {
      const producto = linea.product

      let agrupadorId: string
      let agrupadorNombre: string

      if (agrupador === "proveedor") {
        agrupadorId = producto.providerId ?? "__sin_proveedor__"
        agrupadorNombre = producto.provider?.nombre ?? "Sin proveedor"
      } else if (agrupador === "heladera") {
        agrupadorId = producto.locationId ?? "__sin_ubicacion__"
        agrupadorNombre = producto.location?.nombre ?? "Sin ubicación"
      } else if (agrupador === "caja") {
        agrupadorId = resolverCajaId(producto.category.cajaId, cajaPrincipal!.id)
        agrupadorNombre = producto.category.caja?.nombre ?? cajaPrincipal!.nombre
      } else {
        agrupadorId = producto.categoryId
        agrupadorNombre = producto.category.nombre
      }

      const ventas = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: linea.precioUnitarioCentavos, cantidad: linea.cantidad, gramos: linea.gramos })
      const costo = subtotalLinea({ esPesable: producto.esPesable, precioUnitarioCentavos: linea.costoUnitarioCentavos, cantidad: linea.cantidad, gramos: linea.gramos })
      const ganancia = ventas - costo

      const fila = mapa.get(agrupadorId) ?? {
        id: agrupadorId,
        nombre: agrupadorNombre,
        unidadesVendidas: 0,
        ventasCentavos: 0,
        costoCentavos: 0,
        gananciaBrutaCentavos: 0,
      }

      fila.unidadesVendidas += linea.cantidad
      fila.ventasCentavos += ventas
      fila.costoCentavos += costo
      fila.gananciaBrutaCentavos += ganancia

      mapa.set(agrupadorId, fila)
    }

    return Array.from(mapa.values())
      .map((fila) => ({
        ...fila,
        // markup promedio ponderado en bp
        markupBp:
          fila.costoCentavos === 0
            ? 0
            : Math.round(
                ((fila.ventasCentavos - fila.costoCentavos) / fila.costoCentavos) * 10_000
              ),
      }))
      .sort((a, b) => b.gananciaBrutaCentavos - a.gananciaBrutaCentavos)
  },
}
