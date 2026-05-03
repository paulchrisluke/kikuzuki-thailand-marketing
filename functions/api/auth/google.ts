interface Env {
  GOOGLE_CLIENT_ID?: string
  GOOGLE_REDIRECT_URI?: string
}

const randomState = () => crypto.randomUUID()

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  if (!env.GOOGLE_CLIENT_ID) {
    return new Response('Missing GOOGLE_CLIENT_ID', { status: 500 })
  }

  const url = new URL(request.url)
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${url.origin}/api/auth/google/callback`
  const state = randomState()
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', 'openid email profile https://www.googleapis.com/auth/business.manage')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent select_account')

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': `kikuzuki_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    }
  })
}
