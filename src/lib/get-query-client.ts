import { QueryClient } from "@tanstack/react-query"
import { cache } from "react"

// Un QueryClient por request en el server (React.cache lo memoiza durante el render
// de ese request y descarta al terminar) — permite hacer prefetchQuery en Server
// Components y luego hidratar el mismo cache en el cliente via HydrationBoundary.
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: 1, staleTime: 30_000 },
      },
    })
)

/**
 * Normaliza el resultado de una queryFn de prefetch al mismo shape que produce
 * `fetch(...).then(r => r.json())` en el cliente (Dates → strings ISO, etc.).
 * Sin esto, la hidratación inicial tendría Date reales (preservados por RSC/flight)
 * y el primer refetch del cliente los reemplazaría por strings — inconsistencia sutil.
 */
export function serializable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}
