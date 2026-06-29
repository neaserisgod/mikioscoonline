"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

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
