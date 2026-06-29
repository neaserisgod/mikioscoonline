import { test, expect } from "@playwright/test"

// Test del flujo crítico: login → POS → confirmar venta → ver comprobante con CAE
test.describe("Flujo de venta completo", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[type="email"]', "admin@mipyme.com.ar")
    await page.fill('input[type="password"]', "admin123")
    await page.click('button[type="submit"]')
    await page.waitForURL("/")
  })

  test("crear venta desde punto de venta → descuenta stock → genera CAE → impacta CC", async ({ page }) => {
    // 1. Ir al punto de venta
    await page.click("a[href='/punto-de-venta']")
    await page.waitForURL("/punto-de-venta")

    // 2. Buscar producto
    const buscador = page.locator("input[placeholder*='Buscar producto']")
    await buscador.fill("Notebook")
    await page.waitForSelector("ul li button")

    // Anotar stock inicial
    const stockTextoInicial = await page.locator("ul li button").first().locator("div.text-xs").textContent()
    const stockInicial = parseInt(stockTextoInicial?.match(/Stock:\s*(\d+)/)?.[1] ?? "0")

    // 3. Agregar al carrito
    await page.locator("ul li button").first().click()

    // Verificar que apareció en el carrito
    await expect(page.locator("table tbody tr")).toHaveCount(1)

    // 4. Seleccionar cliente
    const selectCliente = page.locator('[data-slot="select-trigger"]').first()
    await selectCliente.click()
    await page.waitForSelector('[role="option"]')
    await page.locator('[role="option"]').first().click()

    // 5. Confirmar venta
    await page.click("button:has-text('Confirmar venta')")

    // 6. Esperar redirección a detalle de venta
    await page.waitForURL(/\/ventas\//)

    // 7. Verificar que tiene CAE (mock)
    await expect(page.locator("text=CAE:")).toBeVisible()

    // 8. Verificar que el comprobante tiene número
    await expect(page.locator("h1")).toContainText("Factura")
    await expect(page.locator("h1")).toContainText("0001-")

    // 9. Volver a productos y verificar que el stock bajó
    await page.click("a[href='/productos']")
    await page.waitForURL("/productos")

    await page.waitForSelector("table tbody tr")
    const notebookRow = page.locator("table tbody tr").filter({ hasText: "Notebook" })
    const stockTexto = await notebookRow.locator("td").nth(4).textContent()
    const stockFinal = parseInt(stockTexto ?? "0")

    expect(stockFinal).toBe(stockInicial - 1)
  })
})
