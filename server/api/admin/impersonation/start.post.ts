import { appendResponseHeader, getHeader, getRequestURL } from 'h3'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { anonymizeId, isPlatformOwner } from '~/server/utils/platform-auth'

const IMPERSONATION_START_TIMEOUT_MS = 8_000

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  const session = await getAuthSession(event, env)
  if (!session?.user?.email) return jsonResponse({ error: 'Authentication required' }, { status: 401 })
  if (!isPlatformOwner(session.user.email, env)) return jsonResponse({ error: 'Platform owner access required' }, { status: 403 })

  const body = await readBody<{ userId?: string }>(event)
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!userId) return jsonResponse({ error: 'userId is required' }, { status: 400 })
  const hashedUserId = anonymizeId(userId, env)

  const authUrl = `${getRequestURL(event).origin}/api/auth/admin/impersonate-user`
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), IMPERSONATION_START_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(authUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        cookie: getHeader(event, 'cookie') || '',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ userId })
    })
  } catch (error: any) {
    clearTimeout(timeoutHandle)
    const isAbort = error?.name === 'AbortError'
    console.error('admin_impersonation_start_request_failed', {
      hashedUserId,
      authUrl,
      timeoutMs: IMPERSONATION_START_TIMEOUT_MS,
      error: error?.message || 'Unknown network error'
    })
    return jsonResponse({ error: isAbort ? 'Impersonation start timed out' : 'Failed to start impersonation' }, { status: isAbort ? 504 : 502 })
  }

  clearTimeout(timeoutHandle)

  const headerBag = response.headers as Headers & {
    getSetCookie?: () => string[]
    getAll?: (name: string) => string[]
    raw?: () => Record<string, string[]>
  }
  const setCookies = typeof headerBag.getSetCookie === 'function'
    ? headerBag.getSetCookie()
    : typeof headerBag.getAll === 'function'
      ? headerBag.getAll('set-cookie')
      : (headerBag.raw?.()['set-cookie'] || [])

  for (const cookieValue of setCookies) {
    appendResponseHeader(event, 'set-cookie', cookieValue)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    console.error('admin_impersonation_start_failed', { hashedUserId, authUrl, status: response.status, body: text })
    return jsonResponse({ error: 'Failed to start impersonation' }, { status: response.status || 500 })
  }

  return jsonResponse({ success: true })
})