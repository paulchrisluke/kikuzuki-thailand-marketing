import { toWebRequest } from 'h3'
// Google Business connector OAuth callback - stores encrypted connector tokens for organization/site integrations
// import { saveGoogleRefreshToken } from '../../../utils/google-business' // Function removed
import { cloudflareEnv, jsonResponse } from '../../../utils/api-response'

const base64UrlDecode = (value: string) => {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new TextDecoder().decode(bytes)
}

const getRequestCookie = (request: Request, name: string) => {
  const header = request.headers.get('Cookie') ?? ''
  return header
    .split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  const request = toWebRequest(event)

  if (!env.GOOGLE_BUSINESS_CLIENT_ID || !env.GOOGLE_BUSINESS_CLIENT_SECRET) {
    return jsonResponse({ error: 'Missing Google Business OAuth configuration.' }, { status: 500 })
  }

  const url = getRequestURL(event)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expectedState = getRequestCookie(request, 'google_business_oauth_state')

  if (!code || !state || !expectedState || state !== expectedState) {
    return jsonResponse({ error: 'Invalid Google Business OAuth response.' }, { status: 400 })
  }

  const redirectUri = env.GOOGLE_BUSINESS_REDIRECT_URI
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_BUSINESS_CLIENT_ID,
      client_secret: env.GOOGLE_BUSINESS_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    })
  })

  if (!tokenResponse.ok) {
    return jsonResponse({ error: 'Could not verify Google Business OAuth.' }, { status: 401 })
  }

  const tokenBody = (await tokenResponse.json()) as { id_token?: string; refresh_token?: string; scope?: string }
  const [, payload] = tokenBody.id_token?.split('.') ?? []
  if (!payload) return jsonResponse({ error: 'Google did not return an identity token.' }, { status: 401 })

  const identity = JSON.parse(base64UrlDecode(payload)) as {
    aud?: string
    email?: string
    email_verified?: boolean
    exp?: number
  }
  const email = identity.email?.toLowerCase()
  const now = Math.floor(Date.now() / 1000)

  if (identity.aud !== env.GOOGLE_BUSINESS_CLIENT_ID || !identity.email_verified || !email || (identity.exp ?? 0) < now) {
    return jsonResponse({ error: 'Google Business identity token was not valid.' }, { status: 401 })
  }

  // Google Business connector OAuth - separate from Better Auth by design
  // This endpoint stores connector tokens for Google Business API access
  
  // Token saving removed - handled by new Google Business connector flow
  if (tokenBody.refresh_token) {
    // TODO: Implement token storage for new connector flow
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/dashboard/integrations/google-business',
      'Set-Cookie': 'google_business_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    }
  })
})
