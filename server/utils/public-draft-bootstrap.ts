import { HTTPError } from 'nitro';

import type { H3Event } from 'nitro'
import { cloudflareEnv } from '~/server/utils/api-response'
import { queryFirst } from '~/server/db'
import { getDraftMedia, onboardingPageBlocks, onboardingPagePath, onboardingPageType, parseOnboardingDraftPayload, type OnboardingDraftPayload } from '~/server/utils/onboarding-drafts'
import { verifyScopedPreviewToken } from '~/server/utils/preview-token'
import { groupContentBlocks, tenantPageToContentRows } from '~/server/utils/public-draft-content'
import type { PublicTenantPage } from '~/server/utils/public-tenant-pages'
import { platformLocale } from '~/shared/platform-locales'
import { isPublicPagePayload } from '~/utils/public-resource-contracts'
import type { BlawbyRouteRecipe, PublicBlawbyRouteData, PublicBlawbyShellData } from '~/types/blawby'
import { NON_INDEXABLE_ROBOTS_INTENT } from '~/shared/robots-directive'

async function loadDraftPreviewSource(
  event: H3Event,
  draftIdInput: string,
  token: string | undefined,
  options: { signal?: AbortSignal } = {},
) {
  options.signal?.throwIfAborted()
  const draftId = String(draftIdInput || '').trim()
  if (!draftId) throw new HTTPError({ statusCode: 400, statusMessage: 'draftId required' })

  const env = cloudflareEnv(event)
  const db = env.DB
  if (!db) throw new HTTPError({ statusCode: 503, statusMessage: 'Database unavailable' })

  const rawToken = typeof token === 'string' ? token : null
  if (!rawToken || !env.PREVIEW_SECRET) {
    throw new HTTPError({ statusCode: 401, statusMessage: 'Preview token required' })
  }

  const isPreviewAuthorized = await verifyScopedPreviewToken(String(env.PREVIEW_SECRET), 'draft', draftId, rawToken)
  options.signal?.throwIfAborted()
  if (!isPreviewAuthorized) throw new HTTPError({ statusCode: 403, statusMessage: 'Preview token invalid' })

  const row = await queryFirst<{ payload_json: string }>(db, `
    SELECT payload_json
    FROM onboarding_drafts
    WHERE id = ? AND status = 'active'
    LIMIT 1
  `, [draftId])
  options.signal?.throwIfAborted()

  if (!row) throw new HTTPError({ statusCode: 404, statusMessage: 'Draft not found' })
  return parseOnboardingDraftPayload(row.payload_json)
}

export function buildDraftShellPayload(payload: Awaited<ReturnType<typeof loadDraftPreviewSource>>) {
  const logo = getDraftMedia(payload, 'logo')
  const rawConfig = {
    ...payload.preview.config,
    brand_name: payload.preview.brandName,
  }
  const config: Record<string, string> = Object.fromEntries(
    Object.entries(rawConfig).map(([key, value]) => [key, value == null ? '' : String(value)]),
  )
  // The owner's currency answer; commit writes this same value to sites.default_currency.
  // Absent until chosen, so currency-bound surfaces report it missing instead of inventing one.
  if (payload.source.details.currency) config.default_currency = payload.source.details.currency
  const draftPhone = typeof payload.preview.config.phone === 'string'
    ? payload.preview.config.phone
    : null

  return {
    platformMessages: null,
    site: {
      brand_name: payload.preview.brandName,
      brand_description: null,
      media: logo ? [{ asset_id: logo.draftAssetId, slot: 'logo', public_url: logo.publicUrl, thumbnail_url: logo.thumbnailUrl, kind: 'image' }] : [],
      // Drafts have no generated social card yet; the site shell reports null in the same case.
      social_image: null,
      vertical: payload.preview.vertical,
      config: { phone: draftPhone },
    },
    locations: payload.preview.locations.map(location => ({ ...location, media: [] })),
    config,
    googleBusiness: {
      business: null,
      reviews: [],
      media: [],
      social_image: null,
      posts: [],
      syncedAt: null,
    },
    locales: payload.preview.locales,
    hasExperiences: payload.preview.hasExperiences,
    hasProducts: payload.preview.products.length > 0,
  }
}

