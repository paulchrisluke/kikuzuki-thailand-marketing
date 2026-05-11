// PATCH /api/editor/sites/[siteId]/locations/[locationId]/photos/[photoId]
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  const locationId = getRouterParam(event, 'locationId')
  const photoId = getRouterParam(event, 'photoId')
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })
  const session = await getAuthSession(event, env)
  if (!session?.user?.id) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  const body = await readBody(event)
  const allowed = ['local_url', 'google_url', 'thumbnail_url', 'category', 'description', 'sort_order']
  const sets = ['updated_at = ?']
  const params: any[] = [new Date().toISOString()]
  for (const key of allowed) {
    if (key in body) { sets.push(`${key} = ?`); params.push(body[key] ?? null) }
  }
  params.push(photoId, locationId, siteId)

  await db.prepare(
    `UPDATE location_photos SET ${sets.join(', ')} WHERE id = ? AND location_id = ? AND site_id = ?`
  ).bind(...params).run()

  return jsonResponse({ updated: true })
})
