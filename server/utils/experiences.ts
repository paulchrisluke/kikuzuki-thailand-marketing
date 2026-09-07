import { bookingPayloadForGuest, requestInsertQueries } from '~/server/domain/requests'
import { parseRecurringSlots, type RecurringSlots, type Weekday } from '~/shared/reservation-hours'
import { resourceLocalizationDeletionQueries } from '~/server/utils/localization'
import { HTTPError } from 'nitro';
import type { CloudflareEnv } from '~/server/utils/auth'


import { executeBatch, queryAll, queryFirst, type BatchQuery, type DbClient } from '~/server/db'
import { fireOrganizationEventSafe } from '~/server/utils/organization-events'

import type { Price, PriceInput } from '~/shared/prices'
import { PRICE_TAX_BEHAVIORS, PRICE_UNITS } from '~/shared/prices'
import { isCurrencyCode } from '~/shared/currencies'
import {
  insertInitialMediaPlacements,
  hydrateMediaAssetRefs,
  type MediaAssetRefInput,
  type ResolvedMediaAsset,
} from '~/server/utils/media-asset-manager'
import { ensureExperienceCategory } from '~/server/utils/product-management'
import { refreshSocialCard } from '~/server/utils/social-card'
import { loadPublicSocialMedia } from '~/server/utils/public-social-image'
import type { SocialImageSource } from '~/utils/social-metadata'
import type { ProductDetail } from '~/server/types/products'
import { validateProductDetails, validateProductTags } from '~/server/utils/product-validation'
import {
  readAvailability,
  executeAvailabilityClaim,
} from '~/server/utils/availability'

export type WeekdayName = Weekday
export type { RecurringSlots } from '~/shared/reservation-hours'
const MAX_TOTAL_SLOTS = 100
const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export interface Experience {
  id: string
  organization_id: string
  site_id: string
  location_id: string
  title: string
  slug: string
  tagline: string | null
  body: string | null
  media: ResolvedMediaAsset[]
  social_image: SocialImageSource | null
  price: Price | null
  scheduled_prices?: Price[]
  pricing_note: string | null
  duration_minutes: number | null
  max_capacity: number | null
  recurring_slots: RecurringSlots | null
  tags: string[]
  details: ProductDetail[]
  included_items: string[]
  what_to_bring: string[]
  meeting_point: string | null
  cancellation_policy: string | null
  status: 'active' | 'inactive' | 'sold_out'
  sort_order: number
  featured: boolean
  featured_sort_order: number
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  robots: string | null
  created_at: string
  updated_at: string
  // Only present once attachAvailabilitySummaries has run (public list/detail/bootstrap
  // responses) — absent on raw rows from create/update/CMS/MCP paths.
  availability_state?: AvailabilityState
  next_available_date?: string | null
  next_available_time?: string | null
}

export const EXPERIENCE_STATUSES = ['active', 'inactive', 'sold_out'] as const
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number]

interface ExperienceRow {
  id: string
  organization_id: string
  site_id: string
  location_id: string
  title: string
  slug: string
  tagline: string | null
  body: string | null
  pricing_note: string | null
  price_id: string | null
  amount_minor: number | null
  currency: string | null
  price_unit: string | null
  tax_behavior: string | null
  compare_at_amount_minor: number | null
  valid_from: string | null
  valid_until: string | null
  provenance: string | null
  price_created_by: string | null
  price_created_at: string | null
  duration_minutes: number | null
  max_capacity: number | null
  recurring_slots: string | null
  tags_json: string
  details_json: string
  included_items: string | null
  what_to_bring: string | null
  meeting_point: string | null
  cancellation_policy: string | null
  status: string
  sort_order: number
  featured: number
  featured_sort_order: number
  seo_title: string | null
  seo_description: string | null
  canonical_url: string | null
  robots: string | null
  created_at: string
  updated_at: string
}

function parseRow(row: ExperienceRow): Experience {
  const parseStringArray = (value: string | null): string[] => {
    if (!value) return []
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed) || !parsed.every((item): item is string => typeof item === 'string')) {
      throw new Error('Stored experience list field is not a string array')
    }
    return parsed.map(item => item.trim())
  }

  const recurring_slots = parseRecurringSlots(row.recurring_slots ? JSON.parse(row.recurring_slots) : null)
  const {
    price_id, amount_minor, currency, price_unit, tax_behavior,
    compare_at_amount_minor, valid_from, valid_until, provenance,
    price_created_by, price_created_at, ...experience
  } = row
  return {
    ...experience,
    price: price_id ? {
      id: price_id, organization_id: row.organization_id, site_id: row.site_id,
      location_id: row.location_id, product_id: row.id, amount_minor: amount_minor!,
      currency: currency as Price['currency'], unit: price_unit as Price['unit'],
      tax_behavior: tax_behavior as Price['tax_behavior'], compare_at_amount_minor,
      valid_from: valid_from!, valid_until, provenance: provenance!,
      created_by: price_created_by!, created_at: price_created_at!,
    } : null,
    status: row.status as Experience['status'],
    tags: validateProductTags(JSON.parse(row.tags_json)),
    details: validateProductDetails(JSON.parse(row.details_json)),
    included_items: parseStringArray(row.included_items),
    what_to_bring: parseStringArray(row.what_to_bring),
    meeting_point: row.meeting_point ?? null,
    recurring_slots,
    media: [],
    social_image: null,
    featured: Boolean(row.featured)
  }
}

