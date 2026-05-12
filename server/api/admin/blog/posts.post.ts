// POST /api/admin/blog/posts - Create platform blog post
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { isPlatformOwner } from '~/server/utils/platform-auth'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.email) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  if (!isPlatformOwner(session.user.email)) {
    return jsonResponse({ error: 'Platform owner access required' }, { status: 403 })
  }

  let body: { title?: string; body?: string; excerpt?: string; category?: string; publish?: boolean }
  try { body = await readBody(event) } catch {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.title || !body.body) {
    return jsonResponse({ error: 'title and body are required' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const now = new Date().toISOString()
  const userId = session.user.id

  const publishedAt = body.publish ? now : null

  await db.prepare(
    `INSERT INTO platform_blog_posts (id, title, slug, body, excerpt, category, author_id, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.title, slug, body.body, body.excerpt ?? null, body.category ?? null, userId, publishedAt, now, now).run()

  return jsonResponse({ success: true, id, slug, published_at: publishedAt })
})
