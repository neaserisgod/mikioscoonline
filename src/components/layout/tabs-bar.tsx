"use client"

import { useState, useCallback, useSyncExternalStore } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, Reorder } from "framer-motion"
import { X, Pencil, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useQueryClient } from "@tanstack/react-query"
import { NAV_ITEMS } from "./nav-drawer"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "pyme_tabs_v1"
const DEFAULT_TABS = ["/", "/vender", "/rentabilidad"]

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

const TODAY = new Date().toISOString().slice(0, 10)

const PREFETCH_MAP: Record<string, Array<{ key: unknown[]; url: string }>> = {
  "/": [
    { key: ["resumen"], url: "/api/resumen" },
    { key: ["cajas-panel"], url: "/api/cajas" },
  ],
  "/productos": [
    { key: ["productos", ""], url: "/api/productos?q=" },
  ],
  "/vender": [
    { key: ["medios-pago"], url: "/api/config/medios-pago" },
    { key: ["cajas-panel"], url: "/api/cajas" },
  ],
  "/rentabilidad": [
    { key: ["rentabilidad", "proveedor", TODAY, TODAY], url: `/api/rentabilidad?por=proveedor&desde=${TODAY}&hasta=${TODAY}` },
  ],
}

export function TabsBar() {
  const pathname = usePathname()
  const qc = useQueryClient()
  const { tabs, removeTab, reorderTabs } = useTabsStore()
  const [editMode, setEditMode] = useState(false)

  const prefetch = useCallback((href: string) => {
    const queries = PREFETCH_MAP[href]
    if (!queries) return
    for (const { key, url } of queries) {
      if (qc.getQueryState(key)?.data != null) continue
      qc.prefetchQuery({ queryKey: key, queryFn: () => fetch(url).then(r => r.json()), staleTime: 30_000 })
    }
  }, [qc])

  const navMap = Object.fromEntries(NAV_ITEMS.map((i) => [i.href, i]))

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