export async function attachExperienceMedia<T extends Experience>(db: DbClient, siteId: string, experiences: T[]): Promise<T[]> {
  const mediaByExperience = await loadPublicSocialMedia(db, siteId, 'product', experiences.map(experience => experience.id))
  return experiences.map(experience => ({
    ...experience,
    media: mediaByExperience.get(experience.id)?.media ?? [],
    social_image: mediaByExperience.get(experience.id)?.social_image ?? null,
  }))
}

const SELECT = `
  SELECT p.id, p.organization_id, p.site_id, p.location_id,
         p.name AS title, p.slug, json_extract(p.experience_json, '$.tagline') AS tagline, p.description AS body, json_extract(p.experience_json, '$.pricing_note') AS pricing_note,
         pr.id AS price_id, pr.amount_minor, pr.currency, pr.unit AS price_unit,
         pr.tax_behavior, pr.compare_at_amount_minor, pr.valid_from, pr.valid_until,
         pr.provenance, pr.created_by AS price_created_by, pr.created_at AS price_created_at,
         json_extract(p.experience_json, '$.duration_minutes') AS duration_minutes, json_extract(p.experience_json, '$.max_capacity') AS max_capacity, json_extract(p.experience_json, '$.recurring_slots') AS recurring_slots,
         p.tags_json, p.details_json, json_extract(p.experience_json, '$.included_items') AS included_items, json_extract(p.experience_json, '$.what_to_bring') AS what_to_bring, json_extract(p.experience_json, '$.meeting_point') AS meeting_point,
    json_extract(p.experience_json, '$.cancellation_policy') AS cancellation_policy,
         CASE WHEN p.is_visible = 0 THEN 'inactive' WHEN p.available = 0 THEN 'sold_out' ELSE 'active' END AS status,
         p.sort_order, p.featured, p.featured_sort_order,
         p.seo_title, p.seo_description, p.canonical_url, p.robots, p.created_at, p.updated_at
  FROM products p
  LEFT JOIN prices pr ON pr.product_id = p.id AND pr.organization_id = p.organization_id
    AND pr.site_id = p.site_id AND pr.valid_from <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    AND (pr.valid_until IS NULL OR pr.valid_until > strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
`

export async function listExperiences(
  db: DbClient,
  siteId: string,
  opts: { activeOnly?: boolean; locationId?: string } = {},
): Promise<Experience[]> {
  let sql = SELECT + ` WHERE p.product_type = 'experience' AND p.site_id = ?`
  const params: (string | number)[] = [siteId]

  if (opts.activeOnly) {
    // "active-only" means publicly visible, not "bookable" — sold_out experiences
    // stay visible with sold-out messaging; inactive experiences are hidden.
    sql += ` AND p.is_visible = 1`
  }
  if (opts.locationId) {
    sql += ` AND p.location_id = ?`
    params.push(opts.locationId)
  }
  sql += ` ORDER BY p.sort_order ASC, p.created_at ASC`

  const results = await queryAll<ExperienceRow>(db, sql, params)
  return attachExperienceMedia(db, siteId, (results ?? []).map(parseRow))
}

export async function getExperienceBySlug(
  db: DbClient,
  siteId: string,
  slug: string,
): Promise<Experience | null> {
  const row = await queryFirst<ExperienceRow>(db, SELECT + ` WHERE p.product_type = 'experience' AND p.site_id = ? AND p.slug = ? LIMIT 1`, [siteId, slug])
  if (!row) return null
  const [experience] = await attachExperienceMedia(db, siteId, [parseRow(row)])
  return experience ?? null
}

export async function getExperienceById(
  db: DbClient,
  siteId: string,
  idOrSlug: string,
): Promise<Experience | null> {
  // Check id first so a slug that happens to collide with another row's id can
  // never shadow the row actually addressed by that id.
  const byId = await queryFirst<ExperienceRow>(db, SELECT + ` WHERE p.product_type = 'experience' AND p.site_id = ? AND p.id = ? LIMIT 1`, [siteId, idOrSlug])
  if (byId) {
    const [experience] = await attachExperienceMedia(db, siteId, [parseRow(byId)])
    return experience ? attachScheduledPrices(db, experience) : null
  }
  const bySlug = await queryFirst<ExperienceRow>(db, SELECT + ` WHERE p.product_type = 'experience' AND p.site_id = ? AND p.slug = ? LIMIT 1`, [siteId, idOrSlug])
  if (!bySlug) return null
  const [experience] = await attachExperienceMedia(db, siteId, [parseRow(bySlug)])
  return experience ? attachScheduledPrices(db, experience) : null
}

async function attachScheduledPrices(db: DbClient, experience: Experience): Promise<Experience> {
  const rows = await queryAll<Record<string, unknown>>(db, `
    SELECT id, organization_id, site_id, location_id, product_id, amount_minor, currency,
           unit, tax_behavior, compare_at_amount_minor, valid_from, valid_until,
           provenance, created_by, created_at
      FROM prices WHERE product_id = ? AND valid_from > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     ORDER BY valid_from, id
  `, [experience.id])
  return {
    ...experience,
    scheduled_prices: rows.map(row => ({
      id: String(row.id), organization_id: String(row.organization_id), site_id: String(row.site_id),
      location_id: String(row.location_id), product_id: String(row.product_id), amount_minor: Number(row.amount_minor),
      currency: String(row.currency) as Price['currency'], unit: String(row.unit) as Price['unit'],
      tax_behavior: String(row.tax_behavior) as Price['tax_behavior'],
      compare_at_amount_minor: row.compare_at_amount_minor == null ? null : Number(row.compare_at_amount_minor),
      valid_from: String(row.valid_from), valid_until: row.valid_until == null ? null : String(row.valid_until),
      provenance: String(row.provenance), created_by: String(row.created_by), created_at: String(row.created_at),
    })),
  }
}

