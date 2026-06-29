import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { organizacionService } from "@/services/config.service"
import { TopBar } from "@/components/layout/top-bar"
import { TabsBar } from "@/components/layout/tabs-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { VentaOverlay } from "@/components/pos/venta-overlay"
import { GlobalScannerMount } from "@/components/scanner/global-scanner-mount"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  let org
  try {
    org = await organizacionService.obtener(session.user.organizationId)
  } catch {
    redirect("/login")
  }
  if (!org.onboardingCompletadoAt) redirect("/onboarding")

  return (
    <div className="flex flex-col h-dvh overflow-hidden">
      <TopBar />
      <TabsBar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-8">
          {children}
        </div>
      </main>
      <BottomNav />
      <VentaOverlay />
      <GlobalScannerMount />
    </div>
  )
}
