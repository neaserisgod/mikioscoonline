"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ProductoForm } from "@/components/productos/producto-form"
import type { ProductoInput } from "@/lib/validations/productos"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()
  const [loading, setLoading] = useState(false)

  const { data: producto, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => fetch(`/api/productos/${id}`).then((r) => r.json()),
  })

  async function handleSubmit(data: ProductoInput) {
    setLoading(true)
    const res = await fetch(`/api/productos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast.success("Producto actualizado")
      qc.invalidateQueries({ queryKey: ["productos"] })
      router.push("/productos")
    } else {
      const err = await res.json()
      toast.error(err.error?.message ?? "Error al actualizar")
      setLoading(false)
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <div className="border rounded-lg p-6">
        <ProductoForm defaultValues={producto} onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  )
}
