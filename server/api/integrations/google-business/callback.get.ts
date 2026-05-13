import { cloudflareEnv } from '../../../utils/api-response'
import { exchangeGoogleBusinessCode, storeGoogleBusinessConnection } from '../../../utils/google-business'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)

  if (!env.GOOGLE_BUSINESS_CLIENT_ID || !env.GOOGLE_BUSINESS_CLIENT_SECRET) {
    return new Response('Missing Google Business OAuth configuration.', { status: 500 })
  }

  const url = getRequestURL(event)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return new Response(null, { status: 302, headers: { Location: '/dashboard?gb=error' } })
  }

  let stateData: { siteId: string; organizationId: string; userId: string; locationId?: string; timestamp: number }
  try {
    stateData = JSON.parse(state)
  } catch {
    return new Response(null, { status: 302, headers: { Location: '/dashboard?gb=error' } })
  }

  const { siteId, organizationId, userId, locationId, timestamp } = stateData

  if (!siteId || !organizationId || !userId || Date.now() - timestamp > 10 * 60 * 1000) {
    return new Response(null, { status: 302, headers: { Location: '/dashboard?gb=expired' } })
  }

  try {
    const tokenData = await exchangeGoogleBusinessCode(env, code)

    const userInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.accessToken}`)
    const userInfo = await userInfoResponse.json() as { email: string }

    await storeGoogleBusinessConnection(env, {
      organization_id: organizationId,
      site_id: siteId,
      location_id: locationId,
      connected_by_user_id: userId,
      provider_account_email: userInfo.email,
      encrypted_access_token: tokenData.accessToken,
      encrypted_refresh_token: tokenData.refreshToken,
      scopes: tokenData.scope,
      expires_at: new Date(Date.now() + tokenData.expiresIn * 1000).toISOString(),
      status: 'active'
    })

    const redirectTo = locationId
      ? `/dashboard/sites/${siteId}/locations/${locationId}?gb=connected`
      : `/dashboard/sites/${siteId}?gb=connected`

    return new Response(null, { status: 302, headers: { Location: redirectTo } })
  } catch (error) {
    console.error('Google Business OAuth callback failed:', error)
    return new Response(null, { status: 302, headers: { Location: '/dashboard?gb=error' } })
  }
})
