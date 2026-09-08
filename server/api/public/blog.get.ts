// GET /api/public/blog - List published platform blog posts
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { listPublicPlatformBlogPosts } from '~/server/utils/content/publishing'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  try {
    const posts = await listPublicPlatformBlogPosts(db)
    return jsonResponse({ posts })
  } catch (err) {
    console.error('Failed to fetch public blog posts:', err)
    return jsonResponse({ error: 'Failed to fetch posts' }, { status: 500 })
  }
})
import { defineHandler } from 'nitro';