export function buildPublicDraftBlawbyDocument(
  payload: OnboardingDraftPayload,
  recipe: BlawbyRouteRecipe,
): { success: true; shell: PublicBlawbyShellData; route: PublicBlawbyRouteData } {
  if (recipe !== 'home') {
    throw new HTTPError({ statusCode: 404, statusMessage: 'Draft preview route not found' })
  }

  const heroContent = payload.preview.content.find(item => item.page === 'home' && item.field === 'hero') ?? null
  const heroTitle = heroContent?.hero_title?.trim() || payload.preview.brandName
  const heroDescription = heroContent?.hero_subtitle?.trim() || null
  const heroMedia = getDraftMedia(payload, 'hero')
  const logoMedia = getDraftMedia(payload, 'logo')
  const heroUrl = heroMedia?.publicUrl ?? null
  const logoUrl = logoMedia?.publicUrl ?? null
  const brandColor = payload.preview.config.brand_color?.trim() || null

  return {
    success: true,
    shell: {
      identity: {
        brand_name: payload.preview.brandName,
        brand_description: heroDescription,
        media: logoUrl ? [{ asset_id: logoMedia!.draftAssetId, slot: 'logo', public_url: logoUrl, thumbnail_url: logoMedia!.thumbnailUrl, kind: 'image' }] : [],
        social_image: null,
        phone: payload.source.details.phone ?? null,
        banner_content: null,
        banner_dismissible: false,
      },

      consultation: {
        mode: 'native_disabled',
        cta_label: '',
        external_url: null,
        schedule_path: '/schedule',
        confirmation_path: '/contact/confirmed',
        tracking_enabled: false,
        contact_form_enabled: false,
        metadata: {},
      },
      compliance: null,
      themeTokens: brandColor ? { primary: brandColor } : {},
      offeringLinks: [],
      pageLinks: [],
    },
    route: {
      recipe: 'home',
      localeRepresentations: [],
      page: {
        id: 'draft-home',
        page_id: 'draft-home',
        path: '/',
        sort_order: 0,
        title: payload.preview.brandName,
        page_type: 'recipe',
        recipe: 'home',
        locale: payload.preview.locales.find(locale => locale.is_source)?.code || 'en',
        summary: heroDescription,
        seo_title: heroTitle,
        seo_description: heroDescription,
        canonical_url: null,
        robots: NON_INDEXABLE_ROBOTS_INTENT,
        media: [],
        social_image: null,
        blocks: [{
          id: 'draft-home-hero',
          type: 'hero',
          position: 0,
          data: {
            section: 'hero',
            title: heroTitle,
            accent: '',
            description: heroDescription,
            cta_label: '',
            cta_url: '',
          },
          media: heroUrl
            ? [{
                asset_id: heroMedia!.draftAssetId,
                slot: 'media',
                public_url: heroUrl,
                thumbnail_url: heroMedia?.thumbnailUrl ?? null,
                kind: 'image',
              }]
            : [],
        }],
        updated_at: heroContent?.updated_at || '',
      },
      offerings: [],
      offering: null,
      qa: [],
      reviews: [],
      posts: [],
      post: null,
    },
  }
}

export async function loadPublicDraftBlawbyDocument(
  event: H3Event,
  draftId: string,
  token: string | undefined,
  recipe: BlawbyRouteRecipe,
) {
  const payload = await loadDraftPreviewSource(event, draftId, token)
  return buildPublicDraftBlawbyDocument(payload, recipe)
}

