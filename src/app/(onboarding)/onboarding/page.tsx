import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { organizacionService } from "@/services/config.service"
import { OnboardingWizard } from "./_components/wizard"

export const metadata = { title: "Configurar negocio" }

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")

  let org
  try {
    org = await organizacionService.obtener(session.user.organizationId)
  } catch {
    redirect("/login")
  }

  if (org.onboardingCompletadoAt) redirect("/inicio")

  return <OnboardingWizard orgNombre={org.nombre} />
}
