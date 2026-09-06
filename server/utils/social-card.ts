import { executeBatch, queryAll, queryFirst, type DbClient } from '~/server/db'
import {
  buildSingleMediaPlacementQueries,
  deleteMediaAsset,
  readMediaPlacements,
  type StoredMediaPlacementItem,
} from '~/server/utils/media-asset-manager'
import { uploadResolvedMediaToAssetStore, type UploadResolvedMediaInput } from '~/server/utils/media-upload'
import { renderOgImagePng } from '~/server/utils/og-image/render'
import { PLATFORM_SITE_ID } from '~/shared/platform-scope'
import {
  hashSocialCardGenerationInput,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  truncateForSeo,
  type SocialCardRenderPayload,
  type SocialTemplate,
} from '~/utils/social-metadata'
import { resolvePublicTemplate } from '~/utils/template-registry'

const SOCIAL_CARD_OWNERS = {
  site: { table: 'sites', site: 'o.id', filter: "o.status = 'active'", slots: [] },
  business_location: { table: 'business_locations', site: 'o.site_id', filter: "o.status = 'active'", slots: ['hero', 'gallery'] },
  product: { table: 'products', site: 'o.site_id', filter: 'o.is_visible = 1', slots: ['image', 'gallery'] },
  content_document: { table: 'content_documents', site: 'o.site_id', filter: "o.kind IN ('page','article','platform_doc','social_post') AND EXISTS (SELECT 1 FROM content_documents root WHERE root.id = COALESCE(o.root_id, o.id) AND (root.kind IN ('page','platform_doc') OR root.status = 'published')) AND (o.kind != 'page' OR o.path != '/')", slots: ['cover', 'featured', 'gallery'] },
  offering: { table: 'offerings', site: 'o.site_id', filter: '1 = 1', slots: ['hero', 'thumbnail', 'gallery'] },
  review: { table: 'reviews', site: 'o.site_id', filter: "o.status = 'approved' AND o.site_id IS NOT NULL", slots: ['portrait', 'gallery'] },
} satisfies Record<string, { table: string; site: string; filter: string; slots: string[] }>

export type SocialCardOwner = { owner_type: keyof typeof SOCIAL_CARD_OWNERS; owner_id: string }

export async function listSocialCardOwners(db: DbClient, input: { siteId?: string; after?: string | null; limit?: number } = {}) {
  const owners: (SocialCardOwner & { cursor: string })[] = []
  for (const [ownerType, source] of Object.entries(SOCIAL_CARD_OWNERS).sort(([left], [right]) => left < right ? -1 : 1)) {
    const remaining = input.limit === undefined ? -1 : input.limit - owners.length
    if (remaining === 0) break
    owners.push(...await queryAll<SocialCardOwner & { cursor: string }>(db, `SELECT '${ownerType}' AS owner_type, o.id AS owner_id, '${ownerType}:' || o.id AS cursor
      FROM ${source.table} o WHERE ${source.filter}
        AND (? IS NULL OR ${source.site} = ?) AND (? IS NULL OR '${ownerType}:' || o.id > ?)
      ORDER BY o.id LIMIT ?`, [input.siteId ?? null, input.siteId ?? null, input.after ?? null, input.after ?? null, remaining]))
  }
  return owners
}

export type SocialCardRefreshResult =
  | { kind: 'generated'; owner: SocialCardOwner; assetId: string; publicUrl: string; generationKey: string }
  | { kind: 'reused'; owner: SocialCardOwner; assetId: string; publicUrl: string; generationKey: string }
  | { kind: 'skipped'; owner: SocialCardOwner; reason: 'no_source' | 'owner_not_found' | 'missing_content' }
  | { kind: 'failed'; owner: SocialCardOwner; error: string }

interface OwnerRecord {
  organization_id: string
  site_id: string
  title: string | null
  description: string | null
  label: string | null
  location: string | null
}

interface SiteRecord {
  organization_id: string
  id: string
  brand_name: string | null
  brand_description: string | null
  theme_id: string
  vertical: string
}

export type SocialCardPlacedAsset = StoredMediaPlacementItem

const SOCIAL_CARD_RENDERER_VERSION = 'social-card-v2'
type SocialCardEnv = UploadResolvedMediaInput['env'] & { NUXT_PUBLIC_PLATFORM_DOMAIN?: string }

