"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { formatARS } from "@/lib/formatters"

interface GraficoVentasProps {
  data: { fecha: string; total: number }[]
}

export function GraficoVentas({ data }: GraficoVentasProps) {
  const formatted = data.map((d) => ({
    fecha: new Date(d.fecha + "T00:00:00").toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    }),
    total: d.total / 100,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v) => [formatARS((v as number) * 100), "Ventas"]}
          contentStyle={{
            backgroundColor: "var(--color-card)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--color-primary)"
          fill="url(#colorVentas)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
