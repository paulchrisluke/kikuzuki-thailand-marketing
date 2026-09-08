import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getPublicPlatformBlogPost } from '~/server/utils/platform-content'
import { slugToBlogCategory } from '~/utils/blog-categories'

export default defineHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  const slug = getRouterParam(event, 'slug')
  if (!categorySlug || !slug) return jsonResponse({ error: 'Category and slug required' }, { status: 400 })

  const category = slugToBlogCategory(categorySlug)
  if (!category) return jsonResponse({ error: 'Post not found' }, { status: 404 })

  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const { token } = getQuery(event)
  if (token !== undefined && typeof token !== 'string') return jsonResponse({ error: 'Invalid preview token' }, { status: 400 })
  const post = await getPublicPlatformBlogPost(db, category, slug, env, token)
  if (!post) return jsonResponse({ error: 'Post not found' }, { status: 404 })

  return jsonResponse({ post })
})
import { defineHandler } from 'nitro';
import { getRouterParam, getQuery } from 'nitro/h3';
