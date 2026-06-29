"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import ProductoForm from "../producto-form"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditarProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const qc = useQueryClient()

  const { data: producto, isLoading } = useQuery({
    queryKey: ["producto", id],
    queryFn: () => fetch(`/api/productos/${id}`).then((r) => r.json()),
  })

  function onSuccess() {
    qc.invalidateQueries({ queryKey: ["productos"] })
    qc.invalidateQueries({ queryKey: ["producto", id] })
    toast.success("Producto actualizado")
    router.push("/productos")
  }

  if (isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Editar producto</h1>
      <div className="border rounded-lg p-6">
        <ProductoForm producto={producto} onSuccess={onSuccess} />
      </div>
    </div>
  )
}
