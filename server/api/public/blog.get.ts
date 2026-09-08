// GET /api/public/blog - List published platform blog posts
import { queryAll } from '~/server/db'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { attachFeaturedMediaFromBareJoin } from '~/server/utils/content/publishing'
import { blogCategoryToSlug } from '~/utils/blog-categories'
import { PLATFORM_SITE_ID } from '~/shared/platform-scope'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const sql = `
    SELECT
      p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, p.seo_description, p.seo_keywords, p.canonical_url, p.robots, p.published_at, (p.metadata_json ->> '$.nav_section') AS nav_section, (p.metadata_json ->> '$.nav_title') AS nav_title, (p.metadata_json ->> '$.nav_order') AS nav_order, (p.metadata_json ->> '$.nav_section_order') AS nav_section_order, (p.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (p.metadata_json ->> '$.featured_order') AS featured_order, mp.asset_id AS asset_id, ma.public_url, ma.thumbnail_url, ma.kind, ma.alt_text, ma.width, ma.height
    FROM content_documents p
    LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0 AND mp.status = 'active'
    LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
    WHERE p.kind = 'article' AND p.row_role = 'root' AND p.status = 'published' AND p.site_id = '${PLATFORM_SITE_ID}' AND p.visibility = 'public'
    ORDER BY COALESCE((p.metadata_json ->> '$.featured_order'), 999999), COALESCE((p.metadata_json ->> '$.nav_section_order'), 999999), COALESCE((p.metadata_json ->> '$.nav_section'), (p.metadata_json ->> '$.category')), COALESCE((p.metadata_json ->> '$.nav_order'), 999999), p.published_at DESC
    LIMIT 100
  `

  try {
    const results = await queryAll<ApiRecord>(db, sql)
    const posts = (results ?? [])
      .filter(post => blogCategoryToSlug(post.category))
      .map(attachFeaturedMediaFromBareJoin)
    return jsonResponse({ posts })
  } catch (err) {
    console.error('Failed to fetch public blog posts:', err)
    return jsonResponse({ error: 'Failed to fetch posts' }, { status: 500 })
  }
})
import { defineHandler } from 'nitro';
