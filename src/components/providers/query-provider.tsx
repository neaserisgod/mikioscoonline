"use client"

import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { useState } from "react"
import dynamic from "next/dynamic"

// Solo se bundlea en dev — la rama de producción es una función vacía, así que
// el bundler puede eliminar el import de @tanstack/react-query-devtools del build final.
const ReactQueryDevtools =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@tanstack/react-query-devtools").then((m) => m.ReactQueryDevtools), { ssr: false })
    : () => null

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, staleTime: 30_000 },
        },
      })
  )

  // Persiste el cache en localStorage: al reabrir la app, los datos de la
  // última sesión aparecen al instante mientras se revalidan en segundo plano
  // (en vez de arrancar siempre de cero). En el server no hay `window` — se usa
  // un persister no-op para que el árbol de providers sea idéntico en SSR/cliente
  // (cambiar de provider entre renders rompería la hidratación).
  const [persister] = useState(() =>
    typeof window !== "undefined"
      ? createSyncStoragePersister({ storage: window.localStorage, key: "pyme-query-cache" })
      : { persistClient: async () => {}, restoreClient: async () => undefined, removeClient: async () => {} }
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60_000,
        // Atado al build id (ver next.config.ts — SHA de commit, no el semver
        // de package.json), así que CUALQUIER deploy nuevo cambia el buster y
        // descarta el cache persistido entero en vez de reutilizarlo — evita
        // que datos de un build viejo (ej. un shape de resumen anterior a un
        // cambio reciente) se muestren un instante antes de que el fetch
        // fresco los reemplace ("flash de versión vieja").
        buster: process.env.NEXT_PUBLIC_BUILD_ID,
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  )
}
