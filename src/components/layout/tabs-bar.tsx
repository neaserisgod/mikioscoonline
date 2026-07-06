"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, Reorder } from "framer-motion"
import { useSession } from "next-auth/react"
import { X, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useRoutePrefetch } from "@/lib/use-route-prefetch"
import { NAV_ITEMS } from "./nav-drawer"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "pyme_tabs_v1"
const DEFAULT_TABS = ["/inicio", "/vender", "/rentabilidad"]

// ── Store liviano solo de tabs (sin Zustand — solo localStorage + useState) ───

function loadTabs(): string[] {
  if (typeof window === "undefined") return DEFAULT_TABS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_TABS
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TABS
  } catch {
    return DEFAULT_TABS
  }
}

function saveTabs(tabs: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
  } catch {}
}

// Singleton de tabs compartido entre NavDrawer y TabsBar via custom hook
let _tabs: string[] = loadTabs()
const _listeners = new Set<() => void>()

function notifyListeners() {
  _listeners.forEach((fn) => fn())
}

function subscribe(fn: () => void) {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

function getSnapshot(): string[] {
  return _tabs
}

function getServerSnapshot(): string[] {
  return DEFAULT_TABS
}

export function useTabsStore() {
  const tabs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  function addTab(href: string) {
    if (_tabs.includes(href)) return
    _tabs = [..._tabs, href]
    saveTabs(_tabs)
    notifyListeners()
  }

  function removeTab(href: string) {
    if (_tabs.length <= 1) return // mínimo 1
    _tabs = _tabs.filter((t) => t !== href)
    saveTabs(_tabs)
    notifyListeners()
  }

  function reorderTabs(newOrder: string[]) {
    _tabs = newOrder
    saveTabs(_tabs)
    notifyListeners()
  }

  return { tabs, addTab, removeTab, reorderTabs }
}

// ── Componente ────────────────────────────────────────────────────────────────

export function TabsBar() {
  const pathname = usePathname()
  const prefetch = useRoutePrefetch()
  const { data: session } = useSession()
  const esAdmin = session?.user?.role === "ADMIN"
  const { tabs: tabsGuardadas, removeTab, reorderTabs } = useTabsStore()
  const [editMode, setEditMode] = useState(false)

  const navMap = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]))
  const tabs = tabsGuardadas.filter((href) => !navMap[href]?.adminOnly || esAdmin)

  if (tabs.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      {editMode ? (
        <Reorder.Group
          axis="x"
          values={tabs}
          onReorder={reorderTabs}
          className="flex items-center gap-1"
          as="div"
        >
          {tabs.map((href) => {
            const item = navMap[href]
            if (!item) return null
            return (
              <Reorder.Item key={href} value={href} as="div" className="cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1 px-2.5 py-1 xl:px-3 xl:py-1.5 rounded-md bg-muted text-xs xl:text-sm font-medium text-muted-foreground select-none">
                  <item.icon className="size-3 xl:size-3.5 shrink-0" />
                  <span>{item.label}</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${item.label}`}
                    className="ml-0.5 hover:text-k-loss transition-colors"
                    onClick={() => removeTab(href)}
                  >
                    <X className="size-3 xl:size-3.5" />
                  </button>
                </div>
              </Reorder.Item>
            )
          })}
        </Reorder.Group>
      ) : (
        <div className="flex items-center gap-0.5">
          {tabs.map((href) => {
            const item = navMap[href]
            if (!item) return null
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link key={href} href={href} className="relative shrink-0" onMouseEnter={() => prefetch(href)} onFocus={() => prefetch(href)}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 xl:gap-2 px-3 py-1 xl:px-4 xl:py-1.5 rounded-md text-xs xl:text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="tabs-bar-active"
                      className="absolute inset-0 bg-foreground/6 rounded-md"
                      transition={{ type: "spring", stiffness: 380, damping: 38 }}
                    />
                  )}
                  <item.icon className="size-3 xl:size-4 shrink-0 relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={editMode ? "Guardar orden" : "Editar pestañas"}
        className="ml-auto shrink-0 size-6 xl:size-7 text-muted-foreground hover:text-foreground"
        onClick={() => setEditMode((v) => !v)}
      >
        {editMode ? <Check className="size-3 xl:size-3.5" /> : <Pencil className="size-3 xl:size-3.5" />}
      </Button>
    </div>
  )
}