export async function socialCardRefreshOwnersForPlacement(db: DbClient, placement: {
  owner_type: string
  owner_id: string
  slot: string
}): Promise<SocialCardOwner[]> {
  if (placement.slot === 'social_card') return []
  switch (placement.owner_type) {
    case 'site':
      return placement.slot === 'logo' || placement.slot === 'social_share'
        ? [{ owner_type: 'site', owner_id: placement.owner_id }]
        : []
    case 'content_block': {
      const document = await queryFirst<{ id: string; site_id: string; kind: string; path: string | null }>(db, `
        SELECT d.id, d.site_id, d.kind, d.path
          FROM content_blocks cb
          JOIN content_documents d ON d.id = cb.document_id
         WHERE cb.id = ? AND d.kind IN ('page','article','platform_doc','social_post')
         LIMIT 1
      `, [placement.owner_id])
      if (!document) return []
      return document.kind === 'page' && document.path === '/'
        ? [{ owner_type: 'site', owner_id: document.site_id }]
        : [{ owner_type: 'content_document', owner_id: document.id }]
    }
    case 'business_location':
    case 'product':
    case 'content_document':
    case 'offering':
    case 'review':
      return SOCIAL_CARD_OWNERS[placement.owner_type].slots.some(slot => slot === placement.slot)
        ? [{ owner_type: placement.owner_type, owner_id: placement.owner_id }]
        : []
    default:
      return []
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function mediaUrl(asset: SocialCardPlacedAsset | null): string | null {
  if (!asset) return null
  if (asset.kind === 'video') return asset.thumbnail_url?.trim() || null
  return asset.kind === 'image' ? asset.public_url?.trim() || null : null
}

async function loadOwner(db: DbClient, owner: SocialCardOwner): Promise<OwnerRecord | null> {
  switch (owner.owner_type) {
    case 'site':
      return await queryFirst<OwnerRecord>(db, `SELECT organization_id, id AS site_id,
        COALESCE(NULLIF(trim(seo_title), ''), NULLIF(trim(brand_name), '')) AS title,
        COALESCE(NULLIF(trim(seo_description), ''), NULLIF(trim(brand_description), '')) AS description,
        NULL AS label, NULL AS location FROM sites WHERE id = ? LIMIT 1`, [owner.owner_id]) ?? null
    case 'business_location':
      return await queryFirst<OwnerRecord>(db, `SELECT organization_id, site_id,
        COALESCE(NULLIF(trim(seo_title), ''), title) AS title,
        COALESCE(NULLIF(trim(seo_description), ''), NULLIF(trim(short_description), ''), NULLIF(trim(description), '')) AS description,
        'Location' AS label, city AS location FROM business_locations WHERE id = ? LIMIT 1`, [owner.owner_id]) ?? null
    case 'product':
      return await queryFirst<OwnerRecord>(db, `SELECT p.organization_id, p.site_id,
        COALESCE(NULLIF(trim(p.seo_title), ''), p.name) AS title,
        COALESCE(NULLIF(trim(p.seo_description), ''), NULLIF(trim(p.description), '')) AS description,
        CASE p.product_type WHEN 'experience' THEN 'Experience' ELSE 'Product' END AS label, bl.title AS location
        FROM products p JOIN business_locations bl ON bl.id = p.location_id WHERE p.id = ? LIMIT 1`, [owner.owner_id]) ?? null
    case 'content_document':
      return await queryFirst<OwnerRecord>(db, `SELECT d.organization_id, d.site_id,
        COALESCE(NULLIF(trim(d.seo_title), ''), NULLIF(trim(d.title), ''), NULLIF(trim(substr(d.summary, 1, 80)), '')) AS title,
        COALESCE(NULLIF(trim(d.seo_description), ''), NULLIF(trim(d.summary), '')) AS description,
        CASE d.kind WHEN 'article' THEN 'Article' WHEN 'platform_doc' THEN 'Documentation' WHEN 'social_post' THEN 'Update' END AS label,
        bl.title AS location
        FROM content_documents d JOIN content_documents root ON root.id = COALESCE(d.root_id, d.id)
        LEFT JOIN business_locations bl ON bl.id = root.location_id
        WHERE d.id = ? AND d.kind IN ('page','article','platform_doc','social_post') LIMIT 1`, [owner.owner_id]) ?? null
    case 'offering':
      return await queryFirst<OwnerRecord>(db, `SELECT o.organization_id, o.site_id,
        COALESCE(NULLIF(trim(o.seo_title), ''), o.name) AS title,
        COALESCE(NULLIF(trim(o.seo_description), ''), NULLIF(trim(o.short_description), ''), NULLIF(trim(o.summary), '')) AS description,
        'Service' AS label, bl.title AS location
        FROM offerings o LEFT JOIN business_locations bl ON bl.id = o.location_id WHERE o.id = ? LIMIT 1`, [owner.owner_id]) ?? null
    case 'review':
      return await queryFirst<OwnerRecord>(db, `SELECT organization_id, site_id,
        COALESCE(NULLIF(trim(title), ''), 'Review by ' || COALESCE(NULLIF(trim(author_name), ''), 'a customer')) AS title,
        NULLIF(trim(content), '') AS description, 'Review' AS label, NULL AS location
        FROM reviews WHERE id = ? AND organization_id IS NOT NULL AND site_id IS NOT NULL LIMIT 1`, [owner.owner_id]) ?? null
  }
}

async function loadSite(db: DbClient, siteId: string): Promise<SiteRecord | null> {
  return await queryFirst<SiteRecord>(db, `SELECT s.organization_id, s.id, s.brand_name, s.brand_description,
    s.theme_id, s.vertical
    FROM sites s WHERE s.id = ? LIMIT 1`, [siteId]) ?? null
}

async function loadDocumentBlockAssets(db: DbClient, siteId: string, documentId: string): Promise<SocialCardPlacedAsset[]> {
  const blocks = await queryAll<{ id: string }>(db, `
    SELECT cb.id
      FROM content_blocks cb
     WHERE cb.document_id = ?
     ORDER BY CASE cb.type WHEN 'hero' THEN 0 WHEN 'image' THEN 1 WHEN 'gallery' THEN 2 ELSE 3 END,
              cb.position, cb.created_at, cb.id
  `, [documentId])
  if (!blocks.length) return []
  const placements = await readMediaPlacements(db, {
    siteId,
    ownerType: 'content_block',
    ownerIds: blocks.map(block => block.id),
  })
  return blocks.flatMap(block => {
    const items = placements.get(block.id) ?? []
    return [...items].sort((left, right) => {
      const slotRank = (slot: string) => slot === 'media' ? 0 : slot === 'gallery' ? 1 : 2
      return slotRank(left.slot) - slotRank(right.slot) || left.sort_order - right.sort_order
    })
  })
}

async function homepageDocumentId(db: DbClient, siteId: string): Promise<string | null> {
  const row = await queryFirst<{ id: string }>(db, `
    SELECT id FROM content_documents
     WHERE site_id = ? AND kind = 'page' AND path = '/' AND row_role = 'root'
     LIMIT 1
  `, [siteId])
  return row?.id ?? null
}

async function loadPlacedAssets(db: DbClient, siteId: string, owner: SocialCardOwner): Promise<SocialCardPlacedAsset[]> {
  const ownerAssets = (await readMediaPlacements(db, {
    siteId,
    ownerType: owner.owner_type,
    ownerIds: [owner.owner_id],
    includePendingSocialCard: true,
  })).get(owner.owner_id) ?? []
  const documentId = owner.owner_type === 'content_document'
    ? owner.owner_id
    : owner.owner_type === 'site'
      ? await homepageDocumentId(db, siteId)
      : null
  const pageAssets = documentId ? await loadDocumentBlockAssets(db, siteId, documentId) : []
  if (owner.owner_type === 'site') return [...ownerAssets, ...pageAssets]
  const siteAssets = (await readMediaPlacements(db, {
    siteId,
    ownerType: 'site',
    ownerIds: [siteId],
  })).get(siteId) ?? []
  return [...ownerAssets, ...pageAssets, ...siteAssets]
}

function firstAsset(assets: SocialCardPlacedAsset[], owner: SocialCardOwner, slots: readonly string[]): SocialCardPlacedAsset | null {
  for (const slot of slots) {
    const asset = assets.find(item => item.owner_type === owner.owner_type
      && item.owner_id === owner.owner_id && item.slot === slot && mediaUrl(item))
    if (asset) return asset
  }
  return null
}

function siteAsset(assets: SocialCardPlacedAsset[], siteId: string, slot: string): SocialCardPlacedAsset | null {
  return assets.find(item => item.owner_type === 'site' && item.owner_id === siteId
    && item.slot === slot && mediaUrl(item)) ?? null
}

export function selectSocialCardPlacements(
  assets: SocialCardPlacedAsset[],
  owner: SocialCardOwner,
  siteId: string,
) {
  const ownerSource = firstAsset(assets, owner, SOCIAL_CARD_OWNERS[owner.owner_type].slots)
  const contentSource = (owner.owner_type === 'site' || owner.owner_type === 'content_document')
    ? assets.find(item => item.owner_type === 'content_block' && mediaUrl(item)) ?? null
    : null
  const socialShare = siteAsset(assets, siteId, 'social_share')
  const logo = siteAsset(assets, siteId, 'logo')
  const current = assets.find(item => item.owner_type === owner.owner_type
    && item.owner_id === owner.owner_id && item.slot === 'social_card') ?? null
  return { ownerSource, contentSource, socialShare, logo, current, source: contentSource ?? ownerSource ?? socialShare ?? logo }
}

export function buildSocialCardGenerationKey(input: {
  sourceAssetId: string
  logoAssetId: string | null
  sourceUpdatedAt?: string | null
  logoUpdatedAt?: string | null
  payload: SocialCardRenderPayload
}): string {
  return hashSocialCardGenerationInput(JSON.stringify({ renderer: SOCIAL_CARD_RENDERER_VERSION, ...input }))
}

function socialTemplate(site: SiteRecord): SocialTemplate {
  if (site.id === PLATFORM_SITE_ID) return 'platform'
  return resolvePublicTemplate({ themeId: site.theme_id, vertical: site.vertical }).slug
}

async function clearSocialCard(input: { db: DbClient; env: SocialCardEnv; owner: SocialCardOwner; actorId?: string | null }, reason: 'no_source' | 'owner_not_found' | 'missing_content') {
  const assets = await queryAll<{ id: string; site_id: string }>(input.db, `SELECT ma.id, ma.site_id FROM media_placements mp
    JOIN media_assets ma ON ma.id = mp.asset_id AND ma.site_id = mp.site_id AND ma.organization_id = mp.organization_id
    WHERE mp.owner_type = ? AND mp.owner_id = ? AND mp.slot = 'social_card' AND ma.source = 'generated'`, [input.owner.owner_type, input.owner.owner_id])
  await executeBatch(input.db, [{ query: "UPDATE media_placements SET status = 'pending' WHERE owner_type = ? AND owner_id = ? AND slot = 'social_card'", params: [input.owner.owner_type, input.owner.owner_id] }])
  for (const asset of assets) await deleteMediaAsset(input.db, input.env, asset.id, asset.site_id, input.actorId ?? null)
  const result = { kind: 'skipped' as const, owner: input.owner, reason }
  console.info('[social-card]', result)
  return result
}
export async function refreshSocialCard(input: {
  db: DbClient
  env: SocialCardEnv
  owner: SocialCardOwner
  actorId?: string | null
}): Promise<SocialCardRefreshResult> {
  const { db, env, owner } = input
  try {
    const ownerRecord = await loadOwner(db, owner)
    if (!ownerRecord) return await clearSocialCard(input, 'owner_not_found')
    const site = await loadSite(db, ownerRecord.site_id)
    if (!site) return await clearSocialCard(input, 'owner_not_found')
    const title = ownerRecord.title?.trim()
    const siteName = site.brand_name?.trim() || (site.id === PLATFORM_SITE_ID ? 'KrabiClaw' : null)
    if (!title || !siteName) return await clearSocialCard(input, 'missing_content')

    const assets = await loadPlacedAssets(db, site.id, owner)
    const { logo, current, source } = selectSocialCardPlacements(assets, owner, site.id)
    const backgroundImageUrl = mediaUrl(source)
    if (!source || !backgroundImageUrl) return await clearSocialCard(input, 'no_source')

    const payload: SocialCardRenderPayload = {
      template: socialTemplate(site),
      title,
      description: truncateForSeo(ownerRecord.description, 160),
      siteName,
      label: ownerRecord.label,
      location: ownerRecord.location,
      logoUrl: mediaUrl(logo),
      backgroundImageUrl,
    }
    const generationKey = buildSocialCardGenerationKey({
      sourceAssetId: source.asset_id,
      logoAssetId: logo?.asset_id ?? null,
      sourceUpdatedAt: source.updated_at,
      logoUpdatedAt: logo?.updated_at ?? null,
      payload,
    })
    if (current?.generation_key === generationKey && current.public_url) {
      await executeBatch(db, [{ query: "UPDATE media_placements SET status = 'active' WHERE owner_type = ? AND owner_id = ? AND slot = 'social_card' AND asset_id = ?", params: [owner.owner_type, owner.owner_id, current.asset_id] }])
      return { kind: 'reused', owner, assetId: current.asset_id, publicUrl: current.public_url, generationKey }
    }
    await executeBatch(db, [{ query: "UPDATE media_placements SET status = 'pending' WHERE owner_type = ? AND owner_id = ? AND slot = 'social_card'", params: [owner.owner_type, owner.owner_id] }])

    const png = await renderOgImagePng(payload, { platformDomain: env.NUXT_PUBLIC_PLATFORM_DOMAIN })
    const uploaded = await uploadResolvedMediaToAssetStore({
      db,
      env,
      siteId: site.id,
      organizationId: site.organization_id,
      userId: input.actorId ?? null,
      buffer: Uint8Array.from(png),
      contentType: 'image/png',
      filename: 'social-card.png',
      source: 'generated',
      kind: 'image',
      altText: ownerRecord.title,
      fileSize: png.byteLength,
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      generationKey,
    })

    try {
      if (current?.source === 'generated' && current.asset_id !== uploaded.assetId) {
        await deleteMediaAsset(db, env, current.asset_id, site.id, input.actorId ?? null)
      }
      await executeBatch(db, buildSingleMediaPlacementQueries({
        organizationId: site.organization_id,
        siteId: site.id,
        placement: { owner_type: owner.owner_type, owner_id: owner.owner_id, slot: 'social_card' },
        media: [{ asset_id: uploaded.assetId }],
      }), { operation: 'replace social card placement' })
    } catch (placementError) {
      try {
        await deleteMediaAsset(db, env, uploaded.assetId, site.id, input.actorId ?? null)
      } catch (cleanupError) {
        throw new AggregateError([placementError, cleanupError], 'Social card placement and cleanup failed', { cause: cleanupError })
      }
      throw placementError
    }

    return { kind: 'generated', owner, assetId: uploaded.assetId, publicUrl: uploaded.publicUrl, generationKey }
  } catch (error) {
    console.error('[social-card]', {
      stage: 'refresh',
      ownerType: owner.owner_type,
      ownerId: owner.owner_id,
      error: errorMessage(error),
    })
    return { kind: 'failed', owner, error: errorMessage(error) }
  }
}

export async function regenerateSiteSocialCards(input: {
  db: DbClient
  env: SocialCardEnv
  siteId: string
  actorId?: string | null
  after?: string | null
  limit?: number
}) {
  const owners = await listSocialCardOwners(input.db, { siteId: input.siteId, after: input.after, limit: (input.limit ?? 5) + 1 })
  const results: SocialCardRefreshResult[] = []
  const batch = owners.slice(0, input.limit ?? 5)
  for (const { owner_type, owner_id } of batch) results.push(await refreshSocialCard({ ...input, owner: { owner_type, owner_id } }))
  return { results, next_cursor: owners.length > batch.length ? batch.at(-1)!.cursor : null }
}

export async function refreshSiteBrandSocialCards(input: {
  db: DbClient; env: SocialCardEnv; siteId: string; actorId?: string | null
}) {
  try {
    await executeBatch(input.db, [{
      query: "UPDATE media_placements SET status = 'pending', updated_at = ? WHERE site_id = ? AND slot = 'social_card'",
      params: [new Date().toISOString(), input.siteId],
    }])
    const owners = await listSocialCardOwners(input.db, { siteId: input.siteId })
    for (const { owner_type, owner_id } of owners) await refreshSocialCard({ ...input, owner: { owner_type, owner_id } })
  } catch (error) {
    console.error('[social-card]', { stage: 'brand_refresh', siteId: input.siteId, error: errorMessage(error) })
  }
}
