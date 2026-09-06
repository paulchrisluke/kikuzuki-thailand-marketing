import { HTTPError } from 'nitro';

import { execute, executeBatch, queryAll, queryFirst, type BatchQuery, type DbClient } from '~/server/db'
import {
  createContentDocumentWithBlocks,
  prepareContentDocumentDeletion,
  getContentEditorSnapshot,
  getContentBlocksForDocument,
  getContentOutline,
  getContentDocumentById,
  listBlocksForDocument,
  updateContentDocument,
  prepareContentDocumentUpdate,
  type ContentDocumentChanges,
  renderContentBlocksToMarkdown,
  type ContentBlockInput,
} from '~/server/utils/content-documents'
import {
  loadExactPublicLocalizations,
  projectLocalizedMediaAlt,
} from '~/server/utils/public-localization'
import { listPublicLocaleRepresentations } from '~/server/utils/public-locale-representations'
import { normalizeVertical } from '~/utils/vertical-copy'
import { slugifyTitle } from '~/utils/post-slugs'
import { PLATFORM_ORGANIZATION_ID, PLATFORM_SITE_ID, isPlatformSite } from '~/shared/platform-scope'
import { BLOG_CATEGORY_LABELS, blogCategoryToSlug } from '~/utils/blog-categories'
import { categoryToSlug } from '~/utils/docs-categories'
import { tenantBlogPostPath } from '~/utils/tenant-blog-route'
import { normalizeBlogSlug, parseScheduledFor, resolveBlogPublicPath, resolveSlugMutation } from '~/utils/blog-editor'
import { createBlogRedirect } from '~/server/utils/blog-publishing'
import { resolvePublicTemplate } from '~/utils/template-registry'
import { buildSingleMediaPlacementQueries, hydrateMediaAssetRefs, hydrateMediaPlacementRefs, insertInitialMediaPlacements } from '~/server/utils/media-asset-manager'
import { isSingleMediaPlacement } from '~/shared/media-placement-contract'
import { getMediaPlacements } from '~/server/utils/media-placement'
import { d1JsonStringSet } from '~/server/db/d1-limits'
import { findAuthUsersByIds, type CloudflareEnv } from '~/server/utils/auth'
import { findOrganizationById } from '~/server/utils/member-access'
import { refreshSocialCard } from '~/server/utils/social-card'
import { loadPublicSocialMedia } from '~/server/utils/public-social-image'

const BLOG_TITLE_MAX = 200
const BLOG_EXCERPT_MAX = 500
const BLOG_CATEGORY_MAX = 100
const BLOG_SEO_TITLE_MAX = 200
const BLOG_SEO_DESCRIPTION_MAX = 500
const BLOG_SEO_KEYWORDS_MAX = 500
const CONTENT_NAV_LABEL_MAX = 120
const CONTENT_NAV_TITLE_MAX = 160
const DOC_TITLE_MAX = 200
const DOC_EXCERPT_MAX = 500
const DOC_SEO_DESCRIPTION_MAX = 500
const DOC_SEO_KEYWORDS_MAX = 500
const MAX_SLUG_ATTEMPTS = 8
const BLOG_UPDATE_MUTATION_FIELDS: Array<keyof PlatformBlogUpdateInput> = [
  'title',
  'excerpt',
  'category',
  'tags',
  'nav_section',
  'nav_title',
  'nav_order',
  'nav_section_order',
  'hide_from_nav',
  'featured_order',
  'seo_title',
  'seo_description',
  'seo_keywords',
  'canonical_url',
  'robots',
  'media',
  'visibility',
  'slug',
  'redirect_old_slug',
  'reset_slug_override',
  'content_blocks',
]

function parseStringArray(value: unknown): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) {
    if (value.some(item => typeof item !== 'string')) {
      throw new HTTPError({ statusCode: 500, statusMessage: 'Blog tags contain a non-string value' })
    }
    return value as string[]
  }
  if (typeof value !== 'string') {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Blog tags are not valid JSON' })
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Blog tags are not valid JSON' })
  }
  if (!Array.isArray(parsed) || parsed.some(item => typeof item !== 'string')) {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Blog tags are not an array of strings' })
  }
  return parsed as string[]
}

export function parseBlogEditorThemeTokens(value: string | null | undefined): ApiRecord {
  if (value === null || value === undefined) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(value) as unknown
  } catch {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Blog editor theme tokens are not valid JSON' })
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Blog editor theme tokens must be a JSON object' })
  }
  return parsed as ApiRecord
}

export const PLATFORM_DOC_CATEGORIES = ['Getting Started', 'Menu Management', 'Theme Customization', 'SEO & Marketing', 'Integrations', 'Advanced'] as const
export const PLATFORM_BLOG_CATEGORIES = BLOG_CATEGORY_LABELS
export const PLATFORM_DOC_DIFFICULTIES = ['Beginner', 'Intermediate', 'Advanced'] as const

export type PlatformRobotsDirective = 'index,follow' | 'noindex,follow' | 'index,nofollow' | 'noindex,nofollow'

export const PLATFORM_ROBOTS_DIRECTIVES: readonly PlatformRobotsDirective[] = ['index,follow', 'noindex,follow', 'index,nofollow', 'noindex,nofollow']


export interface PlatformContentNavInput {
  nav_section?: string | null
  nav_title?: string | null
  nav_order?: number | null
  nav_section_order?: number | null
  hide_from_nav?: boolean | number | null
  featured_order?: number | null
}

export interface BlogScope {
  site_id?: string | null
  organization_id?: string | null
}

export interface PlatformMediaInput {
  asset_id: string
  slot: 'featured'
}

function featuredAssetId(input: { media?: PlatformMediaInput[] }): string | null | undefined {
  if (input.media === undefined) return undefined
  if (!Array.isArray(input.media) || input.media.length > 1) badRequest('media accepts at most one featured asset')
  const item = input.media[0]
  if (!item) return null
  if (item.slot !== 'featured' || typeof item.asset_id !== 'string' || !item.asset_id.trim()) badRequest('media requires asset_id with slot featured')
  return item.asset_id.trim()
}

export interface PlatformDocNavGroupInput {
  nav_group?: string | null
  nav_group_order?: number | null
}

export interface PlatformBlogCreateInput extends PlatformContentNavInput {
  title: string
  slug?: string | null
  content_blocks: Array<ContentBlockInput & { id?: string }>
  excerpt?: string | null
  category?: string | null
  tags?: string[] | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  canonical_url?: string | null
  robots?: string | null
  media?: PlatformMediaInput[]
  visibility?: 'public' | 'unlisted'
  scheduled_for?: string | null
}

export interface PlatformBlogUpdateInput extends PlatformContentNavInput {
  title?: string
  excerpt?: string | null
  category?: string | null
  tags?: string[] | null
  seo_title?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  canonical_url?: string | null
  robots?: string | null
  media?: PlatformMediaInput[]
  visibility?: 'public' | 'unlisted'
  slug?: string | null
  redirect_old_slug?: boolean
  reset_slug_override?: boolean
  content_blocks?: Array<ContentBlockInput & { id?: string }>
  expected_updated_at?: string
}

export interface PlatformBlogLifecycleInput {
  expected_updated_at: string
  scheduled_for?: string | null
}

export interface PlatformBlogLifecycleState {
  id: string
  status: 'published' | 'scheduled'
  published_at: string | null
  scheduled_for: string | null
  updated_at: string
}

export function parsePlatformBlogLifecycleInput(body: unknown, _action: 'publish' = 'publish'): PlatformBlogLifecycleInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) badRequest('Request body must be a valid object')
  const record = body as Record<string, unknown>
  const allowed = new Set(['expected_updated_at', 'scheduled_for'])
  const unknownField = Object.keys(record).find(key => !allowed.has(key))
  if (unknownField) badRequest(`Unknown request field: ${unknownField}`)
  if (typeof record.expected_updated_at !== 'string' || !record.expected_updated_at.trim()) badRequest('expected_updated_at is required')
  if (record.scheduled_for !== undefined && record.scheduled_for !== null && typeof record.scheduled_for !== 'string') {
    badRequest('scheduled_for must be a string or null')
  }
  return {
    expected_updated_at: record.expected_updated_at,
    scheduled_for: record.scheduled_for as string | null | undefined,
  }
}

export interface PlatformDocCreateInput extends PlatformContentNavInput, PlatformDocNavGroupInput {
  title: string
  content_blocks: Array<ContentBlockInput & { id?: string }>
  excerpt?: string | null
  category?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  canonical_url?: string | null
  robots?: string | null
  difficulty_level?: string | null
  sort_order?: number | null
  media?: PlatformMediaInput[]
}

export interface PlatformDocUpdateInput extends PlatformContentNavInput, PlatformDocNavGroupInput {
  title?: string
  content_blocks?: Array<ContentBlockInput & { id?: string }>
  expected_updated_at?: string
  excerpt?: string | null
  category?: string | null
  seo_description?: string | null
  seo_keywords?: string | null
  canonical_url?: string | null
  robots?: string | null
  difficulty_level?: string | null
  sort_order?: number | null
  media?: PlatformMediaInput[]
}

function badRequest(message: string): never {
  throw new HTTPError({ statusCode: 400, statusMessage: message })
}

function notFound(message: string): never {
  throw new HTTPError({ statusCode: 404, statusMessage: message })
}

