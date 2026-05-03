import { isAdminRequest } from '../../../_shared/admin-auth'
import { syncGoogleBusiness, updateNotificationSetting } from '../../../_shared/google-business'

interface Env {
  AUTH_COOKIE_SECRET?: string
  GOOGLE_ADMIN_EMAILS?: string
  GOOGLE_BUSINESS_ACCOUNT_ID?: string
  GOOGLE_BUSINESS_LOCATION_ID?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_PUBSUB_TOPIC?: string
  REVIEWS_ADMIN_TOKEN?: string
  REVIEWS_DB: D1Database
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init.headers
    }
  })

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  if (!(await isAdminRequest(request, env))) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const setupNotifications = url.searchParams.get('setupNotifications') === 'true'
  const notifications = setupNotifications ? await updateNotificationSetting(env) : null
  const sync = await syncGoogleBusiness(env)

  return json({ ok: true, notifications, sync })
}
