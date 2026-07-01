"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
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

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="size-8 text-muted-foreground hover:text-foreground"
      aria-label="Cambiar tema"
    >
      {mounted ? (isDark ? <Sun className="size-4" /> : <Moon className="size-4" />) : <Moon className="size-4" />}
    </Button>
  )
}
