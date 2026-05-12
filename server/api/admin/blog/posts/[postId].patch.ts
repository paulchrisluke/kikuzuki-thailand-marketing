// PATCH /api/admin/blog/posts/[postId] - Update platform blog post
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { isPlatformOwner } from '~/server/utils/platform-auth'

export default defineEventHandler(async (event) => {
  const postId = getRouterParam(event, 'postId')
  if (!postId) return jsonResponse({ error: 'Post ID required' }, { status: 400 })

  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.email) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  if (!isPlatformOwner(session.user.email)) {
    return jsonResponse({ error: 'Platform owner access required' }, { status: 403 })
  }

  let body: { title?: string; body?: string; excerpt?: string; category?: string; publish?: boolean; unpublish?: boolean }
  try { body = await readBody(event) } catch {
    return jsonResponse({ error: 'Invalid request body' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updates: string[] = ['updated_at = ?']
  const params: any[] = [now]

  if (body.title !== undefined) {
    updates.push('title = ?', 'slug = ?')
    const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    params.push(body.title, slug)
  }
  if (body.body !== undefined) updates.push('body = ?')
  if (body.body !== undefined) params.push(body.body)
  if (body.excerpt !== undefined) updates.push('excerpt = ?')
  if (body.excerpt !== undefined) params.push(body.excerpt)
  if (body.category !== undefined) updates.push('category = ?')
  if (body.category !== undefined) params.push(body.category)
  if (body.publish) updates.push('published_at = ?')
  if (body.publish) params.push(now)
  if (body.unpublish) updates.push('published_at = NULL')

  params.push(postId)
  await db.prepare(`UPDATE platform_blog_posts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

  return jsonResponse({ success: true, updated_at: now })
})
