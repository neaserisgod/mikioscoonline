"use client"

import { PerfilSwitcher } from "@/components/layout/perfil-switcher"

/**
 * Fuerza el selector de perfil tipo Netflix al abrir el kiosco — el server
 * component (DashboardLayout) decide si hace falta según las cookies
 * modo_kiosco/perfil_confirmado y solo monta esto cuando corresponde.
 */
export function PerfilGate() {
  return <PerfilSwitcher open onClose={() => {}} bloqueante />
}
