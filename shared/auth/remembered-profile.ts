export const LAST_LOGIN_METHOD_COOKIE = 'better-auth.last_used_login_method'
export const REMEMBERED_PROFILE_COOKIE = 'krabiclaw.remembered_profile'
export const REMEMBERED_PROFILE_MAX_AGE = 60 * 60 * 24 * 30

const MAX_NAME_LENGTH = 64
const MAX_IMAGE_LENGTH = 512

export interface RememberedProfile {
  method: 'google' | 'email' | 'whatsapp'
  identifier: string
  name: string | null
  image: string | null
}

export function loginMethodForPath(path: string | undefined): 'google' | 'email' | 'whatsapp' | null {
  if (path === '/callback/google') return 'google'
  if (path === '/sign-in/email' || path === '/sign-up/email') return 'email'
  if (path === '/phone-number/verify') return 'whatsapp'
  return null
}

// The owner's own face and name, shown back to them on their own device — the
// same thing Facebook and Instagram put on a remembered-account card. An owner
// who cannot read the page still recognises their photo, which is the whole
// point: the alternative was a returning owner clicking "Start free".
export function serializeRememberedProfile(input: { identifier: string, name?: unknown, image?: unknown }): string {
  return JSON.stringify({
    identifier: input.identifier,
    name: typeof input.name === 'string' ? input.name.slice(0, MAX_NAME_LENGTH) : null,
    image: typeof input.image === 'string' ? input.image.slice(0, MAX_IMAGE_LENGTH) : null,
  })
}

// Cookie contents are attacker-controlled, so every field is validated here.
// These hints never establish identity or authorize a request; /login still
// demands the real credential.
export function readRememberedProfile(method: unknown, stored: unknown): RememberedProfile | null {
  if (method !== 'google' && method !== 'email' && method !== 'whatsapp') return null
  if (typeof stored !== 'string' || stored.length > 1024) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(stored)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const { identifier, name, image } = parsed as Record<string, unknown>
  if (typeof identifier !== 'string' || identifier.length > 254) return null
  if (method === 'whatsapp') {
    if (!/^\+[1-9]\d{7,14}$/.test(identifier)) return null
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return null

  return {
    method,
    identifier,
    name: typeof name === 'string' && name.length > 0 && name.length <= MAX_NAME_LENGTH ? name : null,
    // Rendered into an <img src>, so only absolute https URLs are accepted —
    // never javascript:, data: or a protocol-relative host.
    image: typeof image === 'string' && image.length <= MAX_IMAGE_LENGTH && /^https:\/\/[^\s]+$/.test(image) ? image : null,
  }
}
