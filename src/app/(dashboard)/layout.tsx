import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { organizacionService } from "@/services/config.service"
import { TopBar } from "@/components/layout/top-bar"
import { TabsBar } from "@/components/layout/tabs-bar"
import { BottomNav } from "@/components/layout/bottom-nav"
import { VentaOverlay } from "@/components/pos/venta-overlay"
import { GlobalScannerMount } from "@/components/scanner/global-scanner-mount"

// Re-lanza los errores especiales de Next (redirect / notFound) para no romper navegación.
function esControlNext(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT") ||
      (e as { digest: string }).digest === "NEXT_NOT_FOUND")
  )
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    const session = await auth()
    if (!session) redirect("/login")

    let org
    try {
      org = await organizacionService.obtener(session.user.organizationId)
    } catch (e) {
      if (esControlNext(e)) throw e
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
  } catch (e) {
    if (esControlNext(e)) throw e
    // DIAGNÓSTICO TEMPORAL: mostrar el error real (producción enmascara los errores lanzados).
    return (
      <pre style={{ padding: 16, whiteSpace: "pre-wrap", fontSize: 12, color: "#f88" }}>
        {"DEBUG layout error:\n" + (e instanceof Error ? (e.stack ?? e.message) : String(e))}
      </pre>
    )
  }
}
