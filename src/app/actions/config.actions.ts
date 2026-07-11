"use server"

import { auth } from "@/auth"
import {
  categoriaService,
  proveedorService,
  ubicacionService,
  medioPagoService,
  gastoFijoService,
  organizacionService,
  usuarioService,
} from "@/services/config.service"
import { resumenService } from "@/services/resumen.service"
import { z } from "zod"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  if (session.user.role !== "ADMIN") throw new Error("Solo ADMIN puede modificar configuración")
  return session.user as { id: string; organizationId: string; role: string }
}

// ─── Categorías ──────────────────────────────────────────────────────────────

const CategoriaSchema = z.object({
  nombre: z.string().min(1),
  markupDefaultBp: z.number().int().min(0),
  markupDefaultTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  markupDefaultFijoCentavos: z.number().int().min(0).optional(),
})

export async function crearCategoriaAction(input: unknown) {
  const user = await requireAdmin()
  const data = CategoriaSchema.parse(input)
  return categoriaService.crear(user.organizationId, data)
}

export async function editarCategoriaAction(id: string, input: unknown) {
  const user = await requireAdmin()
  const data = CategoriaSchema.partial().parse(input)
  return categoriaService.editar(id, user.organizationId, data)
}

export async function desactivarCategoriaAction(id: string) {
  const user = await requireAdmin()
  return categoriaService.desactivar(id, user.organizationId)
}

export async function reactivarCategoriaAction(id: string) {
  const user = await requireAdmin()
  return categoriaService.reactivar(id, user.organizationId)
}

export async function eliminarCategoriaAction(id: string) {
  const user = await requireAdmin()
  return categoriaService.eliminar(id, user.organizationId)
}

// ─── Proveedores ─────────────────────────────────────────────────────────────

const ProveedorSchema = z.object({ nombre: z.string().min(1) })

export async function crearProveedorAction(input: unknown) {
  const user = await requireAdmin()
  return proveedorService.crear(user.organizationId, ProveedorSchema.parse(input))
}

export async function editarProveedorAction(id: string, input: unknown) {
  const user = await requireAdmin()
  return proveedorService.editar(id, user.organizationId, ProveedorSchema.parse(input))
}

export async function desactivarProveedorAction(id: string) {
  const user = await requireAdmin()
  return proveedorService.desactivar(id, user.organizationId)
}

export async function reactivarProveedorAction(id: string) {
  const user = await requireAdmin()
  return proveedorService.reactivar(id, user.organizationId)
}

export async function eliminarProveedorAction(id: string) {
  const user = await requireAdmin()
  return proveedorService.eliminar(id, user.organizationId)
}

export async function actualizarPisoReposicionAction(id: string, montoCentavos: unknown) {
  const user = await requireAdmin()
  const monto = z.number().int().min(0).parse(montoCentavos)
  return proveedorService.actualizarPisoReposicion(id, user.organizationId, monto)
}

export async function registrarCompraCuentaCorrienteAction(id: string, montoCentavos: unknown) {
  const user = await requireAdmin()
  const monto = z.number().int().positive().parse(montoCentavos)
  return proveedorService.registrarCompraCuentaCorriente(id, user.organizationId, monto)
}

export async function registrarPagoCuentaCorrienteAction(id: string, montoCentavos: unknown, cajaId: unknown) {
  const user = await requireAdmin()
  const monto = z.number().int().positive().parse(montoCentavos)
  const caja = z.string().min(1).parse(cajaId)
  return proveedorService.registrarPagoCuentaCorriente(id, user.organizationId, monto, caja)
}

// ─── Ubicaciones ─────────────────────────────────────────────────────────────

const UbicacionSchema = z.object({ nombre: z.string().min(1) })

export async function crearUbicacionAction(input: unknown) {
  const user = await requireAdmin()
  return ubicacionService.crear(user.organizationId, UbicacionSchema.parse(input))
}

export async function editarUbicacionAction(id: string, input: unknown) {
  const user = await requireAdmin()
  return ubicacionService.editar(id, user.organizationId, UbicacionSchema.parse(input))
}

export async function desactivarUbicacionAction(id: string) {
  const user = await requireAdmin()
  return ubicacionService.desactivar(id, user.organizationId)
}

export async function reactivarUbicacionAction(id: string) {
  const user = await requireAdmin()
  return ubicacionService.reactivar(id, user.organizationId)
}

export async function eliminarUbicacionAction(id: string) {
  const user = await requireAdmin()
  return ubicacionService.eliminar(id, user.organizationId)
}

// ─── Medios de pago ──────────────────────────────────────────────────────────

const MedioPagoSchema = z.object({
  nombre: z.string().min(1),
  comisionBp: z.number().int().min(0),
  esEfectivo: z.boolean().optional(),
  esMercadoPago: z.boolean().optional(),
  // Si se setea, las ventas con este medio se atribuyen enteras a esta caja (override del split por categoría)
  cajaId: z.string().min(1).nullable().optional(),
  // Recargo por pago virtual — se configura acá, una vez por medio de pago
  recargoTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
  recargoVirtualBp: z.number().int().min(0).optional(),
  recargoVirtualFijoCentavos: z.number().int().min(0).optional(),
  // external_pos_id del QR físico de MercadoPago (solo aplica si esMercadoPago = true)
  mpExternalPosId: z.string().min(1).nullable().optional(),
  // terminal_id del posnet Point de MercadoPago (solo aplica si esMercadoPago = true)
  mpTerminalId: z.string().min(1).nullable().optional(),
})

