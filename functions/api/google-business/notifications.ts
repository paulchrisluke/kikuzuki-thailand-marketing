import { syncGoogleBusiness } from '../../_shared/google-business'

interface Env {
  GOOGLE_BUSINESS_ACCOUNT_ID?: string
  GOOGLE_BUSINESS_LOCATION_ID?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_PUBSUB_PUSH_TOKEN?: string
  REVIEWS_DB: D1Database
}

const decodePubSubData = (data?: string) => {
  if (!data) return null
  try {
    return JSON.parse(atob(data))
  } catch {
    return data
  }
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
  const url = new URL(request.url)
  const expectedToken = env.GOOGLE_PUBSUB_PUSH_TOKEN

  if (expectedToken && url.searchParams.get('token') !== expectedToken) {
    return json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json<{
    message?: {
      data?: string
      attributes?: Record<string, string>
      messageId?: string
      publishTime?: string
    }
    subscription?: string
  }>()
  const decoded = decodePubSubData(body.message?.data)
  const payload = typeof decoded === 'object' && decoded !== null ? decoded as Record<string, unknown> : {}
  const eventType = String(payload.notificationType ?? body.message?.attributes?.notificationType ?? 'UNKNOWN')
  const locationName = String(payload.locationName ?? payload.location_name ?? body.message?.attributes?.locationName ?? '')
  const reviewName = String(payload.reviewName ?? payload.review_name ?? body.message?.attributes?.reviewName ?? '')
  const eventId = body.message?.messageId ?? crypto.randomUUID()

  await env.REVIEWS_DB.prepare(
    `INSERT OR IGNORE INTO google_business_events (id, source, event_type, location_name, review_name, raw_json, status)
     VALUES (?, 'google-pubsub', ?, ?, ?, ?, 'received')`
  ).bind(eventId, eventType, locationName, reviewName, JSON.stringify({ body, decoded })).run()

  try {
    await syncGoogleBusiness(env)
    await env.REVIEWS_DB.prepare(
      `UPDATE google_business_events SET status = 'synced' WHERE id = ?`
    ).bind(eventId).run()
    return json({ ok: true })
  } catch (error) {
    await env.REVIEWS_DB.prepare(
      `UPDATE google_business_events SET status = 'sync_failed' WHERE id = ?`
    ).bind(eventId).run()
    return json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 202 })
  }
}