// The draft preview page is the tenant page commit.post.ts will persist, built
// from the same draft content rows through the same block mapping.
function buildDraftTenantPage(
  payload: OnboardingDraftPayload,
  page: string,
  routePath: string,
): PublicTenantPage | null {
  const rows = payload.preview.content.filter(item => item.page === page)
  if (!rows.length) return null
  const sourceLocale = payload.preview.locales.find(locale => locale.is_source)
  if (!sourceLocale) throw new HTTPError({ statusCode: 500, statusMessage: 'Draft source locale is missing' })
  const localeCatalog = platformLocale(sourceLocale.code)
  if (!localeCatalog) throw new HTTPError({ statusCode: 500, statusMessage: 'Draft source locale catalog is unavailable' })

  const blocks = onboardingPageBlocks(rows)
  const heroMedia = page === 'home' ? getDraftMedia(payload, 'hero') : null
  const heroBlock = heroMedia ? blocks.find(block => block.type === 'hero') : null
  if (heroMedia && heroBlock) {
    heroBlock.media = [{
      asset_id: heroMedia.draftAssetId,
      slot: 'media',
      public_url: heroMedia.publicUrl,
      thumbnail_url: heroMedia.thumbnailUrl,
      kind: 'image',
    }]
  }
  const hero = rows.find(row => row.field === 'hero') ?? null
  const path = onboardingPagePath(page)
  const updatedAt = rows.map(row => row.updated_at).sort().at(-1) ?? ''
  return {
    id: `draft-${page}`,
    page_id: `draft-${page}`,
    path,
    title: hero?.hero_title ?? page,
    summary: hero?.hero_subtitle ?? null,
    seo_title: null,
    seo_description: null,
    canonical_url: null,
    robots: NON_INDEXABLE_ROBOTS_INTENT,
    page_type: onboardingPageType(page),
    recipe: page,
    sort_order: 0,
    locale: sourceLocale.code,
    blocks,
    media: [],
    social_image: null,
    localeRepresentations: [{
      locale: sourceLocale.code,
      label: localeCatalog.label,
      route_path: routePath,
      source: 'source',
    }],
    updated_at: updatedAt,
  }
}

