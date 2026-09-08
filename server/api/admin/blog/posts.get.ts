// GET /api/admin/blog/posts - List platform blog posts
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { platformPermissionJsonResponse } from '~/server/utils/platform-admin-users'
import { listBlogPosts } from '~/server/utils/content/publishing'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const permissionDenied = await platformPermissionJsonResponse(event, env, { platform: ['content'] })
  if (permissionDenied) return permissionDenied

  const query = getQuery(event)
  const status = query.status as string | undefined

  return jsonResponse({ posts: await listBlogPosts(db, status, null, env) })
})
import { defineHandler } from 'nitro';
import { getQuery } from 'nitro/h3';
