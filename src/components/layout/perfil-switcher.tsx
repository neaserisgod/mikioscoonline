"use client"

import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { signIn } from "next-auth/react"
import { Loader2, Delete, UserRound } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { confirmarPerfilKioscoAction } from "@/app/actions/perfiles.actions"

interface Perfil {
  id: string
  nombre: string
  role: "ADMIN" | "VENDEDOR"
}
interface PerfilesResponse {
  perfiles: Perfil[]
  cajasEfectivoAbiertas: string[]
}

interface PerfilSwitcherProps {
  open: boolean
  onClose: () => void
  /** Modo kiosco: no se puede cerrar sin elegir perfil (sin click afuera, sin
   * Escape, sin botón de cerrar) y al confirmar planta la cookie de sesión
   * que evita volver a pedirlo hasta que se cierre el navegador del todo. */
  bloqueante?: boolean
}

// Función de módulo (fuera del componente) para que el React Compiler no la
// trate como una mutación de una variable externa dentro del render/handler.
function recargarEn(path: string) {
  window.location.href = path
}

/**
 * Cambio rápido de usuario en el kiosco: elegir un perfil de empleado (creado
 * en Config > Usuarios) e ingresar su PIN de 4 dígitos. No reemplaza el login
 * inicial (Google/contraseña) — reusa esa sesión ya autenticada y solo cambia
 * quién queda como usuario activo (ver provider "pin" en src/auth.ts).
 */
export function PerfilSwitcher({ open, onClose, bloqueante }: PerfilSwitcherProps) {
  const [seleccionado, setSeleccionado] = useState<Perfil | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const { data, isLoading } = useQuery<PerfilesResponse>({
    queryKey: ["perfiles-switcher"],
    queryFn: () => fetch("/api/perfiles").then((r) => r.json()),
    enabled: open,
    staleTime: 60_000,
  })

  function cerrar() {
    setSeleccionado(null)
    setPin("")
    setError(null)
    onClose()
  }

  // Salvaguarda: si no hay ningún perfil con PIN configurado, el gate
  // forzado no tiene nada para ofrecer — bloquear igual dejaría el kiosco
  // inutilizable. Se confirma solo y sigue, como si ya se hubiera elegido.
  useEffect(() => {
    if (bloqueante && !isLoading && (data?.perfiles?.length ?? 0) === 0) {
      confirmarPerfilKioscoAction().then(() => recargarEn("/inicio"))
    }
  }, [bloqueante, isLoading, data?.perfiles?.length])

  async function ingresarDigito(d: string) {
    if (pin.length >= 4 || enviando || !seleccionado) return
    const nuevoPin = pin + d
    setPin(nuevoPin)
    setError(null)
    if (nuevoPin.length < 4) return

    setEnviando(true)
    const result = await signIn("pin", { userId: seleccionado.id, pin: nuevoPin, redirect: false })
    if (result?.ok) {
      if (bloqueante) await confirmarPerfilKioscoAction()
      // Recarga completa: el resto de la UI (top bar, drawer, react-query) lee
      // la sesión vieja cacheada en varios lugares — más simple y confiable
      // arrancar de cero que invalidar todo a mano.
      recargarEn("/inicio")
      return
    }
    setError("PIN incorrecto")
    setPin("")
    setEnviando(false)
  }

  // El chequeo de "cerrá la caja antes de cambiar de perfil" tiene sentido
  // para el cambio VOLUNTARIO (entregarle el kiosco a otro empleado a mitad
  // de turno sin cerrar arqueo). En el gate forzado al abrir la app (bloqueante)
  // no aplica: no es un cambio de manos, es solo reconfirmar quién está
  // operando — la caja abierta es el estado normal y esperado del día, y
  // bloquear acá dejaría el kiosco completamente inutilizable sin escape.
  const cajasBloqueando = bloqueante ? [] : (data?.cajasEfectivoAbiertas ?? [])

  return (
    <Dialog
      open={open}
      onOpenChange={bloqueante ? undefined : (v) => !v && cerrar()}
      disablePointerDismissal={bloqueante}
    >
      <DialogContent showCloseButton={!bloqueante}>
        <DialogHeader>
          <DialogTitle>{seleccionado ? seleccionado.nombre : "Cambiar de perfil"}</DialogTitle>
          {!seleccionado && (
            <DialogDescription>Elegí quién va a operar el kiosco ahora.</DialogDescription>
          )}
        </DialogHeader>

        {isLoading && <Loader2 className="size-5 animate-spin mx-auto my-6 text-muted-foreground" />}

        {!isLoading && cajasBloqueando.length > 0 && (
          <div className="text-sm text-center space-y-3 py-2">
            <p className="text-muted-foreground">
              Cerrá {cajasBloqueando.length === 1 ? "la caja" : "las cajas"} de efectivo antes de cambiar de
              perfil: <strong className="text-foreground">{cajasBloqueando.join(", ")}</strong>
            </p>
            <Button variant="outline" size="sm" onClick={() => { cerrar(); recargarEn("/inicio") }}>
              Ir a Inicio
            </Button>
          </div>
        )}

        {!isLoading && cajasBloqueando.length === 0 && !seleccionado && (
          <div className="grid grid-cols-2 gap-2">
            {(data?.perfiles ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSeleccionado(p)}
                className="rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors p-3 flex flex-col items-center gap-1.5"
              >
                <div className="rounded-full bg-foreground/8 p-2">
                  <UserRound className="size-4 text-foreground/70" />
                </div>
                <span className="text-sm font-medium truncate max-w-full">{p.nombre}</span>
                {p.role === "ADMIN" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-foreground text-background font-medium">
                    Admin
                  </span>
                )}
              </button>
            ))}
            {(data?.perfiles?.length ?? 0) === 0 && (
              <p className="col-span-2 text-sm text-muted-foreground text-center py-4">
                No hay perfiles con PIN todavía. Creá uno en Config → Usuarios.
              </p>
            )}
          </div>
        )}

        {!isLoading && cajasBloqueando.length === 0 && seleccionado && (
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "size-3 rounded-full border border-foreground/30",
                    i < pin.length && "bg-foreground border-foreground"
                  )}
                />
              ))}
            </div>
            {error && <p className="text-xs text-k-loss text-center">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <Button
                  key={d} type="button" variant="outline" className="h-12 text-base"
                  disabled={enviando} onClick={() => ingresarDigito(d)}
                >
                  {d}
                </Button>
              ))}
              <Button type="button" variant="ghost" className="h-12" onClick={() => setSeleccionado(null)} disabled={enviando}>
                Volver
              </Button>
              <Button
                type="button" variant="outline" className="h-12 text-base"
                disabled={enviando} onClick={() => ingresarDigito("0")}
              >
                0
              </Button>
              <Button
                type="button" variant="ghost" className="h-12"
                onClick={() => setPin((p) => p.slice(0, -1))} disabled={enviando || pin.length === 0}
              >
                <Delete className="size-4" />
              </Button>
            </div>
            {enviando && <Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" />}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
