/**
 * Configs de animación compartidas — antes vivían duplicadas (con pequeñas
 * diferencias entre sí: 0.02 vs 0.03, x vs y) en dashboard-client.tsx,
 * productos-client.tsx y rentabilidad-client.tsx. Un solo lugar para que el
 * sistema se sienta igual de fluido en todas las pantallas.
 */

export const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.025 } } },
  item: {
    hidden: { opacity: 0, y: 4 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  },
}

/** Para el paso skeleton → contenido real: evita que el reemplazo se sienta
 * como un salto brusco cuando los datos ya estaban en caché (persistidos) y
 * llegan casi al instante. */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.15 },
}
