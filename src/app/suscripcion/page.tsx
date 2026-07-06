import { redirect } from "next/navigation"
import { requireSession } from "@/lib/session"
import { organizacionService } from "@/services/config.service"
import { crearSuscripcionAction } from "@/app/actions/suscripcion.actions"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"
import { PRECIO_MENSUAL_CENTAVOS, TRIAL_DIAS } from "@/lib/suscripcion"
import { formatearARS } from "@/domain/dinero"

export const metadata = { title: "Suscripción" }

const INCLUIDO = [
  "Ventas, stock y rentabilidad sin límites",
  "Usuarios ilimitados de tu equipo",
  "Cobros con Mercado Pago (QR y posnet)",
  "Soporte por WhatsApp",
]

export default async function SuscripcionPage() {
  const session = await requireSession()
  const org = await organizacionService.obtener(session.user.organizationId)

  if (org.estadoPago === "ACTIVO") redirect("/inicio")

  const diasRestantes =
    org.estadoPago === "TRIAL" && org.trialTerminaEl
      ? Math.max(0, Math.ceil((org.trialTerminaEl.getTime() - Date.now()) / 86_400_000))
      : 0

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="font-heading text-2xl font-semibold">
            {org.estadoPago === "TRIAL" && diasRestantes > 0
              ? `Te quedan ${diasRestantes} días de prueba`
              : "Tu prueba terminó"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1.5">
            Suscribite para seguir usando {org.nombre} sin interrupciones.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="font-heading text-3xl font-semibold">
              {formatearARS(PRECIO_MENSUAL_CENTAVOS)}
            </span>
            <span className="text-muted-foreground text-sm">/ mes</span>
          </div>
          <p className="text-xs text-primary font-medium mb-5">
            Precio de lanzamiento — congelado mientras sigas suscripto
          </p>

          <ul className="space-y-2.5 mb-6">
            {INCLUIDO.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm">
                <Check className="size-4 text-primary shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>

          <form action={crearSuscripcionAction}>
            <Button type="submit" size="lg" className="w-full h-11 text-base">
              Suscribirme con Mercado Pago
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Podés cancelar cuando quieras desde Mercado Pago.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Prueba gratis de {TRIAL_DIAS} días para cuentas nuevas, sin tarjeta.
        </p>
      </div>
    </div>
  )
}
