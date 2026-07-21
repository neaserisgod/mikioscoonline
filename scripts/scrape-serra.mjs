// scrape-serra.mjs
// Baja el catálogo completo de la tienda "Serra (Bariloche)" (plataforma Tiendapropio /
// Central de Ofertas) a un CSV.
//
// Cómo funciona:
//  - La tienda es un Next.js que renderiza en el cliente; los datos NO están en el HTML.
//    Vienen de una API JSON (BFF): /api/search-module/product-displays?page=N (32 x página).
//  - Esa API pide un header `x-site` (un JWT que identifica la tienda). Con eso solo ya
//    devuelve el catálogo, PERO los precios vienen ocultos (estado OBFUSCATED_PRICE) porque
//    la tienda tiene `requireClientCodeToViewPrices`.
//  - Para ver precios hay que estar logueado como cliente. Este script abre un navegador
//    visible: si te logueás (o ya tenés sesión), captura el header de sesión y los precios
//    aparecen. Si no te logueás, baja el catálogo igual pero sin precios.
//
// Uso:
//   node scripts/scrape-serra.mjs
//   (requiere Playwright, que ya está en el repo)
//
// Salida: catalogo-serra.csv en la raíz del repo.

import { chromium } from "playwright"
import { writeFileSync } from "node:fs"

const STORE_URL = "https://gruposerrabariloche.tiendapropio.com/search?page=1"
const API_BASE = "https://propio-bff.centraldeofertas.com.ar/api/search-module/product-displays?page="
const OUT = "catalogo-serra.csv"
const LOGIN_WAIT_MS = 60_000 // tiempo para que te loguees a mano (para ver precios)

const COLS = ["sku", "marca", "descripcion", "categoria", "subcategoria", "precio", "unidad", "stock", "estado", "imagen"]

function csvEscape(v) {
  v = v == null ? "" : String(v)
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v
}

const run = async () => {
  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  // Capturar los headers que la app manda al BFF (x-site + x-auth de sesión).
  const captured = {}
  page.on("request", (req) => {
    if (req.url().includes("/api/search-module/") || req.url().includes("/api/products-groups")) {
      const h = req.headers()
      if (h["x-site"]) captured["x-site"] = h["x-site"]
      if (h["x-auth"]) captured["x-auth"] = h["x-auth"]
    }
  })

  console.log("Abriendo la tienda…")
  await page.goto(STORE_URL, { waitUntil: "networkidle" })

  console.log(
    `\nTenés ~${LOGIN_WAIT_MS / 1000}s para loguearte en la ventana si querés PRECIOS.\n` +
      "Si solo querés el catálogo sin precios, esperá o cerrá el aviso.\n"
  )
  await page.waitForTimeout(LOGIN_WAIT_MS)

  // Refrescar para capturar los headers ya con la sesión iniciada.
  await page.goto(STORE_URL, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)

  if (!captured["x-site"]) {
    console.error("No se pudo capturar el header x-site. Abortando.")
    await browser.close()
    process.exit(1)
  }
  console.log("Headers capturados:", Object.keys(captured).join(", "))

  // Loop de páginas dentro del contexto de la página (mismo origen → sin CORS).
  const rows = await page.evaluate(
    async ({ apiBase, headers }) => {
      const get = (u) =>
        new Promise((res) => {
          const x = new XMLHttpRequest()
          x.open("GET", u)
          x.setRequestHeader("Accept", "application/json")
          for (const k in headers) x.setRequestHeader(k, headers[k])
          x.onload = () => res({ s: x.status, b: x.responseText })
          x.onerror = () => res({ s: "neterr" })
          x.send()
        })
      const all = []
      let pageNum = 1
      let guard = 0
      while (pageNum && guard < 500) {
        guard++
        const r = await get(apiBase + pageNum)
        if (r.s !== 200) break
        const j = JSON.parse(r.b)
        for (const p of j.productDisplays) {
          all.push({
            sku: p.externalProductId,
            marca: p.brandName,
            descripcion: p.description,
            categoria: p.categoryName,
            subcategoria: p.subcategoryName,
            precio: p.bestPriceSale && p.bestPriceSale.price != null ? p.bestPriceSale.price : "",
            unidad: p.priceUnit,
            stock: p.stock,
            estado: p.status,
            imagen: p.image,
          })
        }
        pageNum = j.nextPage
        await new Promise((r) => setTimeout(r, 200))
      }
      return all
    },
    { apiBase: API_BASE, headers: captured }
  )

  const conPrecio = rows.filter((r) => r.precio !== "").length
  const csv = [COLS.join(","), ...rows.map((r) => COLS.map((c) => csvEscape(r[c])).join(","))].join("\n")
  writeFileSync(OUT, csv, "utf8")

  console.log(`\n✅ ${rows.length} productos → ${OUT}`)
  console.log(`   Con precio: ${conPrecio} | Sin precio (ocultos): ${rows.length - conPrecio}`)
  if (conPrecio === 0) {
    console.log("   (Todos ocultos: no había sesión de cliente logueada. Corré de nuevo y logueate para ver precios.)")
  }
  await browser.close()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