export async function loadPublicDraftPage(
  event: H3Event,
  draftId: string,
  query: Record<string, string | undefined>,
  options: { signal?: AbortSignal } = {},
) {
  const payload = await loadDraftPreviewSource(event, draftId, query.token, options)
  options.signal?.throwIfAborted()
  const page = typeof query.page === 'string' ? query.page : 'home'
  const supportedPages = new Set([
    'home', 'locations', 'location', 'about', 'contact', 'reservations',
    'order', 'qa', 'reviews', 'posts', 'experiences', 'photos', 'menu', 'products', 'blog',
  ])
  if (!supportedPages.has(page)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Unsupported draft preview page' })
  }
  const locationSlug = typeof query.location === 'string' ? query.location : null
  const experienceSlug = typeof query.experience === 'string' ? query.experience : null
  const requestedDatasets = new Set(
    typeof query.datasets === 'string' && query.datasets
      ? query.datasets.split(',')
      : [],
  )
  const includeProducts = requestedDatasets.has('products')
  const supportedDatasets = new Set([
    'content', 'location', 'products', 'reviews', 'photos', 'qa', 'posts',
    'blog', 'blogPost', 'experiences', 'experienceDetail',
    'reservationPolicies', 'experiencePolicies',
  ])
  if ([...requestedDatasets].some(dataset => !supportedDatasets.has(dataset))) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Unsupported draft preview dataset' })
  }
  if (page === 'experiences' || experienceSlug) {
    throw new HTTPError({ statusCode: 422, statusMessage: 'Draft preview does not contain experience records' })
  }
  // A draft has no blog yet, so the blog datasets the home page requests
  // alongside posts/reviews resolve to the same empty lists a new site returns.
  // Only a request for the blog page itself, or for one post, is unanswerable.
  if (page === 'blog' || requestedDatasets.has('blogPost')) {
    throw new HTTPError({ statusCode: 422, statusMessage: 'Draft preview does not contain blog records' })
  }

  const resolvedLocation = locationSlug
    ? payload.preview.locations.find(location => location.slug === locationSlug) ?? null
    : null
  if (locationSlug && !resolvedLocation) {
    throw new HTTPError({ statusCode: 404, statusMessage: 'Draft location not found' })
  }

  const shell = buildDraftShellPayload(payload)

  const routePath = resolvedLocation
    ? `/locations/${resolvedLocation.slug}${page !== 'location' ? `/${page}` : ''}`
    : onboardingPagePath(page)
  const tenantPage = requestedDatasets.has('content') ? buildDraftTenantPage(payload, page, routePath) : null
  const content = tenantPage ? tenantPageToContentRows(tenantPage) : []
  const sourceLocale = payload.preview.locales.find(locale => locale.is_source)
  if (!sourceLocale) throw new HTTPError({ statusCode: 500, statusMessage: 'Draft source locale is missing' })
  const localeCatalog = platformLocale(sourceLocale.code)
  if (!localeCatalog) throw new HTTPError({ statusCode: 500, statusMessage: 'Draft source locale catalog is unavailable' })
  const localeRepresentations = tenantPage
    ? tenantPage.localeRepresentations
    : [{ locale: sourceLocale.code, label: localeCatalog.label, route_path: routePath, source: 'source' as const }]
  const reviewsList = requestedDatasets.has('reviews') ? payload.preview.reviews : []
  const heroMedia = getDraftMedia(payload, 'hero')
  const media = requestedDatasets.has('photos') && heroMedia
    ? [{ asset_id: heroMedia.draftAssetId, public_url: heroMedia.publicUrl, thumbnail_url: heroMedia.thumbnailUrl, kind: 'image', alt_text: null, category: 'OTHER', sort_order: 0 }]
    : []
  const qaList = requestedDatasets.has('qa') ? payload.preview.qa : []
  const postsList = requestedDatasets.has('posts') ? payload.preview.posts : []

  const ratings = payload.preview.reviews.map(review => review.rating).filter((value) => Number.isFinite(value))
  const reviewsAggregate = ratings.length
    ? {
        average_rating: ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length,
        review_count: ratings.length,
      }
    : null

  const pagePayload = {
    kind: page,
    shell,
    site: {
      brand_name: payload.preview.brandName,
      media: shell.site.media,
      vertical: payload.preview.vertical,
    },
    locations: payload.preview.locations,
    content,
    content_blocks: groupContentBlocks(content),
    tenant_page: tenantPage,
    localeRepresentations,
    products: includeProducts
      ? payload.preview.products.filter(product => !resolvedLocation || product.location_id === resolvedLocation.id)
      : [],
    locationReviews: payload.preview.reviews.slice(0, 3),
    globalReviews: page === 'home' || page === 'reviews' ? payload.preview.reviews : [],
    reviewsAggregate,
    reviewsList,
    media,
    qaList,
    postsList,
    globalPosts: page === 'home' || page === 'posts' ? payload.preview.posts : [],
    blogList: [],
    blogPost: null,
    reservationPolicyByLocation: Object.fromEntries(
      payload.preview.locations.map(location => [String(location.id), null]),
    ),
    experiencePolicySiteDefault: null,
    experiencePolicyById: {},
    experiencesList: [],
    experienceDetail: null,
    location: resolvedLocation,
  }
  if (!isPublicPagePayload(pagePayload, page)) {
    throw new HTTPError({ statusCode: 500, statusMessage: 'Draft page payload violates the public page contract' })
  }
  return pagePayload
}

export async function loadPublicDraftShell(
  event: H3Event,
  draftId: string,
  query: { token?: string },
  options: { signal?: AbortSignal } = {},
) {
  const payload = await loadDraftPreviewSource(event, draftId, query.token, options)
  return buildDraftShellPayload(payload)
}
