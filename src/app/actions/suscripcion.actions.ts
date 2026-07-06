"use server"

import { auth } from "@/auth"
import { urlCheckoutSuscripcion } from "@/lib/mercadopago-suscripcion"
import { redirect } from "next/navigation"

async function requireAuth() {
  const session = await auth()
  if (!session?.user?.organizationId) throw new Error("No autorizado")
  return session.user
}

export async function crearSuscripcionAction() {
  await requireAuth()
  redirect(urlCheckoutSuscripcion())
}
