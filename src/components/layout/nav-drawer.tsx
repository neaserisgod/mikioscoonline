"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Home, ShoppingCart, TrendingUp, Package, Settings, LogOut, Pin, PinOff } from "lucide-react"
import { signOut, useSession } from "next-auth/react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "./theme-toggle"
import { cn } from "@/lib/utils"
import { useTabsStore } from "./tabs-bar"

export const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/vender", label: "Vender", icon: ShoppingCart },
  { href: "/rentabilidad", label: "Rentabilidad", icon: TrendingUp },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/config", label: "Configuración", icon: Settings },
]

interface NavDrawerProps {
  open: boolean
  onClose: () => void
}

export function NavDrawer({ open, onClose }: NavDrawerProps) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const { tabs, addTab, removeTab } = useTabsStore()

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-72 flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border/60 shrink-0">
          <SheetTitle className="text-sm font-semibold tracking-tight text-left">
            {session?.user?.name ?? "Kiosco"}
          </SheetTitle>
        </SheetHeader>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
            const pinned = tabs.includes(item.href)

            return (
              <div key={item.href} className="flex items-center gap-1">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "relative flex flex-1 items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors",
                    active
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-drawer-active"
                      className="absolute inset-0 bg-foreground/6 rounded-xl"
                      transition={{ type: "spring", stiffness: 380, damping: 38 }}
                    />
                  )}
                  <item.icon className="size-4 shrink-0 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </Link>

                <button
                  type="button"
                  aria-label={pinned ? "Quitar pestaña" : "Fijar como pestaña"}
                  onClick={() => (pinned ? removeTab(item.href) : addTab(item.href))}
                  className={cn(
                    "size-7 flex items-center justify-center rounded-lg transition-colors shrink-0",
                    pinned
                      ? "text-primary hover:text-muted-foreground"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  )}
                >
                  {pinned ? <Pin className="size-3.5" /> : <PinOff className="size-3.5" />}
                </button>
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-border/60 space-y-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{session?.user?.name ?? "Usuario"}</p>
              <p className="text-[11px] text-muted-foreground capitalize">
                {session?.user?.role?.toLowerCase()}
              </p>
            </div>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground -ml-1 px-2"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-3.5" />
            Cerrar sesión
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
