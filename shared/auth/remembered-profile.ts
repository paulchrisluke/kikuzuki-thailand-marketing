export const LAST_LOGIN_METHOD_COOKIE = 'better-auth.last_used_login_method'
export const REMEMBERED_PROFILE_COOKIE = 'krabiclaw.remembered_profile'
export const REMEMBERED_PROFILE_MAX_AGE = 60 * 60 * 24 * 30

export function loginMethodForPath(path: string | undefined): 'google' | 'email' | 'whatsapp' | null {
  if (path === '/callback/google') return 'google'
  if (path === '/sign-in/email' || path === '/sign-up/email') return 'email'
  if (path === '/phone-number/verify') return 'whatsapp'
  return null
}

// These browser hints never establish identity or authorize a request.
export function readRememberedProfile(method: unknown, identifier: unknown) {
  if (typeof identifier !== 'string' || identifier.length > 254) return null
  if (method === 'whatsapp' && /^\+[1-9]\d{7,14}$/.test(identifier)) return { method, identifier } as const
  if ((method === 'google' || method === 'email') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return { method, identifier } as const
  }
  return null
}
