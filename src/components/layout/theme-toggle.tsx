"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Sun, Contrast, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

function subscribeNoop() {
  return () => {}
}

// next-themes solo conoce el tema real después del mount (lee localStorage/preferencia
// del sistema). Usamos useSyncExternalStore en vez de useEffect+setState para evitar
// el render en cascada que el linter marca como anti-patrón.
function useMounted() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false)
}

const CYCLE = ["light", "gray", "dark"] as const
const ICON = { light: Sun, gray: Contrast, dark: Moon } as const
const LABEL = { light: "claro", gray: "gris", dark: "oscuro" } as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const current = mounted && theme && CYCLE.includes(theme as (typeof CYCLE)[number])
    ? (theme as (typeof CYCLE)[number])
    : "dark"
  const Icon = ICON[current]

  function siguiente() {
    const i = CYCLE.indexOf(current)
    setTheme(CYCLE[(i + 1) % CYCLE.length])
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={siguiente}
      className="size-8 xl:size-9 text-muted-foreground hover:text-foreground"
      aria-label={`Cambiar tema (actual: ${LABEL[current]})`}
    >
      <Icon className="size-4 xl:size-5" />
    </Button>
  )
}