export async function crearMedioPagoAction(input: unknown) {
  const user = await requireAdmin()
  return medioPagoService.crear(user.organizationId, MedioPagoSchema.parse(input))
}

export async function editarMedioPagoAction(id: string, input: unknown) {
  const user = await requireAdmin()
  const data = MedioPagoSchema.extend({ activo: z.boolean().optional() }).partial().parse(input)
  return medioPagoService.editar(id, user.organizationId, data)
}

export async function desactivarMedioPagoAction(id: string) {
  const user = await requireAdmin()
  return medioPagoService.desactivar(id, user.organizationId)
}

export async function reactivarMedioPagoAction(id: string) {
  const user = await requireAdmin()
  return medioPagoService.reactivar(id, user.organizationId)
}

export async function setDefaultMedioPagoAction(id: string) {
  const user = await requireAdmin()
  return medioPagoService.setDefault(id, user.organizationId)
}

export async function moverOrdenMedioPagoAction(id: string, direccion: "arriba" | "abajo") {
  const user = await requireAdmin()
  return medioPagoService.moverOrden(id, user.organizationId, direccion)
}

// ─── Gastos fijos ─────────────────────────────────────────────────────────────

const GastoFijoSchema = z.object({
  nombre: z.string().min(1),
  montoMensualCentavos: z.number().int().positive(),
  mesAnio: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

export async function crearGastoFijoAction(input: unknown) {
  const user = await requireAdmin()
  return gastoFijoService.crear(user.organizationId, GastoFijoSchema.parse(input))
}

export async function editarGastoFijoAction(id: string, input: unknown) {
  const user = await requireAdmin()
  const data = z.object({ nombre: z.string().min(1) }).parse(input)
  return gastoFijoService.editar(id, user.organizationId, data)
}

export async function actualizarMontoGastoFijoAction(
  id: string,
  montoCentavos: number,
  mesAnio?: string
) {
  const user = await requireAdmin()
  return gastoFijoService.actualizarMonto(id, user.organizationId, montoCentavos, mesAnio)
}

export async function desactivarGastoFijoAction(id: string) {
  const user = await requireAdmin()
  return gastoFijoService.desactivar(id, user.organizationId)
}

export async function reactivarGastoFijoAction(id: string) {
  const user = await requireAdmin()
  return gastoFijoService.reactivar(id, user.organizationId)
}

export async function pagarGastoFijoAction(id: string, montoCentavos: unknown, cajaId: unknown) {
  const user = await requireAdmin()
  const monto = z.number().int().positive().parse(montoCentavos)
  const caja = z.string().min(1).parse(cajaId)
  return gastoFijoService.pagar(id, user.organizationId, monto, caja)
}

export async function retirarGananciaAction(montoCentavos: unknown, cajaId: unknown) {
  const user = await requireAdmin()
  const monto = z.number().int().positive().parse(montoCentavos)
  const caja = z.string().min(1).parse(cajaId)
  return resumenService.retirarGanancia(user.organizationId, monto, caja)
}

// ─── Negocio ──────────────────────────────────────────────────────────────────

const NegocioSchema = z.object({
  nombre: z.string().min(1).optional(),
  cuit: z.string().optional().nullable(),
  condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]).optional().nullable(),
  puntoDeVenta: z.number().int().positive().optional().nullable(),
  stockMinimoDefault: z.number().int().min(0).optional(),
})

export async function actualizarNegocioAction(input: unknown) {
  const user = await requireAdmin()
  const data = NegocioSchema.parse(input)
  return organizacionService.actualizar(user.organizationId, data)
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

const CrearUsuarioSchema = z.object({
  nombre: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "VENDEDOR"]),
})

export async function crearUsuarioAction(input: unknown) {
  const user = await requireAdmin()
  const data = CrearUsuarioSchema.parse(input)
  return usuarioService.crear(user.organizationId, data)
}

export async function desactivarUsuarioAction(id: string) {
  const user = await requireAdmin()
  return usuarioService.desactivar(id, user.organizationId, user.id)
}

export async function reactivarUsuarioAction(id: string) {
  const user = await requireAdmin()
  return usuarioService.reactivar(id, user.organizationId)
}

export async function cambiarRolUsuarioAction(id: string, role: "ADMIN" | "VENDEDOR") {
  const user = await requireAdmin()
  return usuarioService.cambiarRol(id, user.organizationId, role, user.id)
}

const CrearPerfilPinSchema = z.object({
  nombre: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos"),
})

export async function crearPerfilPinAction(input: unknown) {
  const user = await requireAdmin()
  const data = CrearPerfilPinSchema.parse(input)
  return usuarioService.crearPerfilPin(user.organizationId, data)
}

export async function resetearPinUsuarioAction(id: string, pin: unknown) {
  const user = await requireAdmin()
  const pinValido = z.string().regex(/^\d{4}$/, "El PIN debe tener 4 dígitos").parse(pin)
  return usuarioService.resetearPin(id, user.organizationId, pinValido)
}
