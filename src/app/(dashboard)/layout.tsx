import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { organizacionService } from "@/services/config.service"
import { accesoBloqueado } from "@/lib/suscripcion"
import { TopBar } from "@/components/layout/top-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { PageTransition } from "@/components/layout/page-transition"
import { VentaOverlay } from "@/components/pos/venta-overlay"
import { PagoMpPollingMount } from "@/components/pos/pago-mp-polling-mount"
import { GlobalScannerMount } from "@/components/scanner/global-scanner-mount"
import { QueryWarmup } from "@/components/providers/query-warmup"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  let org
  try {
    org = await organizacionService.obtenerOnboardingStatus(session.user.organizationId)
  } catch {
    redirect("/login")
  }
  if (!org.onboardingCompletadoAt) redirect("/onboarding")
  if (accesoBloqueado(org)) redirect("/suscripcion")

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <PageTransition>
          <div className="h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
              {children}
            </div>
          </div>
        </PageTransition>
      </main>
      <BottomNav />
      <VentaOverlay />
      <PagoMpPollingMount />
      <GlobalScannerMount />
      <QueryWarmup />
    </div>
  )
}
