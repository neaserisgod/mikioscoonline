import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SwProvider } from "@/components/providers/sw-provider"
import { Toaster } from "@/components/ui/sonner"

// Fuentes autoalojadas (src/assets/fonts) en vez de next/font/google: el build no
// debe depender de la red — clave para poder compilar sin internet y evitar
// problemas de conectividad con fonts.gstatic.com.
// UI/datos — Inter variable (SF-like: geométrica, upright, altísima legibilidad).
// Se reemplazó el woff2 anterior, que estaba guardado en itálica y hacía que toda
// la app se viera inclinada. Fallback a la fuente del sistema (ver globals.css).
const inter = localFont({
  src: [
    { path: "../assets/fonts/inter-variable.woff2", weight: "100 900", style: "normal" },
    { path: "../assets/fonts/inter-variable-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-inter",
  display: "swap",
})
// Títulos — condensada y con peso, tipo cartel de almacén/oferta.
const oswald = localFont({
  src: "../assets/fonts/oswald-variable.woff2",
  weight: "200 700",
  variable: "--font-oswald",
  display: "swap",
})
const geistMono = localFont({
  src: "../assets/fonts/geist-mono-variable.woff2",
  weight: "100 900",
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Kiosco",
  description: "Sistema de gestión para kiosco y almacén",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kiosco",
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
    { media: "(prefers-color-scheme: light)", color: "#ebebeb" },
  ],
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${oswald.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" themes={["light", "gray", "dark"]} disableTransitionOnChange>
          <SessionProvider>
            <QueryProvider>
              <SwProvider />
              {children}
              <Toaster richColors position="top-right" />
            </QueryProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
