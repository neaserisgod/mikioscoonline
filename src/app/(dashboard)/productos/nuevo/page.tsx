import { requireSession } from "@/lib/session"
import { NuevoProductoClient } from "./nuevo-producto-client"

export default async function NuevoProductoPage() {
  await requireSession()
  return <NuevoProductoClient />
}
