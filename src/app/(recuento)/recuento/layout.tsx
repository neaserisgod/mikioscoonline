import { auth } from "@/auth"
import { redirect } from "next/navigation"

// Fuera de (dashboard) a propósito — no arrastra el layout de escritorio
// (TopBar/drawer), esta pantalla es mobile-first. Usa la sesión normal (Google,
// vía auth()) — el celular entra por la URL de Vercel (HTTPS), no hace falta
// un mecanismo de login nuevo.
export default async function RecuentoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session) redirect("/login")

  return <div className="min-h-dvh bg-background">{children}</div>
}
