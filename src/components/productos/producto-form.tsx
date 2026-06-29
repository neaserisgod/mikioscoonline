"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { productoSchema, type ProductoInput } from "@/lib/validations/productos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { centavosToDecimal, decimalToCentavos } from "@/lib/formatters"

interface ProductoFormProps {
  defaultValues?: Partial<ProductoInput & { precioCentavos: number; costoCentavos: number }>
  onSubmit: (data: ProductoInput) => Promise<void>
  loading?: boolean
}

export function ProductoForm({ defaultValues, onSubmit, loading }: ProductoFormProps) {
  const form = useForm<ProductoInput>({
    resolver: zodResolver(productoSchema),
    defaultValues: {
      sku: defaultValues?.sku ?? "",
      name: defaultValues?.name ?? "",
      descripcion: defaultValues?.descripcion ?? "",
      precioCentavos: defaultValues?.precioCentavos ?? 0,
      costoCentavos: defaultValues?.costoCentavos ?? 0,
      alicuotaIVA: defaultValues?.alicuotaIVA ?? 21,
      stock: defaultValues?.stock ?? 0,
      stockMinimo: defaultValues?.stockMinimo ?? 0,
      activo: defaultValues?.activo ?? true,
    },
  })

  function handleSubmit(data: ProductoInput) {
    return onSubmit(data)
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU / Código *</Label>
          <Input id="sku" {...form.register("sku")} />
          {form.formState.errors.sku && (
            <p className="text-xs text-destructive">{form.formState.errors.sku.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre *</Label>
          <Input id="name" {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descripcion">Descripción</Label>
        <Input id="descripcion" {...form.register("descripcion")} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="precio">Precio venta (con IVA) *</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="precio"
              type="number"
              step="0.01"
              min="0"
              className="pl-6"
              defaultValue={centavosToDecimal(defaultValues?.precioCentavos ?? 0)}
              onChange={(e) =>
                form.setValue("precioCentavos", decimalToCentavos(parseFloat(e.target.value) || 0))
              }
            />
          </div>
          {form.formState.errors.precioCentavos && (
            <p className="text-xs text-destructive">{form.formState.errors.precioCentavos.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="costo">Costo</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <Input
              id="costo"
              type="number"
              step="0.01"
              min="0"
              className="pl-6"
              defaultValue={centavosToDecimal(defaultValues?.costoCentavos ?? 0)}
              onChange={(e) =>
                form.setValue("costoCentavos", decimalToCentavos(parseFloat(e.target.value) || 0))
              }
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>IVA *</Label>
          <Select
            defaultValue={String(defaultValues?.alicuotaIVA ?? 21)}
            onValueChange={(v) => v !== null && form.setValue("alicuotaIVA", parseFloat(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="21">21%</SelectItem>
              <SelectItem value="10.5">10,5%</SelectItem>
              <SelectItem value="0">0% (Exento)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock actual</Label>
          <Input
            id="stock"
            type="number"
            min="0"
            {...form.register("stock", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stockMinimo">Stock mínimo (alerta)</Label>
          <Input
            id="stockMinimo"
            type="number"
            min="0"
            {...form.register("stockMinimo", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          Guardar producto
        </Button>
      </div>
    </form>
  )
}
