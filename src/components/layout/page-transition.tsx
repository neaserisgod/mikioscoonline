"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { NAV_ITEMS } from "./nav-drawer"

const TAB_ORDER = NAV_ITEMS.map((item) => item.href)

function tabIndex(pathname: string): number {
  const found = TAB_ORDER.findIndex((href) => pathname === href || pathname.startsWith(`${href}/`))
  return found === -1 ? 0 : found
}

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 24 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -24 }),
}

/**
 * Desliza el contenido entre secciones (Inicio/Vender/Rentabilidad/Productos/
 * Config) en vez de un cambio de página duro. La dirección sigue el orden de
 * NAV_ITEMS (como pestañas de izquierda a derecha), no el historial real de
 * navegación. `popLayout` saca del flujo al contenido que se va (position:
 * absolute) mientras entra el nuevo, así no queda un hueco en blanco entre
 * transición y transición.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotion()
  const currentIndex = tabIndex(pathname)

  // Deriva la dirección del deslizamiento comparando contra el índice previo,
  // ajustando el estado durante el render (patrón recomendado por React para
  // esto: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // en vez de leer un ref durante el render.
  const [prevIndex, setPrevIndex] = useState(currentIndex)
  const [direction, setDirection] = useState(1)
  if (currentIndex !== prevIndex) {
    setDirection(currentIndex > prevIndex ? 1 : -1)
    setPrevIndex(currentIndex)
  }

  if (reduceMotion) {
    return <div className="h-full">{children}</div>
  }

  return (
    <AnimatePresence mode="popLayout" initial={false} custom={direction}>
      <motion.div
        key={pathname}
        custom={direction}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
