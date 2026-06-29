"use client"

import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import ProductoForm from "../producto-form"

export default function NuevoProductoPage() {
  const router = useRouter()
  const qc = useQueryClient()

  function onSuccess() {
    qc.invalidateQueries({ queryKey: ["productos"] })
    toast.success("Producto creado correctamente")
    router.push("/productos")
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <div className="border rounded-lg p-6">
        <ProductoForm onSuccess={onSuccess} />
      </div>
    </div>
  )
}