// Used by callers (update/delete/bookings) that need the canonical row id before
// running their own queries against other tables — getExperienceById/BySlug above
// already accept either form directly for reads of the experience itself.
async function resolveExperienceId(db: DbClient, siteId: string, idOrSlug: string): Promise<string | null> {
  const byId = await queryFirst<{ id: string }>(db, `SELECT id FROM products WHERE product_type = 'experience' AND site_id = ? AND id = ? LIMIT 1`, [siteId, idOrSlug])
  if (byId) return byId.id
  const bySlug = await queryFirst<{ id: string }>(db, `SELECT p.id FROM products p WHERE p.product_type = 'experience' AND p.site_id = ? AND p.slug = ? LIMIT 1`, [siteId, idOrSlug])
  return bySlug?.id ?? null
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    || `experience-${Date.now()}`
}

export async function uniqueSlug(db: DbClient, siteId: string, base: string, excludeId?: string): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`
    const existing = await queryFirst<{ id: string }>(db, `SELECT id FROM products WHERE site_id = ? AND slug = ? LIMIT 1`, [siteId, candidate])
    if (!existing || existing.id === excludeId) return candidate
  }
  return `${base}-${Date.now()}`
}

export interface CreateExperienceInput {
  title: string
  tagline?: string | null
  body?: string | null
  media?: MediaAssetRefInput[] | null
  price?: PriceInput | null
  pricing_note?: string | null
  duration_minutes?: number | null
  max_capacity?: number | null
  recurring_slots?: RecurringSlots | null
  tags?: string[] | null
  details?: ProductDetail[] | null
  included_items?: string[] | null
  what_to_bring?: string[] | null
  meeting_point?: string | null
  status?: ExperienceStatus
  sort_order?: number
  featured?: boolean
  featured_sort_order?: number
  location_id: string
  seo_title?: string | null
  seo_description?: string | null
  canonical_url?: string | null
  robots?: string | null
}

function assertExperienceStatus(value: unknown, fieldName: string): ExperienceStatus {
  if (typeof value !== 'string' || !EXPERIENCE_STATUSES.includes(value as ExperienceStatus)) {
    throw new HTTPError({
      statusCode: 400,
      statusMessage: `${fieldName} must be one of: ${EXPERIENCE_STATUSES.join(', ')}`,
    })
  }
  return value as ExperienceStatus
}

function assertFiniteNonNegative(value: number | null | undefined, field: string): void {
  if (value == null) return
  if (!Number.isFinite(value) || value < 0) {
    throw new HTTPError({ statusCode: 400, statusMessage: `${field} must be a finite non-negative number` })
  }
}

async function normalizeExperiencePrice(
  db: DbClient,
  organizationId: string,
  siteId: string,
  input: PriceInput,
) {
  if (!Number.isSafeInteger(input.amount_minor) || input.amount_minor < 0) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'price.amount_minor must be a non-negative integer' })
  }
  const site = await queryFirst<{ default_currency: string }>(db, `
    SELECT default_currency FROM sites WHERE id = ? AND organization_id = ? LIMIT 1
  `, [siteId, organizationId])
  if (!site) throw new HTTPError({ statusCode: 404, statusMessage: 'Site not found' })
  const currency = input.currency ?? site.default_currency
  if (!isCurrencyCode(currency)) throw new HTTPError({ statusCode: 400, statusMessage: 'price.currency is unsupported' })
  const unit = input.unit ?? 'person'
  if (!(PRICE_UNITS as readonly string[]).includes(unit)) throw new HTTPError({ statusCode: 400, statusMessage: 'price.unit is unsupported' })
  const taxBehavior = input.tax_behavior ?? 'unspecified'
  if (!(PRICE_TAX_BEHAVIORS as readonly string[]).includes(taxBehavior)) throw new HTTPError({ statusCode: 400, statusMessage: 'price.tax_behavior is unsupported' })
  const compareAt = input.compare_at_amount_minor ?? null
  if (compareAt !== null && (!Number.isSafeInteger(compareAt) || compareAt <= input.amount_minor)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'price.compare_at_amount_minor must exceed amount_minor' })
  }
  const validFrom = input.valid_from ?? new Date().toISOString()
  if (Number.isNaN(Date.parse(validFrom))) throw new HTTPError({ statusCode: 400, statusMessage: 'price.valid_from must be an ISO instant' })
  const validUntil = input.valid_until ?? null
  if (validUntil !== null && (Number.isNaN(Date.parse(validUntil)) || validUntil <= validFrom)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'price.valid_until must be an ISO instant after valid_from' })
  }
  return { amountMinor: input.amount_minor, currency, unit, taxBehavior, compareAt, validFrom, validUntil, provenance: input.provenance ?? 'manual' }
}


export function generateSlots(startTime: string, endTime: string, intervalMinutes: number): string[] {
  if (!TIME_SLOT_PATTERN.test(startTime) || !TIME_SLOT_PATTERN.test(endTime)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'start and end times must be in "HH:MM" format' })
  }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 240) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'interval_minutes must be an integer between 5 and 240' })
  }
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number) as [number, number]
    return h * 60 + m
  }
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (end < start) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'end time must not be before start time' })
  }
  const slots: string[] = []
  for (let t = start; t <= end; t += intervalMinutes) {
    const h = Math.floor(t / 60).toString().padStart(2, '0')
    const m = (t % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    if (slots.length > MAX_TOTAL_SLOTS) {
      throw new HTTPError({ statusCode: 400, statusMessage: `interval is too small — generated more than ${MAX_TOTAL_SLOTS} slots` })
    }
  }
  return slots
}

export async function createExperience(
  db: DbClient,
  organizationId: string,
  siteId: string,
  input: CreateExperienceInput,
  userId: string,
  env: CloudflareEnv,
): Promise<Experience> {
  if (!input.location_id) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'location_id is required' })
  }
  assertFiniteNonNegative(input.duration_minutes, 'duration_minutes')
  const normalizedPrice = input.price ? await normalizeExperiencePrice(db, organizationId, siteId, input.price) : null
  if (normalizedPrice && input.pricing_note?.trim()) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'pricing_note is only valid for an inquiry-only Experience without a Price' })
  }
  const mediaRefs = input.media ?? []
  const media = input.media !== undefined
    ? await hydrateMediaAssetRefs(db, {
      organizationId,
      siteId,
      refs: mediaRefs,
      allowedKinds: ['image', 'video'],
      fieldName: 'media',
    })
    : null
  const id = crypto.randomUUID()
  const slug = await uniqueSlug(db, siteId, slugify(input.title))
  const now = new Date().toISOString()
  const validRecurringSlots = parseRecurringSlots(input.recurring_slots ?? null)
  const recurringSlotsJson = validRecurringSlots ? JSON.stringify(validRecurringSlots) : null
  const tags = validateProductTags(input.tags ?? [])
  const details = validateProductDetails(input.details ?? [])
  const includedItemsJson = input.included_items?.length ? JSON.stringify(input.included_items) : null
  const whatToBringJson = input.what_to_bring?.length ? JSON.stringify(input.what_to_bring) : null
  const status = input.status !== undefined ? assertExperienceStatus(input.status, 'status') : 'active'
  const experienceCategoryId = await ensureExperienceCategory(db, organizationId, siteId, input.location_id, userId)

  const queries: BatchQuery[] = [
    {
      query: `INSERT INTO products
       (id, organization_id, site_id, location_id, product_type, category_id, name, slug,
        description, order_url, is_visible, available, featured, featured_sort_order,
        sort_order, tags_json, details_json, experience_json, seo_title, seo_description, canonical_url,
        robots, source, created_at, updated_at, created_by, updated_by)
        VALUES (?,?,?,?, 'experience', ?, ?,?,?, NULL,?,?,?,?,?,?,?,?,?,?,?,?, 'manual',?,?,?,?)`,
      params: [
        id, organizationId, siteId, input.location_id, experienceCategoryId, input.title, slug, input.body ?? '',
        status === 'inactive' ? 0 : 1, status === 'sold_out' ? 0 : 1,
        input.featured ? 1 : 0, input.featured_sort_order ?? 0, input.sort_order ?? 0,
        JSON.stringify(tags), JSON.stringify(details),
        JSON.stringify({ tagline: input.tagline ?? null, pricing_note: normalizedPrice ? null : input.pricing_note?.trim() || null, duration_minutes: input.duration_minutes ?? null, max_capacity: input.max_capacity ?? null, recurring_slots: recurringSlotsJson ? JSON.parse(recurringSlotsJson) : null, included_items: includedItemsJson ? JSON.parse(includedItemsJson) : null, what_to_bring: whatToBringJson ? JSON.parse(whatToBringJson) : null, meeting_point: input.meeting_point ?? null, cancellation_policy: null, created_at: now, updated_at: now }),
        input.seo_title ?? null, input.seo_description ?? null, input.canonical_url ?? null, input.robots ?? null,
        now, now, userId, userId,
      ],
    },

  ]
  if (normalizedPrice) {
    queries.push({
      query: `INSERT INTO prices
        (id, organization_id, site_id, location_id, product_id, amount_minor, currency,
         unit, tax_behavior, compare_at_amount_minor, valid_from, valid_until, provenance, created_by, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [crypto.randomUUID(), organizationId, siteId, input.location_id, id,
        normalizedPrice.amountMinor, normalizedPrice.currency, normalizedPrice.unit,
        normalizedPrice.taxBehavior, normalizedPrice.compareAt, normalizedPrice.validFrom, normalizedPrice.validUntil,
        normalizedPrice.provenance, userId, now],
    })
  }
  if (media) {
    queries.push(...insertInitialMediaPlacements({
      organizationId,
      siteId,
      placement: { owner_type: 'product', owner_id: id, slot: 'gallery' },
      media,
      now,
    }))
  }

  const [result] = await executeBatch(db, queries)

  if (!result || !result.success) {
    throw new Error('Failed to create experience in the database.')
  }

  const created = await getExperienceById(db, siteId, id)
  if (!created) {
    throw new Error(`Failed to retrieve newly created experience with ID: ${id}`)
  }
  await fireOrganizationEventSafe({
    db,
    organizationId,
    siteId,
    locationId: created.location_id,
    actorId: userId,
    eventType: 'experience.created',
    entityType: 'experience',
    entityId: id,
    metadata: {
      title: created.title,
      status: created.status,
    },
  })
  await refreshSocialCard({ db, env, owner: { owner_type: 'product', owner_id: id }, actorId: userId })
  return created
}

