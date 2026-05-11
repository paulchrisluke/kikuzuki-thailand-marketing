// GET /api/editor/sites/[siteId]/locations/[locationId]/photos
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  const locationId = getRouterParam(event, 'locationId')
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.id) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  const { results } = await db.prepare(
    `SELECT * FROM location_photos WHERE location_id = ? AND site_id = ?
     ORDER BY category, sort_order, created_at`
  ).bind(locationId, siteId).all()

  return jsonResponse({ photos: results ?? [] })
})
