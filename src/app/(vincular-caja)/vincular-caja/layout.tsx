import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"

export default async function VincularCajaLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Sin conexión a producción configurada, no hay nada que vincular acá.
  if (!process.env.NEON_DATABASE_URL) redirect("/inicio")

  // Ya hay ventas locales (ya se vinculó antes, o esta caja se usó de verdad)
  // — mismo criterio que el gate de (dashboard)/layout.tsx. Nada para hacer acá.
  const ventasLocales = await prisma.sale.count({ where: { organizationId: session.user.organizationId } })
  if (ventasLocales > 0) redirect("/inicio")

  return (
    <div className="min-h-dvh bg-background flex items-start justify-center py-8 px-4">
      {children}
    </div>
  )
}
