import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { Button } from "@/components/ui/button"
import {
  ShoppingCart,
  Package,
  TrendingUp,
  QrCode,
  BarChart3,
  Zap,
  ArrowRight,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Kiosco — el sistema de gestión para tu negocio",
  description:
    "Vendé, controlá stock y cobrá con Mercado Pago desde un solo sistema pensado para kioscos y almacenes. Empezá gratis con tu cuenta de Google.",
}

const FEATURES = [
  {
    icon: ShoppingCart,
    title: "Vendé rápido",
    description: "Escaneo de código de barras y carrito pensado para el mostrador, no para una oficina.",
  },
  {
    icon: Package,
    title: "Stock bajo control",
    description: "Productos, proveedores y ubicaciones en un solo lugar, con alertas de stock bajo.",
  },
  {
    icon: QrCode,
    title: "Cobrá con Mercado Pago",
    description: "QR y posnet integrados — la venta se concilia sola, sin anotar nada a mano.",
  },
  {
    icon: BarChart3,
    title: "Rentabilidad real",
    description: "Cuánto ganás por producto y por proveedor, no solo cuánto vendés.",
  },
]

export default async function LandingPage() {
  const session = await auth()
  if (session) redirect("/inicio")

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <span className="font-heading text-lg font-semibold tracking-tight">Kiosco</span>
          <Button render={<Link href="/login" />} variant="outline" size="sm">
            Iniciar sesión
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 lg:px-8 pt-16 pb-20 lg:pt-24 lg:pb-28 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-medium mb-6">
            <Zap className="size-3.5" />
            Pensado para kioscos y almacenes
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight text-balance max-w-3xl mx-auto">
            El mostrador, la caja y el stock — en un solo lugar
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl mx-auto text-balance">
            Kiosco es el sistema de gestión hecho para el día a día de tu negocio: vender rápido,
            saber qué tenés y cuánto ganás, sin vueltas.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button render={<Link href="/login" />} size="lg" className="gap-1.5 h-11 px-6 text-base">
              Empezar gratis
              <ArrowRight className="size-4" />
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Entrás con tu cuenta de Google — tu negocio queda creado al instante, sin formularios largos.
          </p>
        </section>

        {/* Features */}
        <section className="border-t border-border/60 bg-secondary/40">
          <div className="max-w-5xl mx-auto px-4 lg:px-8 py-16 lg:py-20">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div key={title} className="bg-card rounded-2xl border border-border/60 p-5">
                  <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="font-heading font-medium mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-5xl mx-auto px-4 lg:px-8 py-16 lg:py-20 text-center">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">
            ¿Listo para ordenar tu negocio?
          </h2>
          <p className="mt-3 text-muted-foreground max-w-md mx-auto">
            Creá tu cuenta en segundos y probá Kiosco con tus propios productos.
          </p>
          <Button render={<Link href="/login" />} size="lg" className="mt-6 gap-1.5 h-11 px-6 text-base">
            Empezar gratis
            <ArrowRight className="size-4" />
          </Button>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="max-w-5xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kiosco
        </div>
      </footer>
    </div>
  )
}
