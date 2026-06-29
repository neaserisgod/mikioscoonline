"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, ShoppingCart, TrendingUp, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useVentasStore } from "@/stores/ventas.store"

const staticItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/rentabilidad", label: "Rent.", icon: TrendingUp },
]

export function BottomNav() {
  const pathname = usePathname()
  const isMore = pathname.startsWith("/productos") || pathname.startsWith("/config")
  const { setOverlay, overlayAbierto } = useVentasStore()

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-background/85 backdrop-blur-xl border-t border-border/60 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {staticItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[60px] px-3 py-2 rounded-xl transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="size-5" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          )
        })}

        {/* Botón Vender — abre overlay con carrito activo */}
        <button
          type="button"
          aria-label="Vender"
          onClick={() => setOverlay(true)}
          className={cn(
            "flex flex-col items-center gap-1 min-w-[60px] px-3 py-2 rounded-xl transition-colors",
            overlayAbierto ? "text-primary" : "text-muted-foreground"
          )}
        >
          <ShoppingCart className="size-5" />
          <span className="text-[11px] font-medium">Vender</span>
        </button>

        <Link
          href="/config"
          className={cn(
            "flex flex-col items-center gap-1 min-w-[60px] px-3 py-2 rounded-xl transition-colors",
            isMore ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className="size-5" />
          <span className="text-[11px] font-medium">Más</span>
        </Link>
      </div>
    </nav>
  )
}
