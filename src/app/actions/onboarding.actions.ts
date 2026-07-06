"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { organizacionService, categoriaService, proveedorService, ubicacionService, medioPagoService, gastoFijoService } from "@/services/config.service"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  return session.user as { id: string; organizationId: string; role: string }
}

// ─── Paso obligatorio: nombre del negocio ─────────────────────────────────────
// Crea automáticamente Caja principal + Efectivo si no existen

const NegocioSchema = z.object({
  nombre: z.string().min(1, "El nombre es obligatorio").max(100),
})

export async function guardarNegocioOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { nombre } = NegocioSchema.parse(input)

  await organizacionService.actualizar(user.organizationId, { nombre })

  const cajaPrincipal = await prisma.caja.findFirst({
    where: { organizationId: user.organizationId, esPrincipal: true },
  })
  if (!cajaPrincipal) {
    await prisma.caja.create({
      data: { nombre: "Caja general", esPrincipal: true, orden: 0, organizationId: user.organizationId },
    })
  }

  const efectivo = await prisma.paymentMethod.findFirst({
    where: { organizationId: user.organizationId, esEfectivo: true },
  })
  if (!efectivo) {
    await prisma.paymentMethod.create({
      data: {
        nombre: "Efectivo",
        comisionBp: 0,
        esMercadoPago: false,
        esEfectivo: true,
        esDefault: true,
        orden: 0,
        organizationId: user.organizationId,
      },
    })
  }

  revalidatePath("/onboarding")
}

// ─── Datos fiscales (salteable) ───────────────────────────────────────────────

const DatosFiscalesSchema = z.object({
  cuit: z.string().optional().nullable(),
  condicionIva: z.enum(["RESPONSABLE_INSCRIPTO", "MONOTRIBUTO", "EXENTO", "CONSUMIDOR_FINAL"]).optional().nullable(),
  puntoDeVenta: z.number().int().positive().optional().nullable(),
  stockMinimoDefault: z.number().int().min(0).optional(),
})

export async function guardarDatosFiscalesAction(input: unknown) {
  const user = await requireAuth()
  const data = DatosFiscalesSchema.parse(input)
  await organizacionService.actualizar(user.organizationId, data)
  revalidatePath("/onboarding")
}

// ─── Categorías (salteable) ───────────────────────────────────────────────────

const CategoriasSchema = z.object({
  categorias: z.array(
    z.object({
      nombre: z.string().min(1),
      markupDefaultBp: z.number().int().min(0),
      markupDefaultTipo: z.enum(["PORCENTUAL", "FIJO"]).optional(),
      markupDefaultFijoCentavos: z.number().int().min(0).optional(),
    })
  ),
})

export async function guardarCategoriasOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { categorias } = CategoriasSchema.parse(input)
  for (const cat of categorias) {
    await categoriaService.crear(user.organizationId, cat)
  }
  revalidatePath("/onboarding")
}

// ─── Métodos de pago extra (salteable) ───────────────────────────────────────

const MediosPagoSchema = z.object({
  medios: z.array(
    z.object({
      nombre: z.string().min(1),
      comisionBp: z.number().int().min(0),
      esMercadoPago: z.boolean().optional(),
    })
  ),
})

export async function guardarMediosPagoOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { medios } = MediosPagoSchema.parse(input)
  for (const m of medios) {
    await medioPagoService.crear(user.organizationId, m)
  }
  revalidatePath("/onboarding")
}

// ─── Proveedores (salteable) ──────────────────────────────────────────────────

const ProveedoresSchema = z.object({
  proveedores: z.array(z.object({ nombre: z.string().min(1) })),
})

export async function guardarProveedoresOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { proveedores } = ProveedoresSchema.parse(input)
  for (const p of proveedores) {
    await proveedorService.crear(user.organizationId, p)
  }
  revalidatePath("/onboarding")
}

// ─── Ubicaciones (salteable) ──────────────────────────────────────────────────

const UbicacionesSchema = z.object({
  ubicaciones: z.array(z.object({ nombre: z.string().min(1) })),
})

export async function guardarUbicacionesOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { ubicaciones } = UbicacionesSchema.parse(input)
  for (const u of ubicaciones) {
    await ubicacionService.crear(user.organizationId, u)
  }
  revalidatePath("/onboarding")
}

// ─── Gastos fijos (salteable) ─────────────────────────────────────────────────

const GastosFijosSchema = z.object({
  gastos: z.array(
    z.object({
      nombre: z.string().min(1),
      montoMensualCentavos: z.number().int().positive(),
    })
  ),
})

export async function guardarGastosFijosOnboardingAction(input: unknown) {
  const user = await requireAuth()
  const { gastos } = GastosFijosSchema.parse(input)
  for (const g of gastos) {
    await gastoFijoService.crear(user.organizationId, g)
  }
  revalidatePath("/onboarding")
}

// ─── Finalizar (o saltar todo) ────────────────────────────────────────────────

export async function completarOnboardingAction() {
  const user = await requireAuth()
  await organizacionService.completarOnboarding(user.organizationId)
  redirect("/inicio")
}

// ─── Re-disparar desde Configuración ─────────────────────────────────────────

export async function resetearOnboardingAction() {
  const user = await requireAuth()
  await organizacionService.resetearOnboarding(user.organizationId)
  redirect("/onboarding")
}
