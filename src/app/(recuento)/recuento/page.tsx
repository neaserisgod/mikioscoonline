import type { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { productoService } from "@/services/producto.service"
import { RecuentoClient } from "./recuento-client"

export const metadata: Metadata = {
  title: "Recuento de stock",
}

export default async function RecuentoPage() {
  const session = await auth()
  if (!session?.user?.organizationId) redirect("/login")

  // resumenProveedores ya arma el bucket "Sin proveedor" (id
  // "__sin_proveedor__") solo si hay productos sueltos — mismo dato que usa
  // Productos en el escritorio, no hace falta una query nueva.
  const proveedores = await productoService.resumenProveedores(session.user.organizationId)

  return (
    <RecuentoClient
      proveedores={proveedores.map((p) => ({ id: p.id, nombre: p.nombre, totalProductos: p.totalProductos }))}
      esAdmin={session.user.role === "ADMIN"}
    />
  )
}
