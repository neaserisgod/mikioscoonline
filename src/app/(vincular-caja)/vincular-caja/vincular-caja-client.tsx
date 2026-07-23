"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, DownloadCloud } from "lucide-react"
import { vincularCajaAction } from "@/app/actions/vincular-caja.actions"

export function VincularCajaClient() {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function vincular() {
    setError(null)
    startTransition(async () => {
      const result = await vincularCajaAction()
      // Si sale bien, la action hace redirect() y esta línea nunca se ejecuta.
      if (!result.ok) setError(result.error)
    })
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Encontramos tu cuenta</CardTitle>
        <CardDescription>
          Esta cuenta de Google ya tiene un negocio con datos reales. Traelos a esta caja para
          empezar a vender con tu catálogo, stock y configuración de siempre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="text-sm text-k-loss bg-k-loss/10 rounded-lg px-3 py-2 mb-2">{error}</p>
        )}
        <p className="text-sm text-muted-foreground">
          Puede tardar un rato si hay muchas ventas cargadas. No cierres la app mientras se
          descarga — si algo falla a mitad de camino, se puede reintentar sin problema.
        </p>
      </CardContent>
      <CardFooter>
        <Button onClick={vincular} disabled={isPending} className="w-full">
          {isPending ? (
            <>
              <Loader2 className="animate-spin" /> Trayendo tus datos…
            </>
          ) : (
            <>
              <DownloadCloud /> Vincular esta caja
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
