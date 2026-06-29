"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { clienteSchema, type ClienteInput } from "@/lib/validations/clientes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

interface ClienteFormProps {
  defaultValues?: Partial<ClienteInput>
  onSubmit: (data: ClienteInput) => Promise<void>
  loading?: boolean
}

export function ClienteForm({ defaultValues, onSubmit, loading }: ClienteFormProps) {
  const form = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      razonSocial: defaultValues?.razonSocial ?? "",
      cuit: defaultValues?.cuit ?? "",
      condicionIVA: defaultValues?.condicionIVA ?? "CONSUMIDOR_FINAL",
      email: defaultValues?.email ?? "",
      telefono: defaultValues?.telefono ?? "",
      direccion: defaultValues?.direccion ?? "",
      activo: defaultValues?.activo ?? true,
    },
  })

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre / Apellido *</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="razonSocial">Razón social</Label>
          <Input id="razonSocial" {...form.register("razonSocial")} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cuit">CUIT / DNI</Label>
          <Input id="cuit" {...form.register("cuit")} placeholder="20-12345678-9" />
        </div>
        <div className="space-y-1.5">
          <Label>Condición IVA *</Label>
          <Select
            defaultValue={defaultValues?.condicionIVA ?? "CONSUMIDOR_FINAL"}
            onValueChange={(v) => v !== null && form.setValue("condicionIVA", v as ClienteInput["condicionIVA"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CONSUMIDOR_FINAL">Consumidor Final</SelectItem>
              <SelectItem value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</SelectItem>
              <SelectItem value="MONOTRIBUTO">Monotributista</SelectItem>
              <SelectItem value="EXENTO">Exento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...form.register("email")} />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="telefono">Teléfono</Label>
          <Input id="telefono" {...form.register("telefono")} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="direccion">Dirección</Label>
        <Input id="direccion" {...form.register("direccion")} />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Guardar cliente
        </Button>
      </div>
    </form>
  )
}
