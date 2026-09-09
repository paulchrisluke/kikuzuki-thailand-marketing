// GET /api/public/blog?collection=blog|docs - KrabiClaw's published articles in one collection
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { listPublicPlatformBlogPosts } from '~/server/utils/content/publishing'
import { isArticleCollection } from '~/utils/article-collections'
import { getQuery } from 'nitro/h3'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const requested = getQuery(event).collection
  const collection = requested === undefined ? 'blog' : requested
  if (!isArticleCollection(collection)) return jsonResponse({ error: 'Unknown collection' }, { status: 400 })

  try {
    const posts = await listPublicPlatformBlogPosts(db, collection)
    return jsonResponse({ posts })
  } catch (err) {
    console.error('Failed to fetch public blog posts:', err)
    return jsonResponse({ error: 'Failed to fetch posts' }, { status: 500 })
  }
})
import { defineHandler } from 'nitro';