export type UpdateExperienceInput = Omit<Partial<CreateExperienceInput>, 'media'> & { slug?: string }
export async function updateExperience(
  db: DbClient,
  siteId: string,
  idOrSlug: string,
  input: UpdateExperienceInput,
  env: CloudflareEnv,
): Promise<Experience | null> {
  const id = (await resolveExperienceId(db, siteId, idOrSlug)) ?? idOrSlug
  assertFiniteNonNegative(input.duration_minutes, 'duration_minutes')
  const owner = await queryFirst<{ organization_id: string; location_id: string; updated_by: string }>(db, `
    SELECT p.organization_id, p.location_id, p.updated_by
      FROM products p
     WHERE p.product_type = 'experience' AND p.site_id = ? AND p.id = ? LIMIT 1
  `, [siteId, id])
  if (!owner) return null
  const activePrice = await queryFirst<{ id: string }>(db, `
    SELECT id FROM prices WHERE product_id = ? AND valid_from <= ? AND (valid_until IS NULL OR valid_until > ?) LIMIT 1
  `, [id, new Date().toISOString(), new Date().toISOString()])
  if (input.price && input.pricing_note?.trim()) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'pricing_note is only valid for an inquiry-only Experience without a Price' })
  }
  if (input.price === undefined && activePrice && input.pricing_note?.trim()) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Close the active Price before adding an inquiry pricing_note' })
  }
  const productSets: string[] = []
  const productParams: (string | number | null)[] = []
  const experienceSets: string[] = []
  const experienceParams: (string | number | null)[] = []

  if (input.title !== undefined) {
    productSets.push('name = ?')
    productParams.push(input.title)
    if (!input.slug) {
      const newSlug = await uniqueSlug(db, siteId, slugify(input.title), id)
      productSets.push('slug = ?')
      productParams.push(newSlug)
    }
  }
  if (input.slug !== undefined) { productSets.push('slug = ?'); productParams.push(input.slug) }
  if (input.tagline !== undefined) { experienceSets.push('tagline = ?'); experienceParams.push(input.tagline ?? null) }
  if (input.body !== undefined) { productSets.push('description = ?'); productParams.push(input.body ?? '') }
  if (input.price) { experienceSets.push('pricing_note = ?'); experienceParams.push(null) }
  else if (input.pricing_note !== undefined) { experienceSets.push('pricing_note = ?'); experienceParams.push(input.pricing_note?.trim() || null) }
  if (input.duration_minutes !== undefined) { experienceSets.push('duration_minutes = ?'); experienceParams.push(input.duration_minutes ?? null) }
  if (input.max_capacity !== undefined) { experienceSets.push('max_capacity = ?'); experienceParams.push(input.max_capacity ?? null) }

  if (input.recurring_slots !== undefined) {
    const validRecurringSlots = parseRecurringSlots(input.recurring_slots ?? null)
    experienceSets.push('recurring_slots = ?')
    experienceParams.push(validRecurringSlots ? JSON.stringify(validRecurringSlots) : null)
  }
  if (input.tags !== undefined) { productSets.push('tags_json = ?'); productParams.push(JSON.stringify(validateProductTags(input.tags ?? []))) }
  if (input.details !== undefined) { productSets.push('details_json = ?'); productParams.push(JSON.stringify(validateProductDetails(input.details ?? []))) }
  if (input.included_items !== undefined) { experienceSets.push('included_items = ?'); experienceParams.push(input.included_items?.length ? JSON.stringify(input.included_items) : null) }
  if (input.what_to_bring !== undefined) { experienceSets.push('what_to_bring = ?'); experienceParams.push(input.what_to_bring?.length ? JSON.stringify(input.what_to_bring) : null) }
  if (input.meeting_point !== undefined) { experienceSets.push('meeting_point = ?'); experienceParams.push(input.meeting_point ?? null) }
  if (input.status !== undefined) {
    const status = assertExperienceStatus(input.status, 'status')
    productSets.push('is_visible = ?', 'available = ?')
    productParams.push(status === 'inactive' ? 0 : 1, status === 'sold_out' ? 0 : 1)
  }
  if (input.sort_order !== undefined) { productSets.push('sort_order = ?'); productParams.push(input.sort_order) }
  if (input.featured !== undefined) { productSets.push('featured = ?'); productParams.push(input.featured ? 1 : 0) }
  if (input.featured_sort_order !== undefined) { productSets.push('featured_sort_order = ?'); productParams.push(input.featured_sort_order) }
  if (input.location_id !== undefined) {
    if (!input.location_id) throw new HTTPError({ statusCode: 400, statusMessage: 'location_id cannot be cleared' })
    if (input.location_id !== owner.location_id) throw new HTTPError({ statusCode: 400, statusMessage: 'Experience location cannot be changed' })
  }
  if (input.seo_title !== undefined) { productSets.push('seo_title = ?'); productParams.push(input.seo_title ?? null) }
  if (input.seo_description !== undefined) { productSets.push('seo_description = ?'); productParams.push(input.seo_description ?? null) }
  if (input.canonical_url !== undefined) { productSets.push('canonical_url = ?'); productParams.push(input.canonical_url ?? null) }
  if (input.robots !== undefined) { productSets.push('robots = ?'); productParams.push(input.robots ?? null) }

  const now = new Date().toISOString()
  const queries: BatchQuery[] = []
  if (productSets.length) {
    productSets.push('updated_at = ?', 'updated_by = ?')
    queries.push({ query: `UPDATE products SET ${productSets.join(', ')} WHERE organization_id = ? AND site_id = ? AND id = ?`, params: [...productParams, now, owner.updated_by, owner.organization_id, siteId, id] })
  }
  if (experienceSets.length) {
    experienceSets.push('updated_at = ?')
    queries.push({ query: `UPDATE products SET experience_json = json_set(experience_json, ${experienceSets.map(set => `'$.${set.split(' = ')[0]}', ${['recurring_slots', 'included_items', 'what_to_bring'].includes(set.split(' = ')[0]!) ? 'json(?)' : '?'}`).join(', ')}), updated_at = ? WHERE organization_id = ? AND site_id = ? AND id = ? AND product_type = 'experience'`, params: [...experienceParams, now, now, owner.organization_id, siteId, id] })
  }
  if (input.price !== undefined) {
    const replacement = input.price ? await normalizeExperiencePrice(db, owner.organization_id, siteId, input.price) : null
    const boundary = replacement?.validFrom ?? now
    if (replacement) {
      const conflict = await queryFirst(db, `SELECT id FROM prices WHERE product_id = ? AND id <> COALESCE(?, '') AND valid_from < COALESCE(?, '9999-12-31T23:59:59.999Z') AND (valid_until IS NULL OR valid_until > ?) LIMIT 1`, [id, activePrice?.id ?? null, replacement.validUntil, replacement.validFrom])
      if (conflict) throw new HTTPError({ statusCode: 409, statusMessage: 'Scheduled Price overlaps an existing Price' })
    }
    queries.push({ query: `UPDATE prices SET valid_until = ? WHERE product_id = ? AND valid_from < ? AND (valid_until IS NULL OR valid_until > ?)`, params: [boundary, id, boundary, boundary] })
    if (replacement) queries.push({
      query: `INSERT INTO prices (id, organization_id, site_id, location_id, product_id, amount_minor, currency, unit, tax_behavior, compare_at_amount_minor, valid_from, valid_until, provenance, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [crypto.randomUUID(), owner.organization_id, siteId, owner.location_id, id, replacement.amountMinor, replacement.currency, replacement.unit, replacement.taxBehavior, replacement.compareAt, replacement.validFrom, replacement.validUntil, replacement.provenance, owner.updated_by, now],
    })
  }
  if (!queries.length) return getExperienceById(db, siteId, id)
  await executeBatch(db, queries)
  const updated = await getExperienceById(db, siteId, id)
  await refreshSocialCard({ db, env, owner: { owner_type: 'product', owner_id: id } })
  return updated
}

export async function deleteExperience(
  db: DbClient,
  siteId: string,
  idOrSlug: string,
  opts: { locationId?: string | null } = {},
): Promise<boolean> {
  const id = (await resolveExperienceId(db, siteId, idOrSlug)) ?? idOrSlug
  const params = [siteId, id]
  let where = `site_id = ? AND id = ?`
  if (opts.locationId) {
    where += ` AND location_id = ?`
    params.push(opts.locationId)
  }
  const results = await executeBatch(db, [
    ...resourceLocalizationDeletionQueries('product', { query: `SELECT id FROM products WHERE product_type = 'experience' AND ${where}`, params }),
    { query: `DELETE FROM media_placements WHERE owner_type = 'review' AND owner_id IN (SELECT id FROM reviews WHERE product_id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where}))`, params },
    { query: `DELETE FROM media_placements WHERE owner_type = 'product' AND owner_id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where})`, params },
    { query: `DELETE FROM reviews WHERE product_id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where})`, params },
    { query: `UPDATE review_requests SET revoked_at = ?, updated_at = ? WHERE booking_type = 'experience_booking' AND booking_id IN (SELECT id FROM requests WHERE kind = 'experience_booking' AND product_id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where})) AND revoked_at IS NULL`, params: [new Date().toISOString(), new Date().toISOString(), ...params] },
    {
      query: `DELETE FROM requests WHERE kind = 'experience_booking' AND product_id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where})`,
      params,
    },
    { query: `DELETE FROM products WHERE id IN (SELECT id FROM products WHERE product_type = 'experience' AND ${where})`, params },
  ])
  return Boolean(results.at(-1)?.meta.changes)
}


export interface ExperienceBooking {
  id: string
  experience_id: string
  organization_id: string
  site_id: string
  customer_id?: string | null
  location_id: string
  location_title?: string | null
  guest_name: string
  guest_email: string
  guest_phone: string | null
  party_size: number
  booking_date: string
  time_slot: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
  notes: string | null
  cancellation_token_hash?: string | null
  cancellation_token_expires_at?: string | null
  completed_at?: string | null
  completion_source?: 'manual' | 'auto' | null
  review_request_sent_at?: string | null
  review_reminder_sent_at?: string | null
  review_submitted_at?: string | null
  review_id?: string | null
  created_at: string
  updated_at: string
}

export async function createExperienceBookingClaimingCapacity(
  db: DbClient,
  input: Omit<ExperienceBooking, 'id' | 'created_at' | 'updated_at'> & { ip_hash?: string },
): Promise<ExperienceBooking | null> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const [snapshot] = await readAvailability(db, { siteId: input.site_id, owners: [{ kind: 'experience', experienceId: input.experience_id }], dates: [input.booking_date] })
  if (snapshot!.row.organization_id !== input.organization_id || snapshot!.row.location_id !== input.location_id) return null
  const payload = bookingPayloadForGuest({ name: input.guest_name, email: input.guest_email, phone: input.guest_phone, notes: input.notes, ipHash: input.ip_hash })
  payload.cancellation = { token_hash: input.cancellation_token_hash ?? null, expires_at: input.cancellation_token_expires_at ?? null, used_at: null }
  const [statement, ...following] = requestInsertQueries({ id, kind: 'experience_booking', organization_id: input.organization_id, site_id: input.site_id, location_id: input.location_id,
    product_id: input.experience_id, customer_id: input.customer_id ?? null, review_id: input.review_id ?? null, status: input.status, booking_date: input.booking_date, time_slot: input.time_slot, party_size: input.party_size,
    conversation_state: 'needs_attention', resolved_at: null, payload, created_at: now, updated_at: now })
  statement.query = statement.query.replace(/VALUES \(([^)]+)\)/, 'SELECT $1 WHERE /* availability_claim */')
  await executeAvailabilityClaim(db, { snapshot: snapshot!, date: input.booking_date, time: input.time_slot, partySize: input.party_size, statement, following })
  if (!await queryFirst(db, 'SELECT id FROM requests WHERE id = ?', [id])) return null

  return { ...input, id, status: (input.status ?? 'pending') as ExperienceBooking['status'], created_at: now, updated_at: now }
}

export async function listExperienceBookings(
  db: DbClient,
  siteId: string,
  experienceIdOrSlug: string,
  opts: { locationId?: string | null; bookingId?: string } = {},
): Promise<ExperienceBooking[]> {
  const experienceId = (await resolveExperienceId(db, siteId, experienceIdOrSlug)) ?? experienceIdOrSlug
  if (opts.locationId) {
    const experience = await queryFirst<{ id: string }>(
      db,
      `SELECT id FROM products WHERE product_type = 'experience' AND site_id = ? AND id = ? AND location_id = ? LIMIT 1`,
      [siteId, experienceId, opts.locationId],
    )
    if (!experience) return []
  }
  const params = [siteId, experienceId]
  let where = `eb.kind = 'experience_booking' AND eb.site_id = ? AND eb.product_id = ?`
  if (opts.locationId) {
    where += ` AND eb.location_id = ?`
    params.push(opts.locationId)
  }
  if (opts.bookingId) {
    where += ' AND eb.id = ?'
    params.push(opts.bookingId)
  }
  const results = await queryAll<ExperienceBooking>(
    db,
    `SELECT eb.id, eb.product_id AS experience_id, eb.organization_id, eb.site_id,
              eb.location_id,
              bl.title AS location_title,
              json_extract(eb.payload_json, '$.guest.name') AS guest_name, json_extract(eb.payload_json, '$.guest.email') AS guest_email,
              json_extract(eb.payload_json, '$.guest.phone') AS guest_phone, eb.party_size, eb.booking_date, eb.time_slot,
              eb.status, json_extract(eb.payload_json, '$.notes') AS notes, json_extract(eb.payload_json, '$.completion.at') AS completed_at, json_extract(eb.payload_json, '$.completion.source') AS completion_source,
              json_extract(eb.payload_json, '$.review.request_sent_at') AS review_request_sent_at, json_extract(eb.payload_json, '$.review.reminder_sent_at') AS review_reminder_sent_at,
              json_extract(eb.payload_json, '$.review.submitted_at') AS review_submitted_at, eb.review_id, eb.created_at, eb.updated_at
	       FROM requests eb
	       LEFT JOIN business_locations bl ON bl.id = eb.location_id
	       WHERE ${where}
	       ORDER BY eb.booking_date ASC, eb.time_slot ASC, eb.created_at ASC`,
    params,
  )
  return results ?? []
}

export async function listExperienceBookingsForSite(
  db: DbClient,
  siteId: string,
  opts: { locationId?: string | null; sinceDays?: number | null; limit?: number | null } = {},
): Promise<Array<ExperienceBooking & { experience_title?: string | null }>> {
  const params: (string | number)[] = [siteId]
  let where = `eb.kind = 'experience_booking' AND eb.site_id = ?`
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 500))
  if (opts.locationId) {
    where += ` AND eb.location_id = ?`
    params.push(opts.locationId)
  }
  if (opts.sinceDays) {
    where += ` AND eb.created_at >= datetime('now', ?)`
    params.push(`-${opts.sinceDays} days`)
  }
  const results = await queryAll<ExperienceBooking & { experience_title?: string | null }>(
    db,
    `SELECT eb.id, eb.product_id AS experience_id, eb.organization_id, eb.site_id,
              eb.location_id,
              bl.title AS location_title,
              p.name AS experience_title,
              json_extract(eb.payload_json, '$.guest.name') AS guest_name, json_extract(eb.payload_json, '$.guest.email') AS guest_email,
              json_extract(eb.payload_json, '$.guest.phone') AS guest_phone, eb.party_size, eb.booking_date, eb.time_slot,
              eb.status, json_extract(eb.payload_json, '$.notes') AS notes, json_extract(eb.payload_json, '$.completion.at') AS completed_at, json_extract(eb.payload_json, '$.completion.source') AS completion_source,
              json_extract(eb.payload_json, '$.review.request_sent_at') AS review_request_sent_at, json_extract(eb.payload_json, '$.review.reminder_sent_at') AS review_reminder_sent_at,
              json_extract(eb.payload_json, '$.review.submitted_at') AS review_submitted_at, eb.review_id, eb.created_at, eb.updated_at
	       FROM requests eb
	       LEFT JOIN business_locations bl ON bl.id = eb.location_id
	       LEFT JOIN products p ON p.id = eb.product_id
	       WHERE ${where}
	       ORDER BY eb.created_at DESC
	       LIMIT ?`,
    [...params, limit],
  )
  return results ?? []
}

export async function getExperienceBookingsSummary(
  db: DbClient,
  siteId: string,
  opts: { locationId?: string | null; sinceDays?: number | null } = {},
): Promise<BookingsSummary> {
  const params: (string | number)[] = [siteId]
  let where = `eb.kind = 'experience_booking' AND eb.site_id = ?`
  if (opts.locationId) {
    where += ` AND eb.location_id = ?`
    params.push(opts.locationId)
  }
  if (opts.sinceDays) {
    where += ` AND eb.created_at >= datetime('now', ?)`
    params.push(`-${opts.sinceDays} days`)
  }

  const [totalResult, statusResults, experienceResults] = await Promise.all([
    queryFirst<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM requests eb WHERE ${where}`,
      params,
    ),
    queryAll<{ status: string; count: number }>(
      db,
      `SELECT status, COUNT(*) as count FROM requests eb WHERE ${where} GROUP BY status`,
      params,
    ),
    queryAll<{ experience_id: string; experience_title: string | null; count: number }>(
      db,
      `SELECT eb.product_id AS experience_id, p.name AS experience_title, COUNT(*) as count
       FROM requests eb
       LEFT JOIN products p ON p.id = eb.product_id
       WHERE ${where}
       GROUP BY eb.product_id, p.name
       ORDER BY count DESC`,
      params,
    ),
  ])

  const byStatus: Record<string, number> = {}
  for (const row of statusResults ?? []) {
    byStatus[row.status] = row.count
  }

  return {
    total: totalResult?.count ?? 0,
    by_status: byStatus,
    by_experience: experienceResults ?? [],
  }
}

