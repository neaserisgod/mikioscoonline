import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// M6 — estos dos GET no envolvían la llamada al service en try/catch, a
// diferencia del resto de las rutas del núcleo: una excepción (ej. Prisma
// caído) se propagaba cruda como un 500 de Next.js sin control, en vez de un
// error normalizado sin filtrar detalles internos.

const requireAdminApiMock = vi.fn()
const requireSessionApiMock = vi.fn()
vi.mock("@/lib/api-auth", () => ({
  requireAdminApi: requireAdminApiMock,
  requireSessionApi: requireSessionApiMock,
}))

const listarPaginadoMock = vi.fn()
const listarTraspasosPendientesMock = vi.fn()
vi.mock("@/services/venta.service", () => ({
  ventaService: {
    listarPaginado: listarPaginadoMock,
    listarTraspasosPendientes: listarTraspasosPendientesMock,
  },
}))

const SESSION_OK = { user: { id: "u1", organizationId: "org-1", role: "ADMIN" } }

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminApiMock.mockResolvedValue(SESSION_OK)
  requireSessionApiMock.mockResolvedValue(SESSION_OK)
})

describe("GET /api/ventas — no propaga errores crudos (M6)", () => {
  it("listarPaginado lanza: responde 500 con mensaje genérico, no el error crudo", async () => {
    listarPaginadoMock.mockRejectedValue(new Error("Prisma: connection terminated unexpectedly"))
    const { GET } = await import("@/app/api/ventas/route")

    const res = (await GET(new NextRequest("http://localhost/api/ventas?desde=2026-01-01&hasta=2026-01-31")))!

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).not.toMatch(/Prisma|connection/)
  })

  it("camino feliz sin regresión: devuelve el listado normalmente", async () => {
    listarPaginadoMock.mockResolvedValue({ ventas: [], total: 0 })
    const { GET } = await import("@/app/api/ventas/route")

    const res = (await GET(new NextRequest("http://localhost/api/ventas?desde=2026-01-01&hasta=2026-01-31")))!

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ventas: [], total: 0, page: 1, pageSize: 50 })
  })
})

describe("GET /api/ventas/traspaso-pendiente — no propaga errores crudos (M6)", () => {
  it("listarTraspasosPendientes lanza: responde 500 con mensaje genérico", async () => {
    listarTraspasosPendientesMock.mockRejectedValue(new Error("Prisma: timeout"))
    const { GET } = await import("@/app/api/ventas/traspaso-pendiente/route")

    const res = (await GET())!

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).not.toMatch(/Prisma|timeout/)
  })

  it("camino feliz sin regresión", async () => {
    listarTraspasosPendientesMock.mockResolvedValue({ pendientes: [], totalCentavos: 0, bloqueante: false })
    const { GET } = await import("@/app/api/ventas/traspaso-pendiente/route")

    const res = (await GET())!

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ pendientes: [], totalCentavos: 0, bloqueante: false })
  })
})
