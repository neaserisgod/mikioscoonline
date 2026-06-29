"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { ProductoForm } from "@/components/productos/producto-form"
import type { ProductoInput } from "@/lib/validations/productos"
import { toast } from "sonner"

export default function NuevoProductoPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  async function handleSubmit(data: ProductoInput) {
    setLoading(true)
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast.success("Producto creado correctamente")
      qc.invalidateQueries({ queryKey: ["productos"] })
      router.push("/productos")
    } else {
      const err = await res.json()
      toast.error(err.error?.message ?? "Error al crear el producto")
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Nuevo producto</h1>
      <div className="border rounded-lg p-6">
        <ProductoForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  )
}
