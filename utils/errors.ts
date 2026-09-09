export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const data = (error as Record<string, unknown>).data
    if (data && typeof data === 'object') {
      const dataError = (data as Record<string, unknown>).error
      if (typeof dataError === 'string' && dataError) return dataError
    }
    const errorMessage = (error as Record<string, unknown>).message
    if (typeof errorMessage === 'string' && errorMessage) return errorMessage
  }
  return fallback
}

/**
 * Whether the thing being edited is absent, as opposed to a request that
 * failed.
 *
 * The two need different answers. A record that is not there is not a page, and
 * `PRD.md` says an unsupported route 404s rather than rendering something in
 * its place. A request that failed is a state the surface shows, because the
 * record may well still exist. Rendering "not found" inside the pane for both
 * made a deleted record look like a broken editor.
 */
export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { statusCode?: unknown, status?: unknown }
  return candidate.statusCode === 404 || candidate.status === 404
}
