// GET /api/public/sites/[siteId]/blog - List a tenant site's published blog posts
import { queryAll } from '~/server/db'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { attachCover } from '~/server/utils/content/publishing'
import { COVER_SELECT, coverJoinSql } from '~/server/utils/content/cover'

export default defineHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  if (!siteId) return jsonResponse({ error: 'Site ID required' }, { status: 400 })

  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const sql = `
    SELECT
      p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, p.seo_description, p.seo_keywords, p.canonical_url, p.robots, p.published_at, p.updated_at, ${COVER_SELECT}
    FROM content_documents p
    ${coverJoinSql('p')}
    WHERE p.kind = 'article' AND p.row_role = 'root' AND p.status = 'published' AND p.site_id = ? AND p.visibility = 'public'
    ORDER BY p.published_at IS NULL, p.published_at DESC, p.id DESC
    LIMIT 50
  `

  try {
    const results = await queryAll<ApiRecord>(db, sql, [siteId])
    return jsonResponse({ posts: (results ?? []).map(attachCover) })
  } catch (err) {
    console.error('Failed to fetch public site blog posts:', err)
    return jsonResponse({ error: 'Failed to fetch posts' }, { status: 500 })
  }
})
import { defineHandler } from 'nitro';
import { getRouterParam } from 'nitro/h3';
