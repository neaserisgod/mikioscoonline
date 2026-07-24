import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { obtenerUltimoInstalador, RELEASES_URL } from "@/lib/descarga"
import {
  Download,
  MonitorDown,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Descargar Mi Kiosco para Windows",
  description:
    "Descargá la app de escritorio de Mi Kiosco para Windows. Se instala en un click, sin permisos de administrador, y se actualiza sola.",
}

// La info del instalador sale de la última release de GitHub; se revalida cada
// 5 min (ver src/lib/descarga.ts), así que la página se cachea y no le pega a
// la API de GitHub en cada visita.
export const revalidate = 300

const PASOS = [
  {
    titulo: "Descargá el instalador",
    detalle:
      "Es un único archivo .exe. Guardalo donde quieras — no hace falta permiso de administrador.",
  },
  {
    titulo: "Abrilo y seguí los pasos",
    detalle:
      "Si Windows muestra un aviso de “editor desconocido”, tocá “Más información” → “Ejecutar de todos modos”. Es normal en apps nuevas.",
  },
  {
    titulo: "Entrá con tu cuenta de Google",
    detalle:
      "La primera vez, iniciá sesión y la caja queda vinculada a tu negocio. Tus datos viven en tu PC y se respaldan solos.",
  },
]

export default async function DescargarPage() {
  const info = await obtenerUltimoInstalador()

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <span className="font-heading text-lg font-semibold tracking-tight">Mi Kiosco</span>
          <Button render={<Link href="/" />} variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="size-4" />
            Volver
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 lg:px-8">
        {/* Hero de descarga */}
        <section className="pt-16 pb-12 lg:pt-24 text-center">
          <div className="size-14 rounded-2xl bg-primary/15 text-primary flex items-center justify-center mx-auto mb-6">
            <MonitorDown className="size-7" />
          </div>
          <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-balance">
            Mi Kiosco para Windows
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-lg mx-auto text-balance">
            La caja completa en tu PC: vende sin internet, respalda sola y se
            mantiene siempre actualizada.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              render={<a href="/descargar/exe" />}
              size="lg"
              className="gap-2 h-12 px-7 text-base"
            >
              <Download className="size-5" />
              Descargar para Windows
            </Button>
            <p className="text-xs text-muted-foreground">
              {info ? (
                <>
                  Versión {info.version} · Windows 10 u 11 (64 bits)
                </>
              ) : (
                <>Windows 10 u 11 (64 bits)</>
              )}
            </p>
          </div>
        </section>

        {/* Garantías */}
        <section className="grid sm:grid-cols-3 gap-4 pb-14">
          {[
            {
              icon: ShieldCheck,
              titulo: "Sin administrador",
              detalle: "Se instala por usuario, sin pedir permisos especiales.",
            },
            {
              icon: RefreshCw,
              titulo: "Se actualiza sola",
              detalle: "Cada vez que abrís, busca y aplica la última versión.",
            },
            {
              icon: MonitorDown,
              titulo: "Funciona sin internet",
              detalle: "Vendés aunque se corte la conexión; se respalda al volver.",
            },
          ].map(({ icon: Icon, titulo, detalle }) => (
            <div key={titulo} className="bg-card rounded-2xl border border-border/60 p-5">
              <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center mb-4">
                <Icon className="size-5" />
              </div>
              <h3 className="font-heading font-medium mb-1.5">{titulo}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{detalle}</p>
            </div>
          ))}
        </section>

        {/* Pasos de instalación */}
        <section className="border-t border-border/60 py-14">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-center mb-10">
            Cómo instalarlo
          </h2>
          <ol className="max-w-xl mx-auto space-y-6">
            {PASOS.map(({ titulo, detalle }, i) => (
              <li key={titulo} className="flex gap-4">
                <span className="shrink-0 size-8 rounded-full bg-primary/15 text-primary font-heading font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-heading font-medium">{titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Fallback / versiones anteriores */}
        <section className="border-t border-border/60 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            ¿Problemas con la descarga? Veé{" "}
            <a
              href={RELEASES_URL}
              className="text-primary underline underline-offset-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              todas las versiones en GitHub
            </a>
            .
          </p>
        </section>
      </main>

      <footer className="border-t border-border/60">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Mi Kiosco
        </div>
      </footer>
    </div>
  )
}
