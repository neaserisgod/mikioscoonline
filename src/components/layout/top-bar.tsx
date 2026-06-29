"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { NavDrawer } from "./nav-drawer"

const titles: [string, string][] = [
  ["/vender", "Vender"],
  ["/rentabilidad", "Rentabilidad"],
  ["/productos", "Productos"],
  ["/config", "Configuración"],
  ["/", "Inicio"],
]

export function TopBar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const title =
    titles.find(([path]) => (path === "/" ? pathname === "/" : pathname.startsWith(path)))?.[1] ??
    "Kiosco"

  return (
    <>
      <header className="sticky top-0 z-40 h-14 flex items-center justify-between px-4 bg-background/85 backdrop-blur-xl border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Menú"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-4" />
          </Button>
          <h1 className="text-base font-semibold">{title}</h1>
        </div>
        <ThemeToggle />
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
