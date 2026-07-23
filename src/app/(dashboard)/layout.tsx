import { auth } from "@/auth"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { organizacionService } from "@/services/config.service"
import { accesoBloqueado } from "@/lib/suscripcion"
import { TopBar } from "@/components/layout/top-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { PageTransition } from "@/components/layout/page-transition"
import { VentaOverlay } from "@/components/pos/venta-overlay"
import { PagoMpPollingMount } from "@/components/pos/pago-mp-polling-mount"
import { TraspasoCigarrillosGate } from "@/components/pos/traspaso-cigarrillos-gate"
import { ArqueoParcialGate } from "@/components/pos/arqueo-parcial-gate"
import { PerfilGate } from "@/components/pos/perfil-gate"
import { GlobalScannerMount } from "@/components/scanner/global-scanner-mount"
import { QueryWarmup } from "@/components/providers/query-warmup"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  // Caja que nunca vendió nada todavía, en una instalación con conexión a
  // producción configurada (ver src/lib/prisma-auth.ts + NEON_DATABASE_URL en
  // config.env del kiosco): puede ser una cuenta de Google con negocio real ya
  // existente en Neon — ofrecer vincularlo ANTES de seguir a onboarding/dashboard.
  // No se puede distinguir "esta caja" de "la organización real" comparando
  // `organizationId` (el id de la plantilla local y el de la organización real
  // de Bruno en Neon son el MISMO, `org_principal` — este código nació
  // single-tenant), así que la señal es "0 ventas locales" en vez de identidad
  // — ver el comentario largo en vincular-caja.actions.ts.
  if (process.env.NEON_DATABASE_URL) {
    const ventasLocales = await prisma.sale.count({ where: { organizationId: session.user.organizationId } })
    if (ventasLocales === 0) redirect("/vincular-caja")
  }

  let org
  try {
    org = await organizacionService.obtenerOnboardingStatus(session.user.organizationId)
  } catch {
    redirect("/login")
  }
  if (!org.onboardingCompletadoAt) redirect("/onboarding")
  if (accesoBloqueado(org)) redirect("/suscripcion")

  // Selector de perfil tipo Netflix forzado, solo en el kiosco (cookie
  // modo_kiosco, plantada por src/proxy.ts) y solo al abrir el navegador
  // (perfil_confirmado es cookie de sesión, se borra al cerrar Chrome).
  const store = await cookies()
  const forzarPerfil = store.get("modo_kiosco")?.value === "1" && !store.get("perfil_confirmado")

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <PageTransition>
          <div className="h-full overflow-y-auto">
            {/* Ancho completo en desktop (cap suave solo en pantallas 4K+) para
                aprovechar el espacio y reducir el scroll. */}
            <div className="max-w-[1800px] mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
              {children}
            </div>
          </div>
        </PageTransition>
      </main>
      <BottomNav />
      <VentaOverlay />
      <PagoMpPollingMount />
      <TraspasoCigarrillosGate />
      <ArqueoParcialGate />
      {forzarPerfil && <PerfilGate />}
      <GlobalScannerMount />
      <QueryWarmup />
    </div>
  )
}