export interface BookingsSummary {
  total: number
  by_status: Record<string, number>
  by_experience: Array<{ experience_id: string; experience_title: string | null; count: number }>
}

export function summarizeExperienceBookings(
  bookings: Array<Pick<ExperienceBooking, 'experience_id' | 'status'> & { experience_title?: string | null }>,
): BookingsSummary {
  const byStatus: Record<string, number> = {}
  const byExperience = new Map<string, { experience_id: string; experience_title: string | null; count: number }>()
  for (const booking of bookings) {
    byStatus[booking.status] = (byStatus[booking.status] ?? 0) + 1
    const existing = byExperience.get(booking.experience_id)
    if (existing) existing.count += 1
    else byExperience.set(booking.experience_id, { experience_id: booking.experience_id, experience_title: booking.experience_title ?? null, count: 1 })
  }
  return {
    total: bookings.length,
    by_status: byStatus,
    by_experience: [...byExperience.values()].sort((a, b) => b.count - a.count),
  }
}

export const PUBLIC_BOOKING_WINDOW_DAYS = 31
const AVAILABILITY_SUMMARY_WINDOW_DAYS = 14
const LIMITED_REMAINING_THRESHOLD = 2

// ── Availability summary (public cards/detail) ──────────────────────────────
// Canonical status/booking-status mapping, since this schema keeps a single
// `status` column rather than splitting publication vs. booking state:
//   - 'inactive'  → never public, never bookable (excluded upstream by all list/detail queries).
//   - 'sold_out'  → public, but globally not bookable (owner-set, independent of real slot math).
//   - 'active'    → public; bookability is derived from real slots/bookings/overrides below.
export type AvailabilityState =
  | 'available'
  | 'limited'
  | 'full'
  | 'no_slots'
  | 'inquiry_only'
  | 'temporarily_unavailable'
  | 'sold_out'
  | 'inactive'

