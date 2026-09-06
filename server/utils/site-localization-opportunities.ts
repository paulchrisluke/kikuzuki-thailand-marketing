import { queryAll, type DbClient } from '~/server/db'
import { getPersistedSourceLocale } from '~/server/utils/localization'

interface LocalizableRow {
  id: string
  values_json: string | null
  location_slug?: string | null
  category_id?: string | null
  [field: string]: unknown
}

export interface SiteLocalizationOpportunity {
  id: string
  label: string
  completed: number
  total: number
  path: string
}

export interface SiteLocalizationProgress {
  locale: string
  completed: number
  total: number
  opportunities: SiteLocalizationOpportunity[]
}

function meaningful(value: unknown): boolean {
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return false
    if (text.startsWith('[') || text.startsWith('{')) {
      try { return meaningful(JSON.parse(text)) } catch { return true }
    }
    return true
  }
  if (Array.isArray(value)) return value.some(meaningful)
  if (value && typeof value === 'object') return Object.values(value).some(meaningful)
  return false
}

function localizedValues(row: LocalizableRow): Record<string, unknown> {
  if (!row.values_json) return {}
  const value: unknown = JSON.parse(row.values_json)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Stored resource localization is invalid')
  return value as Record<string, unknown>
}

function progress(rows: readonly LocalizableRow[], fields: readonly string[]): { completed: number; total: number; first: LocalizableRow | null } {
  let completed = 0
  let total = 0
  let first: LocalizableRow | null = null
  for (const row of rows) {
    const values = localizedValues(row)
    for (const field of fields) {
      if (!meaningful(row[field])) continue
      total += 1
      if (meaningful(values[field])) completed += 1
      else if (!first) first = row
    }
  }
  return { completed, total, first }
}

function opportunity(
  id: string,
  label: string,
  result: ReturnType<typeof progress>,
  path: (first: LocalizableRow) => string,
): SiteLocalizationOpportunity | null {
  if (!result.first || result.completed === result.total) return null
  return { id, label, completed: result.completed, total: result.total, path: path(result.first) }
}

