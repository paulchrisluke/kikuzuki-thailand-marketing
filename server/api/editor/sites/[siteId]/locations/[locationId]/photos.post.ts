// POST /api/editor/sites/[siteId]/locations/[locationId]/photos
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

  const body = await readBody(event)
  const { local_url, google_url, thumbnail_url, category = 'GENERAL', description, sort_order = 0 } = body

  if (!local_url && !google_url) return jsonResponse({ error: 'local_url or google_url required' }, { status: 400 })

  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  // Need org_id from site
  const site = await db.prepare(`SELECT organization_id FROM sites WHERE id = ? LIMIT 1`).bind(siteId).first()
  if (!site) return jsonResponse({ error: 'Site not found' }, { status: 404 })

  await db.prepare(
    `INSERT INTO location_photos (id, organization_id, site_id, location_id, local_url, google_url, thumbnail_url, category, description, source, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`
  ).bind(id, site.organization_id, siteId, locationId, local_url ?? null, google_url ?? null, thumbnail_url ?? null, category, description ?? null, sort_order, now, now).run()

  return jsonResponse({ id, created: true })
})