// Lets every blog/doc tool accept either the row id or its public slug, so a
// model (or person) holding only a public URL doesn't need a separate
// list-then-match step before it can get/update/publish/delete a post or doc.
async function resolvePlatformContentId(
  db: DbClient,
  kind: 'article' | 'platform_doc',
  identifier: string,
  notFoundMessage: string,
  siteId: string | null = null,
): Promise<string> {
  const byId = await queryFirst<{ id: string }>(db, `SELECT id FROM content_documents WHERE kind = ? AND row_role = 'root' AND site_id = ? AND id = ? LIMIT 1`, [kind, siteId ?? PLATFORM_SITE_ID, identifier])
  const bySlug = await queryFirst<{ id: string }>(db, `SELECT id FROM content_documents WHERE kind = ? AND row_role = 'root' AND site_id = ? AND slug = ? LIMIT 1`, [kind, siteId ?? PLATFORM_SITE_ID, identifier])
  if (byId && bySlug && byId.id !== bySlug.id) {
    badRequest('Ambiguous platform content identifier; use the row id.')
  }
  const row = byId ?? bySlug
  if (!row) notFound(notFoundMessage)
  return row.id
}

function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}

function normalizeSlugFromTitle(title: string, fallbackPrefix: 'post' | 'doc') {
  const slug = slugifyTitle(title)
  return slug || `${fallbackPrefix}-${Date.now()}`
}

