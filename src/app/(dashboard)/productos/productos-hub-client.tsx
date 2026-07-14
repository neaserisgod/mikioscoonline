"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import ProductosClient from "./productos-client"
import ProveedoresClient from "../proveedores/proveedores-client"
import PedidosClient from "../pedidos/pedidos-client"

type Tab = "productos" | "proveedores" | "pedidos"

/** Unifica Productos + Proveedores + Pedidos a proveedores en una sola página
 * con tabs — las últimas dos son solo-ADMIN, VENDEDOR nunca ve el selector. */
export function ProductosHubClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === "ADMIN"

  const tabParam = searchParams.get("tab")
  const tab: Tab = esAdmin && (tabParam === "proveedores" || tabParam === "pedidos") ? tabParam : "productos"

  function cambiarTab(t: Tab) {
    router.push(t === "productos" ? "/productos" : `/productos?tab=${t}`)
  }

  return (
    <div className="space-y-5">
      {esAdmin && (
        <SegmentedTabs
          value={tab}
          onChange={cambiarTab}
          options={[
            { value: "productos", label: "Productos" },
            { value: "proveedores", label: "Proveedores" },
            { value: "pedidos", label: "Pedidos" },
          ]}
        />
      )}
      {tab === "productos" && <ProductosClient />}
      {tab === "proveedores" && <ProveedoresClient />}
      {tab === "pedidos" && <PedidosClient />}
    </div>
  )
}
