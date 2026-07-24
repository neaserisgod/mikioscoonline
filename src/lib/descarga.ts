/**
 * Utilidades para la descarga de la app de escritorio (Tauri) desde GitHub
 * Releases. La web (Vercel) las usa para ofrecer un botón de descarga y un link
 * estable que SIEMPRE apunta al instalador más nuevo, sin tener que actualizar
 * la web cada vez que se publica una versión.
 *
 * El instalador NSIS sale con el número de versión en el nombre
 * (`La Plazoleta Soft_1.0.5_x64-setup.exe`), así que no existe una URL fija por
 * nombre. En vez de eso consultamos la API de GitHub para resolver, en cada
 * momento, cuál es el asset `-setup.exe` de la última release publicada.
 */

/** owner/repo del repositorio donde se publican las releases de la app. */
export const REPO_APP = "neaserisgod/mikioscoonline"

/** Página de releases (fallback si la API falla o todavía no hay ninguna). */
export const RELEASES_URL = `https://github.com/${REPO_APP}/releases`

export type InstaladorInfo = {
  /** Versión de la última release (ej. "1.0.3"), sin el prefijo "v". */
  version: string
  /** URL directa de descarga del instalador `-setup.exe`. */
  url: string
  /** Fecha de publicación de la release (ISO). */
  publicadoEl: string | null
}

type GithubAsset = { name: string; browser_download_url: string }
type GithubRelease = {
  tag_name: string
  published_at: string | null
  assets: GithubAsset[]
}

/**
 * Devuelve la info del último instalador publicado, o `null` si no se pudo
 * resolver (repo sin releases, API caída, rate limit). El fetch se cachea 5
 * minutos para no pegarle a la API de GitHub en cada visita — el límite sin
 * token es 60 req/hora por IP, y en Vercel todas las visitas comparten IP.
 */
export async function obtenerUltimoInstalador(): Promise<InstaladorInfo | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_APP}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github+json" },
        next: { revalidate: 300 },
      },
    )
    if (!res.ok) return null

    const release = (await res.json()) as GithubRelease
    const setup = release.assets?.find((a) => a.name.endsWith("-setup.exe"))
    if (!setup) return null

    return {
      version: release.tag_name.replace(/^v/, ""),
      url: setup.browser_download_url,
      publicadoEl: release.published_at,
    }
  } catch {
    return null
  }
}
