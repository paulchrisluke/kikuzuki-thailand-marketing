// POST /api/admin/content/[page] - Update platform page content
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { isPlatformOwner } from '~/server/utils/platform-auth'

export default defineEventHandler(async (event) => {
  const page = getRouterParam(event, 'page')
  if (!page) return jsonResponse({ error: 'Page required' }, { status: 400 })

  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.email) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  if (!isPlatformOwner(session.user.email)) {
    return jsonResponse({ error: 'Platform owner access required' }, { status: 403 })
  }

  let body: { content?: string }
  try { body = await readBody(event) } catch {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.content !== 'string') {
    return jsonResponse({ error: 'content is required' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const userId = session.user.id

  const existing = await db.prepare(
    `SELECT id FROM platform_content WHERE page = ? LIMIT 1`
  ).bind(page).first()

  if (existing) {
    await db.prepare(
      `UPDATE platform_content SET content = ?, updated_by = ?, updated_at = ? WHERE page = ?`
    ).bind(body.content, userId, now, page).run()
  } else {
    const id = crypto.randomUUID()
    await db.prepare(
      `INSERT INTO platform_content (id, page, content, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(id, page, body.content, userId, now).run()
  }

  return jsonResponse({ success: true, page, updated_at: now })
})
