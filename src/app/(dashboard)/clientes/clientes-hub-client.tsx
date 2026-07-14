"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { ClientesClient } from "./clientes-client"
import RentabilidadClient from "../rentabilidad/rentabilidad-client"
import HistorialVentasClient from "../historial-ventas/historial-ventas-client"

type Tab = "clientes" | "rentabilidad" | "historial"

/** Unifica Clientes + Rentabilidad + Historial en una sola página con tabs —
 * las últimas dos son solo-ADMIN, VENDEDOR nunca ve el selector. */
export function ClientesHubClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === "ADMIN"

  const tabParam = searchParams.get("tab")
  const tab: Tab = esAdmin && (tabParam === "rentabilidad" || tabParam === "historial") ? tabParam : "clientes"

  function cambiarTab(t: Tab) {
    router.push(t === "clientes" ? "/clientes" : `/clientes?tab=${t}`)
  }

  return (
    <div className="space-y-5">
      {esAdmin && (
        <SegmentedTabs
          value={tab}
          onChange={cambiarTab}
          options={[
            { value: "clientes", label: "Clientes" },
            { value: "rentabilidad", label: "Rentabilidad" },
            { value: "historial", label: "Historial" },
          ]}
        />
      )}
      {tab === "clientes" && <ClientesClient />}
      {tab === "rentabilidad" && <RentabilidadClient />}
      {tab === "historial" && <HistorialVentasClient />}
    </div>
  )
}
