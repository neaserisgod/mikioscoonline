import { requireAdminSession } from "@/lib/session"
import { ConfigClient } from "./config-client"

export default async function ConfigPage() {
  await requireAdminSession()
  return <ConfigClient />
}
