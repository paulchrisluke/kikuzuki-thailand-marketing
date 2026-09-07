export interface AppReturnTarget {
  redirect?: string
  plan?: string
}

export function validatedInternalPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined
  try {
    const resolved = new URL(value, 'https://krabiclaw.internal')
    if (resolved.pathname === '/admin' || resolved.pathname.startsWith('/admin/')) return undefined
    return resolved.origin === 'https://krabiclaw.internal'
      ? `${resolved.pathname}${resolved.search}${resolved.hash}`
      : undefined
  } catch {
    return undefined
  }
}

export function buildPostLoginUrl(target: AppReturnTarget = {}): string {
  const redirect = validatedInternalPath(target.redirect)
  const query = new URLSearchParams()
  if (redirect) query.set('redirect', redirect)
  if (target.plan) query.set('plan', target.plan)
  return query.size ? `/api/post-login?${query}` : '/api/post-login'
}

export function buildLoginUrl(target: AppReturnTarget = {}): string {
  const redirect = validatedInternalPath(target.redirect)
  return redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : '/login'
}
