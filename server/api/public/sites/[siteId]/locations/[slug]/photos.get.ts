// GET /api/public/sites/[siteId]/locations/[slug]/photos
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  const slug = getRouterParam(event, 'slug')
  if (!siteId || !slug) return jsonResponse({ error: 'Missing params' }, { status: 400 })

  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const location = await db.prepare(
    `SELECT id FROM business_locations WHERE site_id = ? AND slug = ? AND status = 'active' LIMIT 1`
  ).bind(siteId, slug).first()
  if (!location) return jsonResponse({ error: 'Location not found' }, { status: 404 })

  const { results } = await db.prepare(
    `SELECT id, google_url, local_url, thumbnail_url, category, description, sort_order
     FROM location_photos
     WHERE location_id = ? AND (google_url IS NOT NULL OR local_url IS NOT NULL)
     ORDER BY category, sort_order, created_at`
  ).bind(location.id).all()

  return jsonResponse({ photos: results ?? [] })
})
