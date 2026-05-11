// DELETE /api/editor/sites/[siteId]/locations/[locationId]/photos/[photoId]
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

  await db.prepare(
    `DELETE FROM location_photos WHERE id = ? AND location_id = ? AND site_id = ?`
  ).bind(photoId, locationId, siteId).run()

  return jsonResponse({ deleted: true })
})