function isUniqueConstraintError(err: unknown) {
  const message = String((err as ApiValue)?.message || err || '')
  const normalized = message.replace(/["'`]/g, '')
  return normalized.includes('content_documents.slug') && normalized.includes('content_documents.locale')
}

function assertStringLength(value: string | null | undefined, max: number, field: string) {
  if (value != null && value.length > max) {
    badRequest(`${field} exceeds maximum length (${max})`)
  }
}

function assertValidRobotsDirective(value: string | null | undefined) {
  if (value == null) return
  if (!PLATFORM_ROBOTS_DIRECTIVES.includes(value as PlatformRobotsDirective)) {
    badRequest(`robots must be one of: ${PLATFORM_ROBOTS_DIRECTIVES.join(', ')}`)
  }
}

function assertValidBlogCategory(value: string | null | undefined) {
  if (value == null || value === '') return
  if (!PLATFORM_BLOG_CATEGORIES.includes(value)) {
    badRequest(`category must be one of: ${PLATFORM_BLOG_CATEGORIES.join(', ')}`)
  }
}

function assertValidCanonicalUrl(value: string | null | undefined) {
  if (value == null || value === '') return
  try {
    void new URL(value)
  } catch {
    badRequest('canonical_url must be an absolute URL')
  }
}

async function mediaPlacementScope(db: DbClient, siteId: string | null, organizationId: string | null) {
  if (siteId && organizationId) return { siteId, organizationId }
  // A siteId without its organizationId is a caller bug (every real tenant caller
  // resolves both together from the same site row) — it must fail loudly rather
  // than silently fall through to platform scope, which would misfile tenant media
  // as platform-owned.
  if (siteId && !isPlatformSite(siteId)) throw new HTTPError({ statusCode: 500, statusMessage: 'Tenant media placement requires an organization id' })
  const platformSite = await queryFirst<{ organization_id: string }>(db, 'SELECT organization_id FROM sites WHERE id = ? LIMIT 1', [PLATFORM_SITE_ID])
  if (!platformSite) throw new HTTPError({ statusCode: 500, statusMessage: 'Platform media site is not configured' })
  return { siteId: PLATFORM_SITE_ID, organizationId: platformSite.organization_id }
}

type NormalizedEditorBlock = ContentBlockInput & { id: string; placement_media: Array<{ asset_id: string; slot: string }> }

async function normalizeEditorContentBlocks(
  db: D1Database,
  blocks: Array<ContentBlockInput & { id?: string }>,
  scope: { organizationId: string; siteId: string },
): Promise<NormalizedEditorBlock[]> {
  return await Promise.all(blocks.map(async (block): Promise<NormalizedEditorBlock> => {
    if (!block || typeof block !== 'object' || !block.data || typeof block.data !== 'object' || Array.isArray(block.data)) badRequest('Every content block requires an object data payload')
    if (block.type === 'heading' && (typeof block.data.text !== 'string' || !block.data.text.trim())) badRequest('Heading blocks require non-empty data.text')
    if (block.type === 'markdown') {
      if (typeof block.data.markdown !== 'string') badRequest('Markdown blocks require data.markdown')
      if (block.data.editor_mode !== 'rich' && block.data.editor_mode !== 'source') badRequest('Markdown blocks require data.editor_mode to be rich or source')
      if (block.data.editor_mode === 'rich' && (/^\s*\|.*\|\s*$/m.test(block.data.markdown) || /<\/?[a-z][^>]*>/i.test(block.data.markdown))) {
        badRequest('Markdown tables and raw HTML require editor_mode source')
      }
    }
    const id = block.id ?? crypto.randomUUID()
    const media = Array.isArray(block.media) ? block.media : []
    if (block.type === 'image' && media.length > 1) badRequest('Image blocks accept one media asset')
    const placementMedia = media.map((item, index) => {
      const assetId = typeof item?.asset_id === 'string' ? item.asset_id.trim() : ''
      if (!assetId) badRequest(`content_blocks media[${index}].asset_id is required`)
      return { asset_id: assetId, slot: typeof item.slot === 'string' && item.slot.trim() ? item.slot.trim() : block.type === 'gallery' ? 'gallery' : 'media' }
    })
    await hydrateMediaPlacementRefs(db, {
      ...scope,
      refs: placementMedia,
      allowedKinds: ['image', 'video'],
      fieldName: `content_blocks.${id}.media`,
    })
    const data = { ...block.data }
    if (block.type === 'image' && !placementMedia.length) return { ...block, id, data, media: [], placement_media: [] }
    return { ...block, id, data, media: placementMedia, placement_media: placementMedia }
  }))
}

async function contentBlockPlacementQueries(
  db: DbClient,
  blocks: NormalizedEditorBlock[],
  scope: { organizationId: string; siteId: string },
  now?: string,
) {
  if (!blocks.length) return []
  const existingRows = await queryAll<{ id: string }>(db, `
    SELECT id FROM content_blocks WHERE id IN (SELECT value FROM json_each(?))
  `, [d1JsonStringSet(blocks.map(block => block.id))])
  const existingIds = new Set(existingRows.map(row => row.id))
  const existingPlacements = await getMediaPlacements(db, {
    siteId: scope.siteId,
    ownerType: 'content_block',
    ownerIds: blocks.map(block => block.id),
  })
  const queries: BatchQuery[] = []
  for (const block of blocks) {
    const bySlot = new Map<string, Array<{ asset_id: string }>>()
    for (const item of block.placement_media) {
      const items = bySlot.get(item.slot) ?? []
      items.push({ asset_id: item.asset_id })
      bySlot.set(item.slot, items)
    }
    if (existingIds.has(block.id)) {
      const currentBySlot = new Map<string, string[]>()
      for (const item of existingPlacements.get(block.id) ?? []) {
        const ids = currentBySlot.get(item.slot) ?? []
        ids.push(item.asset_id)
        currentBySlot.set(item.slot, ids)
      }
      for (const slot of new Set([...currentBySlot.keys(), ...bySlot.keys()])) {
        const current = currentBySlot.get(slot) ?? []
        const requested = (bySlot.get(slot) ?? []).map(item => item.asset_id)
        if (current.length === requested.length && current.every((assetId, index) => assetId === requested[index])) continue
        if (!isSingleMediaPlacement({ owner_type: 'content_block', slot })) {
          badRequest(`content_blocks.${block.id}.media cannot replace an existing gallery; use attach/remove/reorder media operations`)
        }
        queries.push(...buildSingleMediaPlacementQueries({
          ...scope,
          placement: { owner_type: 'content_block', owner_id: block.id, slot },
          media: bySlot.get(slot) ?? [],
          now,
        }))
      }
      continue
    }
    queries.push(...[...bySlot.keys()].flatMap(slot => insertInitialMediaPlacements({
        ...scope,
        placement: { owner_type: 'content_block', owner_id: block.id, slot },
        media: bySlot.get(slot) ?? [],
        now,
      })))
  }
  return queries
}

export async function prepareTenantBlogContentBlocks(
  db: D1Database,
  blocks: Array<ContentBlockInput & { id?: string }>,
  siteId: string,
  organizationId: string,
  now = new Date().toISOString(),
) {
  const normalizedBlocks = await normalizeEditorContentBlocks(db, blocks, { siteId, organizationId })
  const placementScope = await mediaPlacementScope(db, siteId, organizationId)
  return {
    blocks: normalizedBlocks,
    placementQueries: await contentBlockPlacementQueries(db, normalizedBlocks, placementScope, now),
  }
}

function renderCanonicalBlogBody(blocks: Array<ContentBlockInput & { id?: string }>) {
  return renderContentBlocksToMarkdown(blocks.map((block, position) => ({
    id: block.id ?? `pending-${position}`,
    type: block.type,
    position,
    level: block.level ?? null,
    data_json: JSON.stringify(block.data),
  })))
}

function attachPublished(record: ApiRecord, published: boolean) {
  return { ...record, published }
}

async function normalizeCanonicalBlogBlocks(
  db: D1Database,
  input: Pick<PlatformBlogCreateInput, 'content_blocks'>,
  scope: { organizationId: string; siteId: string },
) {
  if (!Array.isArray(input.content_blocks) || !input.content_blocks.length) badRequest('content_blocks are required')
  return await normalizeEditorContentBlocks(db, input.content_blocks, scope)
}

function normalizeNavVisibility<T extends Record<string, unknown>>(record: T) {
  const normalized = { ...record } as T & { tags?: string[]; tags_json?: unknown }
  if ('tags_json' in record) {
    normalized.tags = parseStringArray(record.tags_json)
    delete normalized.tags_json
  }
  if (!('hide_from_nav' in record)) return normalized
  return {
    ...normalized,
    hide_from_nav: Boolean(record.hide_from_nav),
  }
}

export function attachFeaturedMedia(record: ApiRecord) {
  const {
    asset_id: assetId,
    media_public_url: publicUrl,
    media_thumbnail_url: thumbnailUrl,
    media_kind: kind,
    media_width: width,
    media_height: height,
    ...rest
  } = record

  return {
    ...normalizeNavVisibility(rest),
    media: assetId ? [{ asset_id: assetId, slot: 'featured', public_url: publicUrl ?? null, thumbnail_url: thumbnailUrl ?? null, kind: kind ?? null, width: width ?? null, height: height ?? null }] : [],
  }
}

export function attachFeaturedMediaFromBareJoin(record: ApiRecord) {
  const {
    public_url: publicUrl, thumbnail_url: thumbnailUrl, kind, width, height, asset_id: assetId,
    ...rest
  } = record

  return {
    ...normalizeNavVisibility(rest),
    media: assetId ? [{ asset_id: assetId, slot: 'featured', public_url: publicUrl ?? null, thumbnail_url: thumbnailUrl ?? null, kind: kind ?? null, width: width ?? null, height: height ?? null }] : [],
  }
}

export type ContentReviewContext =
  | { scope: 'platform' }
  | { scope: 'tenant'; orgSlug: string; siteSlug: string }

function contentReviewUrls(
  record: ApiRecord,
  kind: 'blog' | 'doc',
  siteId: string | null = null,
  tenantBlogPath: string | null = null,
  context?: ContentReviewContext,
) {
  const id = String(record.id ?? '')
  const adminEditUrl = (() => {
    if (kind === 'doc') return `/admin/docs/${id}`
    if (context?.scope === 'tenant') {
      return `/dashboard/${context.orgSlug}/sites/${context.siteSlug}/blog/${id}`
    }
    return `/admin/blog/${id}`
  })()
  const isPublished = typeof record.status === 'string' ? record.status === 'published' : Boolean(record.published_at)
  const category = typeof record.category === 'string' ? record.category : null
  const slug = typeof record.slug === 'string' ? record.slug : null
  const categorySlug = kind === 'blog' ? blogCategoryToSlug(category) : categoryToSlug(category)
  const publicPath = (() => {
    if (!slug) return null
    if (kind === 'blog') {
      if (!isPlatformSite(siteId ?? PLATFORM_SITE_ID)) return tenantBlogPath ?? `/blog/${slug}`
      return resolveBlogPublicPath({ scope: 'platform', slug, category })
    }
    return categorySlug ? `/docs/${categorySlug}/${slug}` : null
  })()

  return {
    ...record,
    admin_edit_url: adminEditUrl,
    edit_url: adminEditUrl,
    public_path: publicPath,
    public_url: isPublished ? publicPath : null,
    preview_url: null,
  }
}

function platformDocReviewUrls(record: ApiRecord) {
  const projected = contentReviewUrls({ ...record, status: 'published' }, 'doc')
  const { status: _status, published_at: _publishedAt, preview_url: _previewUrl, ...doc } = projected
  return doc
}

async function resolveTenantBlogPostPath(db: DbClient, siteId: string | null, slug: string) {
  if (!siteId || isPlatformSite(siteId)) return null
  const site = await queryFirst<{ theme_id: string | null }>(
    db,
    'SELECT theme_id FROM sites WHERE id = ? LIMIT 1',
    [siteId],
  )
  return tenantBlogPostPath({ themeId: site?.theme_id }, slug)
}

async function resolveTenantContext(db: DbClient, siteId: string | null, env?: CloudflareEnv): Promise<ContentReviewContext | undefined> {
  if (!siteId || isPlatformSite(siteId)) return undefined
  if (!env) throw new Error('CloudflareEnv is required to resolve tenant organization context')
  const site = await queryFirst<{ slug: string; organization_id: string }>(
    db,
    'SELECT slug, organization_id FROM sites WHERE id = ? LIMIT 1',
    [siteId],
  )
  if (!site) return undefined
  const organization = await findOrganizationById(env, site.organization_id)
  if (!organization) return undefined
  return { scope: 'tenant', orgSlug: organization.slug, siteSlug: site.slug }
}

/**
 * Shared by the public blog API route and the blog page's SSR data fetch.
 * The page must call this directly (with its own request's `db` binding)
 * rather than doing a nested self-fetch back to the API route — Nitro's
 * internal dispatch for multi-segment dynamic routes does not reliably
 * reproduce the same route-param/binding resolution as a real external
 * request, which was causing the page to 404 on posts the API itself
 * served fine.
 */
export async function getPublishedPlatformBlogPost(db: DbClient, category: string, slug: string, env: CloudflareEnv) {
  const post = await queryFirst<ApiRecord>(db, `
    SELECT
      p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, json_extract(p.metadata_json, '$.tags') AS tags_json, p.seo_title, p.seo_description, p.seo_keywords,
      p.canonical_url, p.robots, p.visibility,
      (p.metadata_json ->> '$.nav_section') AS nav_section, (p.metadata_json ->> '$.nav_title') AS nav_title, (p.metadata_json ->> '$.nav_order') AS nav_order, (p.metadata_json ->> '$.nav_section_order') AS nav_section_order, (p.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (p.metadata_json ->> '$.featured_order') AS featured_order,
      p.published_at, p.created_at, p.updated_at,
      p.author_id,
      mp.asset_id AS asset_id,
      ma.public_url,
      ma.thumbnail_url,
      ma.kind,
      ma.width,
      ma.height
    FROM content_documents p
    LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0
    LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
    WHERE p.kind = 'article' AND p.row_role = 'root' AND p.slug = ? AND (p.metadata_json ->> '$.category') = ? AND p.status = 'published' AND p.site_id = ?
  `, [slug, category, PLATFORM_SITE_ID])

  if (!post) return null

  const contentBlocks = await getContentBlocksForDocument(db, String(post.id))
  if (!contentBlocks) throw new HTTPError({ statusCode: 500, statusMessage: 'Blog content document is missing' })
  const socialMedia = (await loadPublicSocialMedia(db, PLATFORM_SITE_ID, 'content_document', [String(post.id)])).get(String(post.id))
  const { author_id: authorId, ...postRecord } = post
  const authors = await findAuthUsersByIds(env, [authorId as string | null])
  const author = typeof authorId === 'string' ? authors.get(authorId) ?? null : null
  return {
    ...attachFeaturedMediaFromBareJoin({ ...postRecord, content_blocks: contentBlocks }),
    media: socialMedia?.media ?? [],
    social_image: socialMedia?.social_image ?? null,
    author: author ? { id: author.id, name: author.name, image: author.image } : null,
  }
}

/**
 * Shared by the public docs API route and the docs page's SSR data fetch.
 * See getPublishedPlatformBlogPost above for why the page must call this
 * directly rather than doing a nested self-fetch back to the API route.
 */
export async function getPublishedPlatformDoc(db: DbClient, category: string, slug: string, env: CloudflareEnv) {
  const doc = await queryFirst<ApiRecord>(
    db,
    `SELECT
       p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, (p.metadata_json ->> '$.difficulty_level') AS difficulty_level,
       p.seo_description, p.seo_keywords, p.canonical_url, p.robots,
       (p.metadata_json ->> '$.nav_section') AS nav_section, (p.metadata_json ->> '$.nav_title') AS nav_title, (p.metadata_json ->> '$.nav_order') AS nav_order, (p.metadata_json ->> '$.nav_section_order') AS nav_section_order, (p.metadata_json ->> '$.nav_group') AS nav_group, (p.metadata_json ->> '$.nav_group_order') AS nav_group_order, (p.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (p.metadata_json ->> '$.featured_order') AS featured_order,
       p.author_id,
       mp.asset_id AS asset_id, p.updated_at,
       ma.public_url, ma.thumbnail_url, ma.kind, ma.width, ma.height
     FROM content_documents p
     LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0
     LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
     WHERE p.kind = 'platform_doc' AND p.row_role = 'root' AND p.site_id = 'platform' AND p.slug = ? AND (p.metadata_json ->> '$.category') = ?`,
    [slug, category],
  )

  if (!doc) return null

  const contentBlocks = await getContentBlocksForDocument(db, String(doc.id))
  if (!contentBlocks) throw new HTTPError({ statusCode: 500, statusMessage: 'Documentation content document is missing' })
  const socialMedia = (await loadPublicSocialMedia(db, PLATFORM_SITE_ID, 'content_document', [String(doc.id)])).get(String(doc.id))
  const { author_id: authorId, ...docRecord } = doc
  const authors = await findAuthUsersByIds(env, [authorId as string | null])
  const author = typeof authorId === 'string' ? authors.get(authorId) ?? null : null
  return {
    ...attachFeaturedMediaFromBareJoin({ ...docRecord, content_blocks: contentBlocks }),
    media: socialMedia?.media ?? [],
    social_image: socialMedia?.social_image ?? null,
    author: author ? { id: author.id, name: author.name, image: author.image } : null,
  }
}

function normalizeBlankToNull(input: { canonical_url?: string | null; robots?: string | null }) {
  if (input.canonical_url !== undefined && input.canonical_url?.trim() === '') input.canonical_url = null
  if (input.robots !== undefined && input.robots?.trim() === '') input.robots = null
}

function validateNavMetadata(input: Partial<PlatformContentNavInput>) {
  if (input.nav_section !== undefined) assertStringLength(input.nav_section ?? null, CONTENT_NAV_LABEL_MAX, 'nav_section')
  if (input.nav_title !== undefined) assertStringLength(input.nav_title ?? null, CONTENT_NAV_TITLE_MAX, 'nav_title')
  for (const field of ['nav_order', 'nav_section_order', 'featured_order'] as const) {
    if (input[field] !== undefined && input[field] !== null) {
      const value = input[field]
      if (typeof value !== 'string' && typeof value !== 'number') {
        badRequest(`${field} must be a number or numeric string`)
      }
      if (typeof value === 'string' && !/^-?\d+$/.test(value)) {
        badRequest(`${field} must be a number or numeric string`)
      }
      if (typeof value === 'number' && !Number.isInteger(value)) {
        badRequest(`${field} must be an integer`)
      }
    }
  }
}

function validateDocNavGroupMetadata(input: Partial<PlatformDocNavGroupInput>) {
  if (input.nav_group !== undefined) assertStringLength(input.nav_group ?? null, CONTENT_NAV_LABEL_MAX, 'nav_group')
  if (input.nav_group_order !== undefined && input.nav_group_order !== null && !Number.isInteger(input.nav_group_order)) {
    badRequest('nav_group_order must be an integer')
  }
}

function normalizeHideFromNav(value: PlatformContentNavInput['hide_from_nav']) {
  if (value === undefined || value === null) return value
  return value ? 1 : 0
}

function hasOwnField<T extends object>(input: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(input, key)
}

// The fixed PLATFORM_BLOG_CATEGORIES taxonomy (Marketing, SEO, ...) only makes sense
// for KrabiClaw's own marketing blog — a tenant restaurant's blog category is free text.
function validateBlogCommon(input: Partial<PlatformBlogCreateInput>, isTenant = false) {
  normalizeBlankToNull(input)
  validateNavMetadata(input)
  if ('visibility' in input && input.visibility !== undefined && !['public', 'unlisted'].includes(String(input.visibility))) badRequest('visibility must be public or unlisted')
  if (input.title !== undefined) assertStringLength(input.title, BLOG_TITLE_MAX, 'title')
  if (input.excerpt !== undefined) assertStringLength(input.excerpt ?? null, BLOG_EXCERPT_MAX, 'excerpt')
  if (input.category !== undefined) {
    assertStringLength(input.category ?? null, BLOG_CATEGORY_MAX, 'category')
    if (!isTenant) assertValidBlogCategory(input.category ?? null)
  }
  if (input.tags !== undefined && input.tags !== null) {
    if (!Array.isArray(input.tags) || input.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 80)) badRequest('tags must be an array of non-empty strings up to 80 characters each')
    input.tags = [...new Set(input.tags.map(tag => tag.trim()))].slice(0, 20)
  }
  if (input.seo_title !== undefined) assertStringLength(input.seo_title ?? null, BLOG_SEO_TITLE_MAX, 'seo_title')
  if (input.seo_description !== undefined) assertStringLength(input.seo_description ?? null, BLOG_SEO_DESCRIPTION_MAX, 'seo_description')
  if (input.seo_keywords !== undefined) assertStringLength(input.seo_keywords ?? null, BLOG_SEO_KEYWORDS_MAX, 'seo_keywords')
  if (input.canonical_url !== undefined) assertValidCanonicalUrl(input.canonical_url)
  if (input.robots !== undefined) assertValidRobotsDirective(input.robots)
}

function rejectLegacyBlogContentFields(input: object) {
  const fields = ['body', 'components', 'faq_items', 'faq_label', 'faq_status', 'faq_render_enabled', 'faq_schema_enabled', 'how_to_steps', 'how_to_estimated_time', 'how_to_tool_items', 'how_to_supply_items', 'how_to_label', 'how_to_status', 'how_to_render_enabled', 'how_to_schema_enabled']
  const legacy = fields.find(field => Object.prototype.hasOwnProperty.call(input, field))
  if (legacy) badRequest(`${legacy} is not writable for blogs; use content_blocks`)
}

function rejectBlogUpdateLifecycleFields(input: object) {
  const lifecycleField = ['scheduled_for']
    .find(field => Object.prototype.hasOwnProperty.call(input, field))
  if (lifecycleField) {
    badRequest(`${lifecycleField} is not writable through a blog update; use the publish operation for scheduled articles`)
  }
}

function validateDocCommon(input: Partial<PlatformDocCreateInput>) {
  normalizeBlankToNull(input)
  validateNavMetadata(input)
  validateDocNavGroupMetadata(input)
  if (input.title !== undefined) assertStringLength(input.title, DOC_TITLE_MAX, 'title')
  if (input.excerpt !== undefined) assertStringLength(input.excerpt ?? null, DOC_EXCERPT_MAX, 'excerpt')
  if (input.seo_description !== undefined) assertStringLength(input.seo_description ?? null, DOC_SEO_DESCRIPTION_MAX, 'seo_description')
  if (input.seo_keywords !== undefined) assertStringLength(input.seo_keywords ?? null, DOC_SEO_KEYWORDS_MAX, 'seo_keywords')
  if (input.canonical_url !== undefined) assertValidCanonicalUrl(input.canonical_url)
  if (input.robots !== undefined) assertValidRobotsDirective(input.robots)
  if (input.category && !PLATFORM_DOC_CATEGORIES.includes(input.category as (typeof PLATFORM_DOC_CATEGORIES)[number])) {
    badRequest(`invalid category. Must be one of: ${PLATFORM_DOC_CATEGORIES.join(', ')}`)
  }
  if (input.difficulty_level && !PLATFORM_DOC_DIFFICULTIES.includes(input.difficulty_level as (typeof PLATFORM_DOC_DIFFICULTIES)[number])) {
    badRequest(`invalid difficulty_level. Must be one of: ${PLATFORM_DOC_DIFFICULTIES.join(', ')}`)
  }
}

export async function listPlatformBlogPosts(db: DbClient, status?: string | null, siteId: string | null = null, env?: CloudflareEnv) {
  let sql = `SELECT
      p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, json_extract(p.metadata_json, '$.tags') AS tags_json, p.status, p.visibility, p.scheduled_for,
      p.seo_title, p.seo_description, p.seo_keywords, p.canonical_url, p.robots,
      (p.metadata_json ->> '$.nav_section') AS nav_section, (p.metadata_json ->> '$.nav_title') AS nav_title, (p.metadata_json ->> '$.nav_order') AS nav_order, (p.metadata_json ->> '$.nav_section_order') AS nav_section_order, (p.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (p.metadata_json ->> '$.featured_order') AS featured_order,
      mp.asset_id AS asset_id, ma.public_url AS media_public_url, ma.thumbnail_url AS media_thumbnail_url, ma.kind AS media_kind,
      ma.width AS media_width, ma.height AS media_height,
      p.published_at, p.created_at, p.updated_at
    FROM content_documents p
    LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0
    LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
    WHERE p.kind = 'article' AND p.row_role = 'root' AND p.site_id = ?`
  const resolvedSiteId = siteId ?? PLATFORM_SITE_ID
  const params: ApiValue[] = [resolvedSiteId]
  if (status === 'published') sql += " AND p.status = 'published'"
  else if (status === 'scheduled') sql += " AND p.status = 'scheduled'"
  sql += ' ORDER BY COALESCE(featured_order, 999999), COALESCE(nav_section_order, 999999), COALESCE(nav_section, category), COALESCE(nav_order, 999999), p.created_at DESC'
  const results = await queryAll<ApiRecord>(db, sql, params)
  const context = isPlatformSite(resolvedSiteId) ? undefined : await resolveTenantContext(db, resolvedSiteId, env)
  const site = !isPlatformSite(resolvedSiteId)
    ? await queryFirst<{ theme_id: string | null }>(db, 'SELECT theme_id FROM sites WHERE id = ? LIMIT 1', [siteId])
    : null
  return (results ?? []).map((record) => {
    const slug = typeof record.slug === 'string' ? record.slug : ''
    const publicPath = !isPlatformSite(resolvedSiteId) && slug ? tenantBlogPostPath({ themeId: site?.theme_id }, slug) : null
    return contentReviewUrls(attachFeaturedMedia(attachPublished(record, Boolean(record.published_at))), 'blog', resolvedSiteId, publicPath, context)
  })
}

export async function getPlatformBlogPost(db: DbClient, postIdOrSlug: string, siteId: string | null = null, env?: CloudflareEnv) {
  const resolvedSiteId = siteId ?? PLATFORM_SITE_ID
  const postId = await resolvePlatformContentId(db, 'article', postIdOrSlug, 'Post not found', resolvedSiteId)
  const post = await queryFirst<ApiRecord | null>(
    db,
    `SELECT
       p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, json_extract(p.metadata_json, '$.tags') AS tags_json, p.status, p.visibility, p.scheduled_for,
       p.first_published_at, (p.metadata_json ->> '$.slug_manually_overridden') AS slug_manually_overridden,
       p.seo_title, p.seo_description, p.seo_keywords, p.canonical_url, p.robots,
       (p.metadata_json ->> '$.nav_section') AS nav_section, (p.metadata_json ->> '$.nav_title') AS nav_title, (p.metadata_json ->> '$.nav_order') AS nav_order, (p.metadata_json ->> '$.nav_section_order') AS nav_section_order, (p.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (p.metadata_json ->> '$.featured_order') AS featured_order,
       mp.asset_id AS asset_id, ma.public_url AS media_public_url, ma.thumbnail_url AS media_thumbnail_url, ma.kind AS media_kind,
       ma.width AS media_width, ma.height AS media_height,
       p.published_at, p.created_at, p.updated_at
     FROM content_documents p
     LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0
     LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
     WHERE p.kind = 'article' AND p.row_role = 'root' AND p.id = ?`,
    [postId],
  )
  if (!post) notFound('Post not found')
  const contentDocument = await getContentEditorSnapshot(db, postId)
  if (!contentDocument) throw new HTTPError({ statusCode: 500, statusMessage: 'Blog content document is missing' })
  const rawBlocks = await listBlocksForDocument(db, contentDocument.document.id)
  const slug = typeof post.slug === 'string' ? post.slug : ''
  const publicPath = !isPlatformSite(resolvedSiteId) && slug ? await resolveTenantBlogPostPath(db, resolvedSiteId, slug) : null
  const context = await resolveTenantContext(db, resolvedSiteId, env)
  const editorTheme = !isPlatformSite(resolvedSiteId) ? await queryFirst<{ theme_id: string | null; vertical: string | null; brand_name: string | null; brand_color: string | null } | null>(db, `
    SELECT s.theme_id, s.vertical, s.brand_name,
           json_extract(s.settings_json, '$.config.brand_color') AS brand_color
      FROM sites s
     WHERE s.id = ? LIMIT 1
  `, [resolvedSiteId]) : null
  const editorTemplate = !isPlatformSite(resolvedSiteId) ? resolvePublicTemplate({ themeId: editorTheme?.theme_id, vertical: editorTheme?.vertical }) : null
  const editorThemeTokenRow = editorTemplate ? await queryFirst<{ tokens_json: string | null } | null>(db, `
    SELECT json_extract(settings_json, ? || '.tokens') AS tokens_json FROM sites
     WHERE id = ? AND json_extract(settings_json, ? || '.status') = 'active'
     LIMIT 1
  `, ['$.theme_by_template.' + editorTemplate.slug, resolvedSiteId, '$.theme_by_template.' + editorTemplate.slug]) : null
  const editorThemeTokens = parseBlogEditorThemeTokens(editorThemeTokenRow?.tokens_json)
  return {
    ...contentReviewUrls(attachFeaturedMedia(attachPublished(post, Boolean(post.published_at))), 'blog', siteId, publicPath, context),
    tags: parseStringArray(post.tags_json),
    body: renderContentBlocksToMarkdown(rawBlocks),
    content_document: contentDocument,
    editor_template: editorTemplate?.slug ?? 'platform',
    editor_theme_tokens: editorThemeTokens,
    editor_site_name: !isPlatformSite(resolvedSiteId) ? (editorTheme?.brand_name || '') : 'KrabiClaw',
    editor_brand_color: editorTheme?.brand_color ?? null,
  }
}

export async function getPublishedSiteBlogPost(db: DbClient, siteId: string, slug: string, env: CloudflareEnv) {
  const post = await queryFirst<ApiRecord>(db, `
    SELECT
      p.id, p.title, p.slug, p.summary AS excerpt, (p.metadata_json ->> '$.category') AS category, json_extract(p.metadata_json, '$.tags') AS tags_json, p.seo_title, p.seo_description, p.seo_keywords,
      p.canonical_url, p.robots, (p.metadata_json ->> '$.featured_order') AS featured_order, p.visibility,
      p.published_at, p.created_at, p.updated_at,
      p.author_id,
      mp.asset_id AS asset_id,
      ma.public_url,
      ma.thumbnail_url,
      ma.kind,
      ma.width,
      ma.height
    FROM content_documents p
    LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = p.id AND mp.slot = 'featured' AND mp.sort_order = 0
    LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
    WHERE p.kind = 'article' AND p.row_role = 'root' AND p.slug = ? AND p.site_id = ? AND p.status = 'published'
      AND (p.scheduled_for IS NULL OR p.scheduled_for <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    LIMIT 1
  `, [slug, siteId])

  if (!post) return null

  const contentDocument = await getContentDocumentById(db, String(post.id))
  if (!contentDocument) throw new HTTPError({ statusCode: 500, statusMessage: 'Blog content document is missing' })
  const [contentBlocks, rawBlocks] = await Promise.all([
    getContentBlocksForDocument(db, String(post.id)),
    listBlocksForDocument(db, contentDocument.id),
  ])
  const socialMedia = (await loadPublicSocialMedia(db, siteId, 'content_document', [String(post.id)])).get(String(post.id))
  const { author_id: authorId, ...postRecord } = post
  const authors = await findAuthUsersByIds(env, [authorId as string | null])
  const author = typeof authorId === 'string' ? authors.get(authorId) ?? null : null
  return {
    ...attachFeaturedMediaFromBareJoin({ ...postRecord, content_blocks: contentBlocks ?? [], body: renderContentBlocksToMarkdown(rawBlocks) }),
    media: socialMedia?.media ?? [],
    social_image: socialMedia?.social_image ?? null,
    author: author ? { id: author.id, name: author.name, image: author.image } : null,
  }
}

export async function getPublishedLocalizedSiteBlogPost(
  db: DbClient,
  siteId: string,
  slug: string,
  locale: string,
  env: CloudflareEnv,
) {
  const site = await queryFirst<{ organization_id: string; vertical: string }>(db, `
    SELECT organization_id, vertical FROM sites WHERE id = ? AND status = 'active' LIMIT 1
  `, [siteId])
  if (!site) return null
  const prefix = normalizeVertical(site.vertical) === 'service' ? 'article' : 'blog'
  if (locale === 'en') {
    const post = await getPublishedSiteBlogPost(db, siteId, slug, env)
    if (!post || typeof post.id !== 'string') return post
    return {
      ...post,
      localeRepresentations: await listPublicLocaleRepresentations(db, {
        organizationId: site.organization_id,
        siteId,
        sourcePath: `/${prefix}/${slug}`,
        sourceLabel: 'English',
        documentId: post.id,
      }),
    }
  }

  const localizations = await loadExactPublicLocalizations(db, site.organization_id, siteId, locale)
  const row = await queryFirst<{ id: string; root_id: string; title: string | null; summary: string | null;
    seo_title: string | null; seo_description: string | null; seo_keywords: string | null; metadata_json: string;
    source_slug: string; updated_at: string }>(db, `
    SELECT d.id, d.root_id, d.title, d.summary, d.seo_title, d.seo_description, d.seo_keywords, d.metadata_json,
           d.updated_at, root.slug AS source_slug
      FROM content_documents d JOIN content_documents root ON root.id = d.root_id
     WHERE d.site_id = ? AND d.locale = ? AND d.path = ? AND d.row_role = 'representation'
       AND root.kind = 'article' AND root.row_role = 'root' AND root.status = 'published' LIMIT 1
  `, [siteId, locale, '/' + prefix + '/' + slug])
  if (!row) return null
  const canonical = await getPublishedSiteBlogPost(db, siteId, row.source_slug, env)
  if (!canonical) return null
  const metadata = JSON.parse(row.metadata_json) as Record<string, unknown>
  const [contentBlocks, rawBlocks, social] = await Promise.all([
    getContentOutline(db, row.id), listBlocksForDocument(db, row.id),
    loadPublicSocialMedia(db, siteId, 'content_document', [row.id]),
  ])
  return { ...canonical, title: row.title, excerpt: row.summary, slug,
    seo_title: row.seo_title, seo_description: row.seo_description, seo_keywords: row.seo_keywords,
    category: metadata.category ?? null, tags: metadata.tags ?? [], nav_title: metadata.nav_title ?? null,
    canonical_url: null, updated_at: row.updated_at, body: renderContentBlocksToMarkdown(rawBlocks),
    content_blocks: contentBlocks.map(block => ({ ...block, media: projectLocalizedMediaAlt(block.media.map(item => ({ ...item, alt_text: item.alt_text ?? null })), localizations) })),
    media: projectLocalizedMediaAlt(social.get(row.id)?.media ?? [], localizations),
    social_image: social.get(row.id)?.social_image ?? null,
    localeRepresentations: await listPublicLocaleRepresentations(db, { organizationId: site.organization_id, siteId,
      sourcePath: '/' + prefix + '/' + row.source_slug, sourceLabel: 'English', documentId: row.root_id }),
  }
}

export async function createPlatformBlogPost(
  db: D1Database,
  authorId: string,
  input: PlatformBlogCreateInput,
  scope: BlogScope = {},
  env?: CloudflareEnv,
) {
  rejectLegacyBlogContentFields(input)
  if (!input.title?.trim()) badRequest('title is required')
  const isTenant = Boolean(scope.site_id)
  validateBlogCommon(input, isTenant)
  if (!isTenant) {
    if (!input.category?.trim()) badRequest('category is required')
    assertValidBlogCategory(input.category)
  }
  const featuredId = featuredAssetId(input)
  const siteId = scope.site_id ?? PLATFORM_SITE_ID
  const organizationId = scope.organization_id ?? PLATFORM_ORGANIZATION_ID
  const placementScope = await mediaPlacementScope(db, siteId, organizationId)
  if (featuredId) {
    await hydrateMediaAssetRefs(db, {
      ...placementScope,
      refs: [{ asset_id: featuredId }],
      allowedKinds: ['image', 'video'],
      fieldName: 'media',
    })
  }
  const id = crypto.randomUUID()
  const customSlug = typeof input.slug === 'string' && input.slug.trim()
    ? normalizeBlogSlug(input.slug)
    : null
  const slugBase = customSlug ?? normalizeSlugFromTitle(input.title, 'post')
  const now = new Date().toISOString()
  let scheduledFor: string | null = null
  try { scheduledFor = parseScheduledFor(input.scheduled_for) } catch (error) { badRequest((error as Error).message) }
  if (scheduledFor && new Date(scheduledFor).getTime() <= Date.now()) badRequest('scheduled_for must be in the future')
  const status = scheduledFor ? 'scheduled' : 'published'
  const publishedAt = scheduledFor ? null : now
  if (input.visibility && !['public', 'unlisted'].includes(input.visibility)) badRequest('visibility must be public or unlisted')
  const canonicalBlocks = await normalizeCanonicalBlogBlocks(db, input, placementScope)
  const canonicalBody = renderCanonicalBlogBody(canonicalBlocks)

  const slugAttempts = customSlug ? 1 : MAX_SLUG_ATTEMPTS
  for (let attempt = 0; attempt < slugAttempts; attempt++) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${randomSlugSuffix()}`
    try {
      await createContentDocumentWithBlocks(db, {
        id, rowRole: 'root', locale: 'en', kind: 'article', organizationId, siteId,
        title: input.title, slug, summary: input.excerpt ?? null, status, visibility: input.visibility ?? 'public',
        authorId, scheduledFor, publishedAt, firstPublishedAt: publishedAt,
        seoTitle: input.seo_title, seoDescription: input.seo_description, seoKeywords: input.seo_keywords,
        canonicalUrl: input.canonical_url, robots: input.robots,
        metadata: { category: input.category ?? null, tags: input.tags ?? null,
          nav_section: input.nav_section ?? null, nav_title: input.nav_title ?? null,
          nav_order: input.nav_order != null ? Number(input.nav_order) : null,
          nav_section_order: input.nav_section_order != null ? Number(input.nav_section_order) : null,
          hide_from_nav: normalizeHideFromNav(input.hide_from_nav) ?? 0,
          featured_order: input.featured_order != null ? Number(input.featured_order) : null,
          slug_manually_overridden: customSlug ? 1 : 0 },
      }, canonicalBlocks, { bodyMarkdown: canonicalBody,
        additionalQueriesAfter: [
          ...insertInitialMediaPlacements({ organizationId: placementScope.organizationId, siteId: placementScope.siteId, placement: { owner_type: 'content_document', owner_id: id, slot: 'featured' }, media: featuredId ? [{ asset_id: featuredId }] : [], now }),
          ...await contentBlockPlacementQueries(db, canonicalBlocks, placementScope, now),
        ],
      })
      const post = await getPlatformBlogPost(db, id, siteId, env)
      if (env) await refreshSocialCard({ db, env, owner: { owner_type: 'content_document', owner_id: id }, actorId: authorId })
      return {
        success: true,
        id,
        slug,
        published_at: publishedAt,
        admin_edit_url: post.admin_edit_url,
        edit_url: post.edit_url,
        public_path: post.public_path,
        public_url: post.public_url,
        preview_url: post.preview_url,
        post,
      }
    } catch (err) {
      if (customSlug && isUniqueConstraintError(err)) badRequest('slug is already in use')
      if (isUniqueConstraintError(err) && attempt < slugAttempts - 1) continue
      throw err
    }
  }

  throw new HTTPError({ statusCode: 500, statusMessage: 'Failed to create post' })
}

export async function updatePlatformBlogLifecycle(
  db: D1Database,
  postIdOrSlug: string,
  input: PlatformBlogLifecycleInput,
  siteId: string | null = null,
): Promise<PlatformBlogLifecycleState> {
  const resolvedSiteId = siteId ?? PLATFORM_SITE_ID
  if (!input.expected_updated_at?.trim()) badRequest('expected_updated_at is required')

  let scheduledFor: string | null = null
  try { scheduledFor = parseScheduledFor(input.scheduled_for) } catch (error) { badRequest((error as Error).message) }
  if (scheduledFor && new Date(scheduledFor).getTime() <= Date.now()) badRequest('scheduled_for must be in the future')

  const sourceId = await resolvePlatformContentId(db, 'article', postIdOrSlug, 'Post not found', resolvedSiteId)
  const source = await queryFirst<{ id: string; status: string; updated_at: string }>(db,
    "SELECT id, status, updated_at FROM content_documents WHERE id = ? AND row_role = 'root' AND kind = 'article'", [sourceId])
  if (!source) notFound('Post not found')
  if (source.status !== 'scheduled') badRequest('Only a scheduled article can be published or rescheduled')
  if (source.updated_at !== input.expected_updated_at) {
    throw new HTTPError({ statusCode: 409, statusMessage: 'Article was updated by another writer' })
  }
  const committedAt = new Date(Math.max(Date.now(), Date.parse(source.updated_at) + 1)).toISOString()
  const result = await execute(db, `UPDATE content_documents SET scheduled_for = ?,
    published_at = ?, first_published_at = CASE WHEN ? IS NULL THEN COALESCE(first_published_at, ?) ELSE first_published_at END,
    status = ?, updated_at = ? WHERE id = ? AND kind = 'article' AND row_role = 'root' AND updated_at = ? AND status = 'scheduled'`,
  [scheduledFor, scheduledFor ? null : committedAt, scheduledFor, committedAt,
    scheduledFor ? 'scheduled' : 'published', committedAt, source.id, input.expected_updated_at])
  if (Number(result.meta.changes ?? 0) !== 1) {
    throw new HTTPError({ statusCode: 409, statusMessage: 'Article was updated by another writer' })
  }
  return { id: source.id, status: scheduledFor ? 'scheduled' as const : 'published' as const,
    published_at: scheduledFor ? null : committedAt, scheduled_for: scheduledFor, updated_at: committedAt }
}

export async function updatePlatformBlogPost(
  db: D1Database, postIdOrSlug: string, input: PlatformBlogUpdateInput,
  siteId: string | null = null, env?: CloudflareEnv,
) {
  const resolvedSiteId = siteId ?? PLATFORM_SITE_ID
  rejectLegacyBlogContentFields(input)
  rejectBlogUpdateLifecycleFields(input)
  if (!BLOG_UPDATE_MUTATION_FIELDS.some(field => input[field] !== undefined)) badRequest('At least one blog mutation field is required')
  const postId = await resolvePlatformContentId(db, 'article', postIdOrSlug, 'Post not found', resolvedSiteId)
  const isTenant = !isPlatformSite(resolvedSiteId)
  validateBlogCommon(input, isTenant)
  const current = await queryFirst<{ organization_id: string; category: string | null; title: string; slug: string;
    first_published_at: string | null; slug_manually_overridden: number; updated_at: string }>(db, `
    SELECT organization_id, metadata_json ->> '$.category' AS category, title, slug, first_published_at,
      metadata_json ->> '$.slug_manually_overridden' AS slug_manually_overridden, updated_at
    FROM content_documents WHERE id = ? AND kind = 'article' AND row_role = 'root'`, [postId])
  if (!current) notFound('Post not found')
  if (input.content_blocks !== undefined && !input.expected_updated_at) badRequest('expected_updated_at is required with content_blocks')
  const effectiveCategory = input.category === undefined ? current.category : input.category
  if (!isTenant) {
    if (!effectiveCategory?.trim()) badRequest('category is required')
    assertValidBlogCategory(effectiveCategory)
  }
  const placementScope = await mediaPlacementScope(db, resolvedSiteId, current.organization_id)
  const normalizedBlocks = input.content_blocks === undefined ? undefined : await normalizeEditorContentBlocks(db, input.content_blocks, placementScope)
  const metadata: Record<string, unknown> = {}
  const changes: ContentDocumentChanges = { metadata }
  if (input.title !== undefined) {
    if (!input.title.trim()) badRequest('title cannot be blank')
    changes.title = input.title
    if (!current.first_published_at && !current.slug_manually_overridden && input.slug === undefined) changes.slug = normalizeBlogSlug(input.title)
  }
  if (input.reset_slug_override && input.slug !== undefined && input.slug !== null) badRequest('reset_slug_override cannot be combined with a manual slug')
  const slugMutation = resolveSlugMutation({ requestedSlug: input.reset_slug_override ? null : input.slug,
    title: input.title ?? current.title, currentSlug: current.slug, manuallyOverridden: Boolean(current.slug_manually_overridden) })
  const requestedSlug = input.slug !== undefined || input.reset_slug_override ? slugMutation.slug : changes.slug
  if (requestedSlug && requestedSlug !== current.slug) {
    const redirect = await queryFirst<{ id: string }>(db, `SELECT id FROM site_redirects WHERE site_id = ? AND locale = 'en' AND from_path IN (?, ?, ?) LIMIT 1`,
      [resolvedSiteId, `/blog/${requestedSlug}`, `/article/${requestedSlug}`, `/${requestedSlug}`])
    if (redirect) badRequest('Slug collides with redirect history')
    changes.slug = requestedSlug
    if (input.slug !== undefined || input.reset_slug_override) metadata.slug_manually_overridden = slugMutation.manuallyOverridden ? 1 : 0
  } else if (input.reset_slug_override) metadata.slug_manually_overridden = 0
  for (const field of ['seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots', 'visibility'] as const) {
    if (input[field] !== undefined) changes[field] = input[field]
  }
  if (input.excerpt !== undefined) changes.summary = input.excerpt
  for (const field of ['category', 'nav_section', 'nav_title'] as const) if (input[field] !== undefined) metadata[field] = input[field]
  for (const field of ['nav_order', 'nav_section_order', 'featured_order'] as const) {
    if (input[field] !== undefined) metadata[field] = input[field] === null ? null : Number(input[field])
  }
  if (input.tags !== undefined) metadata.tags = input.tags
  if (input.hide_from_nav !== undefined) metadata.hide_from_nav = normalizeHideFromNav(input.hide_from_nav) ?? 0
  const featuredId = featuredAssetId(input)
  if (featuredId) await hydrateMediaAssetRefs(db, { ...placementScope, refs: [{ asset_id: featuredId }], allowedKinds: ['image', 'video'], fieldName: 'media' })
  const now = new Date().toISOString()
  const mediaQueries = featuredId === undefined ? [] : buildSingleMediaPlacementQueries({
    organizationId: placementScope.organizationId, siteId: placementScope.siteId,
    placement: { owner_type: 'content_document', owner_id: postId, slot: 'featured' }, media: featuredId ? [{ asset_id: featuredId }] : [], now,
  })
  try {
    await updateContentDocument(db, postId, {
      expected_updated_at: input.expected_updated_at ?? current.updated_at, blocks: normalizedBlocks, changes,
      additionalQueriesAfter: [...mediaQueries, ...(normalizedBlocks ? await contentBlockPlacementQueries(db, normalizedBlocks, placementScope, now) : [])],
    })
    if (requestedSlug && requestedSlug !== current.slug && current.first_published_at && input.redirect_old_slug !== false) {
      await createBlogRedirect(db, postId, siteId, current.slug)
    }
    const post = await getPlatformBlogPost(db, postId, siteId, env)
    if (env) await refreshSocialCard({ db, env, owner: { owner_type: 'content_document', owner_id: postId } })
    return { success: true, admin_edit_url: post.admin_edit_url, edit_url: post.edit_url,
      public_path: post.public_path, public_url: post.public_url, preview_url: post.preview_url, post }
  } catch (error) {
    if (isUniqueConstraintError(error)) badRequest('Slug already in use')
    throw error
  }
}

export async function deletePlatformBlogPost(db: D1Database, postIdOrSlug: string, siteId: string | null = null) {
  const postId = await resolvePlatformContentId(db, 'article', postIdOrSlug, 'Post not found', siteId ?? PLATFORM_SITE_ID)
  const document = await getContentDocumentById(db, postId)
  if (!document) notFound('Document not found')
  await executeBatch(db, prepareContentDocumentDeletion({ documentId: document.id,
    organizationId: document.organization_id, siteId: document.site_id }))
  return { success: true }
}

export async function reorderPlatformBlogPosts(
  db: D1Database,
  items: Array<{
    post_id: string
    nav_section?: string | null
    nav_title?: string | null
    nav_order: number
    nav_section_order?: number | null
    hide_from_nav?: boolean | number | null
  }>,
  siteId: string | null = null,
  env?: CloudflareEnv,
) {
  if (!items.length) badRequest('items are required')
  if (new Set(items.map(item => item.post_id)).size !== items.length) badRequest('Reorder identifiers must be distinct')
  const queries: BatchQuery[] = []
  for (const item of items) {
    validateNavMetadata(item)
    const id = await resolvePlatformContentId(db, 'article', item.post_id, 'Post not found', siteId ?? PLATFORM_SITE_ID)
    const document = await getContentDocumentById(db, id)
    if (!document) notFound('Post not found')
    const metadata: Record<string, unknown> = { nav_order: Number(item.nav_order) }
    for (const field of ['nav_section', 'nav_title'] as const) if (hasOwnField(item, field)) metadata[field] = item[field] ?? null
    for (const field of ['nav_section_order'] as const) if (hasOwnField(item, field)) metadata[field] = item[field] === null ? null : Number(item[field])
    if (hasOwnField(item, 'hide_from_nav')) metadata.hide_from_nav = normalizeHideFromNav(item.hide_from_nav) ?? 0
    queries.push(...prepareContentDocumentUpdate(document, { expected_updated_at: document.updated_at, changes: { metadata } }).queries)
  }
  await executeBatch(db, queries)
  return { success: true, posts: await listPlatformBlogPosts(db, null, siteId, env) }
}

export async function listPlatformDocs(db: DbClient, _status?: string | null) {
  const sql = `SELECT
      d.id, d.title, d.slug, d.summary AS excerpt, (d.metadata_json ->> '$.category') AS category, d.seo_description, d.seo_keywords, d.canonical_url, d.robots,
      (d.metadata_json ->> '$.nav_section') AS nav_section, (d.metadata_json ->> '$.nav_title') AS nav_title, (d.metadata_json ->> '$.nav_order') AS nav_order, (d.metadata_json ->> '$.nav_section_order') AS nav_section_order, (d.metadata_json ->> '$.nav_group') AS nav_group, (d.metadata_json ->> '$.nav_group_order') AS nav_group_order, (d.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (d.metadata_json ->> '$.featured_order') AS featured_order,
      mp.asset_id AS asset_id, ma.public_url AS media_public_url, ma.thumbnail_url AS media_thumbnail_url, ma.kind AS media_kind,
      ma.width AS media_width, ma.height AS media_height,
      (d.metadata_json ->> '$.difficulty_level') AS difficulty_level, d.sort_order, d.created_at, d.updated_at
    FROM content_documents d
    LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = d.id AND mp.slot = 'featured' AND mp.sort_order = 0
    LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
    WHERE d.kind = 'platform_doc' AND d.row_role = 'root' AND d.site_id = 'platform' ORDER BY COALESCE((d.metadata_json ->> '$.featured_order'), 999999), COALESCE((d.metadata_json ->> '$.nav_section_order'), 999999), COALESCE((d.metadata_json ->> '$.nav_section'), (d.metadata_json ->> '$.category')), COALESCE((d.metadata_json ->> '$.nav_group_order'), 999999), COALESCE((d.metadata_json ->> '$.nav_group'), ''), COALESCE((d.metadata_json ->> '$.nav_order'), d.sort_order, 999999), d.created_at DESC`
  const results = await queryAll<ApiRecord>(db, sql)
  return (results ?? []).map(record => platformDocReviewUrls(attachFeaturedMedia(attachPublished(record, true))))
}

export async function getPlatformDoc(db: DbClient, docIdOrSlug: string) {
  const docId = await resolvePlatformContentId(db, 'platform_doc', docIdOrSlug, 'Doc not found')
  const doc = await queryFirst<ApiRecord | null>(
    db,
    `SELECT
       d.id, d.title, d.slug, d.summary AS excerpt, (d.metadata_json ->> '$.category') AS category, d.seo_description, d.seo_keywords, d.canonical_url, d.robots,
       (d.metadata_json ->> '$.nav_section') AS nav_section, (d.metadata_json ->> '$.nav_title') AS nav_title, (d.metadata_json ->> '$.nav_order') AS nav_order, (d.metadata_json ->> '$.nav_section_order') AS nav_section_order, (d.metadata_json ->> '$.nav_group') AS nav_group, (d.metadata_json ->> '$.nav_group_order') AS nav_group_order, (d.metadata_json ->> '$.hide_from_nav') AS hide_from_nav, (d.metadata_json ->> '$.featured_order') AS featured_order,
       (d.metadata_json ->> '$.difficulty_level') AS difficulty_level, d.sort_order,
       mp.asset_id AS asset_id, ma.public_url AS media_public_url, ma.thumbnail_url AS media_thumbnail_url, ma.kind AS media_kind,
       ma.width AS media_width, ma.height AS media_height,
       d.created_at, d.updated_at
     FROM content_documents d
     LEFT JOIN media_placements mp ON mp.owner_type = 'content_document' AND mp.owner_id = d.id AND mp.slot = 'featured' AND mp.sort_order = 0
     LEFT JOIN media_assets ma ON ma.id = mp.asset_id AND ma.status = 'active'
     WHERE d.kind = 'platform_doc' AND d.row_role = 'root' AND d.site_id = 'platform' AND d.id = ?`,
    [docId],
  )
  if (!doc) notFound('Doc not found')
  const contentDocument = await getContentEditorSnapshot(db, docId)
  if (!contentDocument) throw new HTTPError({ statusCode: 500, statusMessage: 'Documentation content document is missing' })
  return {
    ...platformDocReviewUrls(attachFeaturedMedia(attachPublished(doc, true))),
    content_blocks: contentDocument.blocks,
    updated_at: contentDocument.document.updated_at,
  }
}

export async function createPlatformDoc(
  db: D1Database,
  authorId: string,
  input: PlatformDocCreateInput,
  env?: CloudflareEnv,
) {
  if (!input.title || !input.content_blocks?.length) badRequest('title and content_blocks are required')
  validateDocCommon(input)
  const placementScope = await mediaPlacementScope(db, null, null)
  const normalizedBlocks = await normalizeEditorContentBlocks(db, input.content_blocks, placementScope)
  const canonicalBody = renderCanonicalBlogBody(normalizedBlocks)
  const featuredId = featuredAssetId(input)
  if (featuredId) {
    await hydrateMediaAssetRefs(db, {
      ...placementScope,
      refs: [{ asset_id: featuredId }],
      allowedKinds: ['image', 'video'],
      fieldName: 'media',
    })
  }

  const id = crypto.randomUUID()
  const slugBase = normalizeSlugFromTitle(input.title, 'doc')
  const now = new Date().toISOString()

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 0 ? slugBase : `${slugBase}-${randomSlugSuffix()}`
    try {
      await createContentDocumentWithBlocks(db, {
        id, rowRole: 'root', locale: 'en', kind: 'platform_doc',
        organizationId: PLATFORM_ORGANIZATION_ID, siteId: PLATFORM_SITE_ID,
        title: input.title, slug, summary: input.excerpt, authorId, sortOrder: input.sort_order ?? 0,
        seoDescription: input.seo_description, seoKeywords: input.seo_keywords,
        canonicalUrl: input.canonical_url, robots: input.robots,
        metadata: { category: input.category ?? null, nav_section: input.nav_section ?? null,
          nav_title: input.nav_title ?? null, nav_order: input.nav_order != null ? Number(input.nav_order) : null,
          nav_section_order: input.nav_section_order != null ? Number(input.nav_section_order) : null,
          nav_group: input.nav_group ?? null, nav_group_order: input.nav_group_order ?? null,
          hide_from_nav: normalizeHideFromNav(input.hide_from_nav) ?? 0,
          featured_order: input.featured_order != null ? Number(input.featured_order) : null,
          difficulty_level: input.difficulty_level ?? null },
      }, normalizedBlocks, { bodyMarkdown: canonicalBody,
        additionalQueriesAfter: [
          ...insertInitialMediaPlacements({ organizationId: placementScope.organizationId, siteId: placementScope.siteId, placement: { owner_type: 'content_document', owner_id: id, slot: 'featured' }, media: featuredId ? [{ asset_id: featuredId }] : [], now }),
          ...await contentBlockPlacementQueries(db, normalizedBlocks, placementScope, now),
        ],
      })

      const doc = await getPlatformDoc(db, id)
      if (env) await refreshSocialCard({ db, env, owner: { owner_type: 'content_document', owner_id: id }, actorId: authorId })
      return {
        success: true,
        id,
        slug,
        admin_edit_url: doc.admin_edit_url,
        public_path: doc.public_path,
        public_url: doc.public_url,
        doc,
      }
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < MAX_SLUG_ATTEMPTS - 1) continue
      throw err
    }
  }
  throw new HTTPError({ statusCode: 500, statusMessage: 'Failed to create doc' })
}

export async function updatePlatformDoc(
  db: D1Database, docIdOrSlug: string, input: PlatformDocUpdateInput, env?: CloudflareEnv,
) {
  validateDocCommon(input)
  const docId = await resolvePlatformContentId(db, 'platform_doc', docIdOrSlug, 'Doc not found')
  const document = await getContentDocumentById(db, docId)
  if (!document) notFound('Doc not found')
  const changes: ContentDocumentChanges = {}
  const metadata: Record<string, unknown> = {}
  changes.metadata = metadata
  if (input.title !== undefined) {
    if (!input.title.trim()) badRequest('title cannot be blank')
    changes.title = input.title
    changes.slug = normalizeSlugFromTitle(input.title, 'doc')
  }
  if (input.excerpt !== undefined) changes.summary = input.excerpt
  for (const field of ['seo_description', 'seo_keywords', 'canonical_url', 'robots'] as const) {
    if (input[field] !== undefined) changes[field] = input[field]
  }
  if (input.sort_order !== undefined) {
    if (input.sort_order === null || !Number.isInteger(input.sort_order)) badRequest('sort_order must be an integer')
    changes.sort_order = input.sort_order
  }
  for (const field of ['category', 'nav_section', 'nav_title', 'nav_group', 'difficulty_level'] as const) {
    if (input[field] !== undefined) metadata[field] = input[field]
  }
  for (const field of ['nav_order', 'nav_section_order', 'nav_group_order', 'featured_order'] as const) {
    if (input[field] !== undefined) metadata[field] = input[field] === null ? null : Number(input[field])
  }
  if (input.hide_from_nav !== undefined) metadata.hide_from_nav = normalizeHideFromNav(input.hide_from_nav) ?? 0
  const placementScope = await mediaPlacementScope(db, null, null)
  const featuredId = featuredAssetId(input)
  if (featuredId) await hydrateMediaAssetRefs(db, { ...placementScope, refs: [{ asset_id: featuredId }], allowedKinds: ['image', 'video'], fieldName: 'media' })
  const blocks = input.content_blocks === undefined ? undefined : await normalizeEditorContentBlocks(db, input.content_blocks, placementScope)
  if (blocks) {
    if (!blocks.length) badRequest('content_blocks cannot be empty')
    if (!input.expected_updated_at) badRequest('expected_updated_at is required with content_blocks')
  }
  const now = new Date().toISOString()
  const mediaQueries = featuredId === undefined ? [] : buildSingleMediaPlacementQueries({
    organizationId: placementScope.organizationId, siteId: placementScope.siteId,
    placement: { owner_type: 'content_document', owner_id: docId, slot: 'featured' }, media: featuredId ? [{ asset_id: featuredId }] : [], now,
  })
  try {
    await updateContentDocument(db, docId, { expected_updated_at: input.expected_updated_at ?? document.updated_at, blocks, changes,
      additionalQueriesAfter: [...mediaQueries, ...(blocks ? await contentBlockPlacementQueries(db, blocks, placementScope, now) : [])],
    })
    const doc = await getPlatformDoc(db, docId)
    if (env) await refreshSocialCard({ db, env, owner: { owner_type: 'content_document', owner_id: docId } })
    return { success: true, admin_edit_url: doc.admin_edit_url, public_path: doc.public_path, public_url: doc.public_url, doc }
  } catch (error) {
    if (isUniqueConstraintError(error)) badRequest('Slug already in use')
    throw error
  }
}

export async function deletePlatformDoc(db: D1Database, docIdOrSlug: string) {
  const docId = await resolvePlatformContentId(db, 'platform_doc', docIdOrSlug, 'Doc not found')
  const document = await getContentDocumentById(db, docId)
  if (!document) notFound('Document not found')
  await executeBatch(db, prepareContentDocumentDeletion({ documentId: document.id,
    organizationId: document.organization_id, siteId: document.site_id }))
  return { success: true }
}

export async function reorderPlatformDocs(
  db: D1Database,
  items: Array<{
    doc_id: string
    nav_section?: string | null
    nav_title?: string | null
    nav_order: number
    nav_section_order?: number | null
    nav_group?: string | null
    nav_group_order?: number | null
    hide_from_nav?: boolean | number | null
  }>,
) {
  if (!items.length) badRequest('items are required')
  if (new Set(items.map(item => item.doc_id)).size !== items.length) badRequest('Reorder identifiers must be distinct')
  const queries: BatchQuery[] = []
  for (const item of items) {
    validateNavMetadata(item)
    validateDocNavGroupMetadata(item)
    const id = await resolvePlatformContentId(db, 'platform_doc', item.doc_id, 'Doc not found', PLATFORM_SITE_ID)
    const document = await getContentDocumentById(db, id)
    if (!document) notFound('Doc not found')
    const metadata: Record<string, unknown> = { nav_order: Number(item.nav_order) }
    for (const field of ['nav_section', 'nav_title', 'nav_group'] as const) if (hasOwnField(item, field)) metadata[field] = item[field] ?? null
    for (const field of ['nav_section_order', 'nav_group_order'] as const) if (hasOwnField(item, field)) metadata[field] = item[field] === null ? null : Number(item[field])
    if (hasOwnField(item, 'hide_from_nav')) metadata.hide_from_nav = normalizeHideFromNav(item.hide_from_nav) ?? 0
    queries.push(...prepareContentDocumentUpdate(document, { expected_updated_at: document.updated_at, changes: { metadata } }).queries)
  }
  await executeBatch(db, queries)
  return { success: true, docs: await listPlatformDocs(db) }
}