export async function getSiteLocalizationProgress(
  db: DbClient,
  input: { organizationId: string; siteId: string; locale: string },
): Promise<SiteLocalizationProgress> {
  const source = await getPersistedSourceLocale(db, input.organizationId, input.siteId)
  if (input.locale === source.locale) throw new Error('Localization progress requires an additional language')
  const params = [input.locale, input.organizationId, input.siteId]
  const [site, locations, menu, experiences, posts, blog, qa, media, links, pages] = await Promise.all([
    queryAll<LocalizableRow>(db, `SELECT s.id, s.brand_name, s.brand_description, rl.values_json
      FROM sites s LEFT JOIN resource_localizations rl ON rl.resource_type = 'site' AND rl.resource_id = s.id AND rl.locale = ?
        AND rl.organization_id = s.organization_id AND rl.site_id = s.id
      WHERE s.organization_id = ? AND s.id = ?`, params),
    queryAll<LocalizableRow>(db, `SELECT l.id, l.slug AS location_slug, l.title, l.address, l.city, l.neighborhood, l.description, l.short_description, l.opening_hours, rl.values_json
      FROM business_locations l LEFT JOIN resource_localizations rl ON rl.resource_type = 'business_location' AND rl.resource_id = l.id AND rl.locale = ?
        AND rl.organization_id = l.organization_id AND rl.site_id = l.site_id
      WHERE l.organization_id = ? AND l.site_id = ? AND l.status = 'active' ORDER BY l.id`, params),
    queryAll<LocalizableRow>(db, `
      SELECT p.id, l.slug AS location_slug, p.category_id, p.name, p.description, p.tags_json, p.details_json, rl.values_json
        FROM products p JOIN business_locations l ON l.id = p.location_id
        LEFT JOIN resource_localizations rl ON rl.resource_type = 'product' AND rl.resource_id = p.id AND rl.locale = ?
          AND rl.organization_id = p.organization_id AND rl.site_id = p.site_id
       WHERE p.organization_id = ? AND p.site_id = ? AND p.product_type = 'standard' AND p.is_visible = 1
      UNION ALL
      SELECT c.id, l.slug AS location_slug, c.id AS category_id, c.name, NULL, NULL, NULL, rl.values_json
        FROM product_categories c JOIN business_locations l ON l.id = c.location_id
        LEFT JOIN resource_localizations rl ON rl.resource_type = 'product_category' AND rl.resource_id = c.id AND rl.locale = ?
          AND rl.organization_id = c.organization_id AND rl.site_id = c.site_id
       WHERE c.organization_id = ? AND c.site_id = ? AND c.product_type = 'standard'`, [...params, ...params]),
    queryAll<LocalizableRow>(db, `SELECT e.id, l.slug AS location_slug, p.name AS title, p.description AS body, e.tagline, e.pricing_note,
        e.included_items AS included_items_json, e.what_to_bring, e.meeting_point, e.cancellation_policy, rl.values_json
      FROM experiences e JOIN products p ON p.id = e.id JOIN business_locations l ON l.id = e.location_id
      LEFT JOIN resource_localizations rl ON rl.resource_type = 'experience' AND rl.resource_id = e.id AND rl.locale = ?
        AND rl.organization_id = e.organization_id AND rl.site_id = e.site_id
      WHERE e.organization_id = ? AND e.site_id = ? AND p.is_visible = 1 ORDER BY e.id`, params),
    queryAll<LocalizableRow>(db, `SELECT p.id, l.slug AS location_slug, p.title, p.body, p.event_title, p.offer_terms, rl.values_json
      FROM posts p LEFT JOIN business_locations l ON l.id = p.location_id
      LEFT JOIN resource_localizations rl ON rl.resource_type = 'site_post' AND rl.resource_id = p.id AND rl.locale = ?
        AND rl.organization_id = p.organization_id AND rl.site_id = p.site_id
      WHERE p.organization_id = ? AND p.site_id = ? AND p.status = 'published' AND p.location_id IS NOT NULL ORDER BY p.id`, params),
    queryAll<LocalizableRow>(db, `SELECT p.id, p.title, p.excerpt, p.category, p.tags_json, p.nav_title, p.seo_keywords, rl.values_json
      FROM blog_posts p LEFT JOIN resource_localizations rl ON rl.resource_type = 'tenant_blog_post' AND rl.resource_id = p.id AND rl.locale = ?
        AND rl.organization_id = p.organization_id AND rl.site_id = p.site_id
      WHERE p.organization_id = ? AND p.site_id = ? AND p.status = 'published' ORDER BY p.id`, params),
    queryAll<LocalizableRow>(db, `SELECT q.id, l.slug AS location_slug, q.question, q.answer, rl.values_json
      FROM location_qa q JOIN business_locations l ON l.id = q.location_id
      LEFT JOIN resource_localizations rl ON rl.resource_type = 'location_qa' AND rl.resource_id = q.id AND rl.locale = ?
        AND rl.organization_id = q.organization_id AND rl.site_id = q.site_id
      WHERE q.organization_id = ? AND q.site_id = ? AND q.status = 'published' ORDER BY q.id`, params),
    queryAll<LocalizableRow>(db, `SELECT m.id, m.alt_text, rl.values_json
      FROM media_assets m LEFT JOIN resource_localizations rl ON rl.resource_type = 'media_asset' AND rl.resource_id = m.id AND rl.locale = ?
        AND rl.organization_id = m.organization_id AND rl.site_id = m.site_id
      WHERE m.organization_id = ? AND m.site_id = ? AND m.status = 'active' ORDER BY m.id`, params),
    queryAll<LocalizableRow>(db, `
      SELECT p.id, p.title, NULL AS label, rl.values_json FROM site_link_pages p
      LEFT JOIN resource_localizations rl ON rl.resource_type = 'site_link_page' AND rl.resource_id = p.id AND rl.locale = ?
        AND rl.organization_id = p.organization_id AND rl.site_id = p.site_id
      WHERE p.organization_id = ? AND p.site_id = ?
      UNION ALL
      SELECT i.id, NULL AS title, i.label, rl.values_json FROM site_link_items i
      LEFT JOIN resource_localizations rl ON rl.resource_type = 'site_link_item' AND rl.resource_id = i.id AND rl.locale = ?
        AND rl.organization_id = i.organization_id AND rl.site_id = i.site_id
      WHERE i.organization_id = ? AND i.site_id = ? AND i.status = 'active'`, [...params, ...params]),
    queryAll<LocalizableRow>(db, `SELECT source.page_id AS id, source.title, source.summary,
        CASE WHEN translated.id IS NULL THEN NULL ELSE json_object(
          'title', translated.title,
          'summary', translated.summary,
          'content', (SELECT json_group_array(json(block.data_json)) FROM content_blocks block WHERE block.document_id = translated.document_id)
        ) END AS values_json,
        (SELECT json_group_array(json(block.data_json)) FROM content_blocks block WHERE block.document_id = source.document_id) AS content
      FROM tenant_page_variants source
      LEFT JOIN tenant_page_variants translated ON translated.page_id = source.page_id AND translated.locale = ?
        AND translated.organization_id = source.organization_id AND translated.site_id = source.site_id
      WHERE source.organization_id = ? AND source.site_id = ? AND source.locale = ? ORDER BY source.page_id`, [...params, source.locale]),
  ])

  const groups = [
    { id: 'brand', label: 'Brand', result: progress(site, ['brand_name', 'brand_description']), path: () => 'brand/name' },
    { id: 'locations', label: 'Locations', result: progress(locations, ['title', 'address', 'city', 'neighborhood', 'description', 'short_description', 'opening_hours']), path: (row: LocalizableRow) => `locations/${row.location_slug}/settings/profile` },
    { id: 'menu', label: 'Menu', result: progress(menu, ['name', 'description', 'tags_json', 'details_json']), path: (row: LocalizableRow) => `locations/${row.location_slug}/products/${row.category_id}` },
    { id: 'experiences', label: 'Experiences', result: progress(experiences, ['title', 'body', 'tagline', 'pricing_note', 'included_items_json', 'what_to_bring', 'meeting_point', 'cancellation_policy']), path: (row: LocalizableRow) => `locations/${row.location_slug}/experiences/${row.id}/details` },
    { id: 'pages', label: 'Pages', result: progress(pages, ['title', 'summary', 'content']), path: () => 'pages' },
    { id: 'posts', label: 'Posts', result: progress(posts, ['title', 'body', 'event_title', 'offer_terms']), path: (row: LocalizableRow) => `locations/${row.location_slug}/posts/${row.id}` },
    { id: 'blog', label: 'Blog', result: progress(blog, ['title', 'excerpt', 'category', 'tags_json', 'nav_title', 'seo_keywords']), path: (row: LocalizableRow) => `blog/${row.id}` },
    { id: 'qa', label: 'Q&A', result: progress(qa, ['question', 'answer']), path: (row: LocalizableRow) => `locations/${row.location_slug}/qa` },
    { id: 'media', label: 'Media', result: progress(media, ['alt_text']), path: () => 'media' },
    { id: 'links', label: 'Links', result: progress(links, ['title', 'label']), path: () => 'links' },
  ]
  const results = groups
    .map(group => opportunity(group.id, group.label, group.result, group.path))
    .filter((item): item is SiteLocalizationOpportunity => item !== null)
  return {
    locale: input.locale,
    completed: groups.reduce((sum, group) => sum + group.result.completed, 0),
    total: groups.reduce((sum, group) => sum + group.result.total, 0),
    opportunities: results,
  }
}
