import type { Metadata, Viewport } from "next"
import { Inter, Oswald, Geist_Mono } from "next/font/google"
import "./globals.css"
import { SessionProvider } from "@/components/providers/session-provider"
import { QueryProvider } from "@/components/providers/query-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { SwProvider } from "@/components/providers/sw-provider"
import { Toaster } from "@/components/ui/sonner"

// UI/datos/tablas — grotesk moderna, alta legibilidad a tamaño chico.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
// Títulos — condensada y con peso, tipo cartel de almacén/oferta.
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

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
