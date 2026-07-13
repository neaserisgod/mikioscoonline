"use client"

import { useState } from "react"
import { Loader2, Pencil, Eye, EyeOff, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Patrón visual de lista compartido entre todas las pantallas del dashboard
 * (Config, Clientes, y las que se agreguen) — mismo contenedor, misma fila,
 * mismos badges, para que la jerarquía visual sea consistente entre pantallas
 * en vez de reimplementarse a mano con clases parecidas pero no idénticas.
 */

export function Field({ label, error, ...props }: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input {...props} className={cn("rounded-xl", props.className)} />
      {error && <p className="text-xs text-k-loss">{error}</p>}
    </div>
  )
}

export function StatusBadge({ activo, count }: { activo: boolean; count?: number }) {
  if (!activo) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-medium">
      Inactivo
    </span>
  )
  if (count !== undefined) return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
      {count} prod.
    </span>
  )
  return null
}

export function SectionShell({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  )
}

export function ListCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/40 overflow-hidden">
      {children}
    </div>
  )
}

export function ActionRow({
  primary, secondary, badge, activo, extraAction, onEdit, onToggle, onDelete, deleteLabel, isPending,
}: {
  primary: string
  secondary?: string
  badge?: React.ReactNode
  activo: boolean
  /** Slot para una acción extra específica de la pantalla (ej. "Cuenta corriente"), antes de editar/desactivar. */
  extraAction?: React.ReactNode
  onEdit?: () => void
  onToggle: () => void
  onDelete?: () => void
  deleteLabel?: string
  isPending?: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className={cn("px-4 py-3 flex items-center gap-3", !activo && "opacity-60")}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{primary}</p>
          {badge}
        </div>
        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {isPending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}

        {extraAction && !isPending && extraAction}

        {onEdit && !isPending && (
          <Button variant="ghost" size="icon-sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
        )}

        {/* Toggle activo / desactivar */}
        {!isPending && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            title={activo ? "Desactivar" : "Reactivar"}
          >
            {activo ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>
        )}

        {/* Eliminar (hard-delete) solo si hay callback */}
        {onDelete && !isPending && !confirmDelete && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setConfirmDelete(true)}
            title={deleteLabel ?? "Eliminar"}
            className="text-k-loss hover:text-k-loss"
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
        {onDelete && confirmDelete && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-k-loss font-medium">¿Eliminar?</span>
            <Button variant="ghost" size="icon-sm" onClick={() => { onDelete(); setConfirmDelete(false) }} className="text-k-loss">
              <Check className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete(false)}>
              <X className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