export interface AvailabilitySummary {
  availability_state: AvailabilityState
  next_available_date: string | null
  next_available_time: string | null
}

export async function attachAvailabilitySummaries<T extends Experience>(db: DbClient, siteId: string, list: T[]): Promise<Array<T & AvailabilitySummary>> {
  if (!list.length) return []
  const snapshots = await readAvailability(db, { siteId, owners: list.map(experience => ({ kind: 'experience', experienceId: experience.id })), dates: { daysFromToday: AVAILABILITY_SUMMARY_WINDOW_DAYS } })
  return list.map(experience => {
    const snapshot = snapshots.find(s => s.row.owner_id === experience.id)!
    const none = { next_available_date: null, next_available_time: null }
    if (experience.status === 'inactive') return { ...experience, availability_state: 'inactive', ...none }
    if (experience.status === 'sold_out') return { ...experience, availability_state: 'sold_out', ...none }
    if (!experience.price) return { ...experience, availability_state: 'inquiry_only', ...none }
    for (const day of snapshot.days) {
      const slot = day.slots.find(s => !s.is_closed && !s.is_full)
      if (slot) return { ...experience, availability_state: slot.remaining !== null && slot.remaining <= LIMITED_REMAINING_THRESHOLD ? 'limited' : 'available', next_available_date: day.date, next_available_time: slot.time_slot }
    }
    return { ...experience, availability_state: snapshot.days.some(d => d.slots.some(s => !s.is_closed)) ? 'full' : experience.recurring_slots === null ? 'inquiry_only' : 'no_slots', ...none }
  })
}
