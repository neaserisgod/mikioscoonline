import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")
  return (
    <div className="min-h-dvh bg-background flex items-start justify-center py-8 px-4">
      {children}
    </div>
  )
}
