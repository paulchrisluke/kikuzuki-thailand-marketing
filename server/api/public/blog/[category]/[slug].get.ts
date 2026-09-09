import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getPublishedBlogPost } from '~/server/utils/content/publishing'
import { articleCategoryFromSlug, isArticleCollection } from '~/utils/article-collections'

export default defineHandler(async (event) => {
  const categorySlug = getRouterParam(event, 'category')
  const slug = getRouterParam(event, 'slug')
  if (!categorySlug || !slug) return jsonResponse({ error: 'Category and slug required' }, { status: 400 })

  const { token, collection: requestedCollection } = getQuery(event)
  const collection = requestedCollection === undefined ? 'blog' : requestedCollection
  if (!isArticleCollection(collection)) return jsonResponse({ error: 'Unknown collection' }, { status: 400 })
  const category = articleCategoryFromSlug(collection, categorySlug)
  if (!category) return jsonResponse({ error: 'Post not found' }, { status: 404 })

  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  if (token !== undefined && typeof token !== 'string') return jsonResponse({ error: 'Invalid preview token' }, { status: 400 })
  const post = await getPublishedBlogPost(db, category, slug, env, token, collection)
  if (!post) return jsonResponse({ error: 'Post not found' }, { status: 404 })

  return jsonResponse({ post })
})
import { defineHandler } from 'nitro';
import { getRouterParam, getQuery } from 'nitro/h3';
