"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { NavDrawer } from "./nav-drawer"
import { TabsBar } from "./tabs-bar"

const titles: [string, string][] = [
  ["/vender", "Vender"],
  ["/productos", "Productos"],
  ["/clientes", "Clientes"],
  ["/config", "Configuración"],
  ["/inicio", "Inicio"],
]

export function TopBar() {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const title = titles.find(([path]) => pathname.startsWith(path))?.[1] ?? "Kiosco"

  return (
    <>
      <header className="sticky top-0 z-40 h-14 xl:h-16 grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 bg-background/85 backdrop-blur-xl border-b border-border/60 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 xl:size-9 text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Menú"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="size-4 xl:size-5" />
          </Button>
          <h1 className="text-base xl:text-lg font-semibold truncate">{title}</h1>
        </div>

        <div className="flex justify-center min-w-0 overflow-x-auto scrollbar-none">
          <TabsBar />
        </div>

        <ThemeToggle />
      </header>

      <NavDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
