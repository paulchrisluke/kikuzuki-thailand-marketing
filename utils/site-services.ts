// The professional-service offering, shared by the list and the record's own
// editor so neither restates the other's shape.

export interface ProfessionalServiceMediaRef {
  asset_id: string
  slot: string
}

/**
 * Every column the upsert writes, because there is no per-record endpoint: the
 * list is read whole and written whole, and `ON CONFLICT DO UPDATE SET ... =
 * excluded.*` writes each of these from what was sent. A field the dashboard
 * leaves out of its payload is therefore not left alone — it is emptied. The
 * screen edits five of them and carries the rest back exactly as they were
 * read.
 */
export interface ProfessionalServiceRow {
  id: string
  name: string
  slug: string
  summary: string | null
  short_description: string | null
  sort_order: number
  featured: boolean
  /**
   * Required by the upsert and never sent, which is why saving this screen has
   * always failed with "offerings.<slug>.schema_type is required."
   * `schema_type` is the offering's schema.org type (LegalService,
   * AccountingService) and has no default to reach for, so a new service asks.
   */
  schema_type: string | null
  canonical_path: string | null
  source: string | null
  /** Carried, not edited here: the importer, the MCP and the page editor own these. */
  label?: string | null
  body?: string | null
  features?: unknown[]
  faqs?: unknown[]
  cta_label?: string | null
  cta_url?: string | null
  seo_title?: string | null
  seo_description?: string | null
  location_id?: string | null
  source_ref?: string | null
  /**
   * Omitting media is not neutral either: the upsert compares what it is given
   * against what is stored per slot, and an empty list clears `thumbnail`/`hero`
   * and refuses a `gallery` outright. Sending the stored placements back
   * unchanged makes each slot compare equal and be skipped.
   */
  media?: ProfessionalServiceMediaRef[]
}

export const isProfessionalServiceRow = (value: unknown): value is ProfessionalServiceRow =>
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.slug === 'string'
  && (value.summary === null || typeof value.summary === 'string')
  && (value.short_description === null || typeof value.short_description === 'string')
  && typeof value.sort_order === 'number'
  && typeof value.featured === 'boolean'
  && (value.schema_type == null || typeof value.schema_type === 'string')
  && (value.canonical_path == null || typeof value.canonical_path === 'string')
  && (value.source == null || typeof value.source === 'string')

export const isProfessionalServicesResponse = (value: unknown): value is { offerings: ProfessionalServiceRow[] } =>
  isRecord(value) && Array.isArray(value.offerings) && value.offerings.every(isProfessionalServiceRow)

/** A slug the tenant did not choose is derived from the name, as the importer does. */
export function slugifyServiceName(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180)
}

/**
 * A new offering has to answer its name; the slug step is walked past whenever
 * a slug can be derived from that name. It can only be skipped when there is
 * something to derive: a name written in a script `slugifyServiceName` strips
 * entirely reduces to '', and every such service would then collide on the
 * same empty slug and overwrite the last one through the upsert.
 */
export function professionalServiceCreateBlockers(form: { name: string; slug: string; schema_type: string }): string[] {
  if (!form.name.trim()) return ['Name']
  const missing = form.slug.trim() || slugifyServiceName(form.name) ? [] : ['Slug']
  if (!form.schema_type.trim()) missing.push('Schema type')
  return missing
}

/** Existing offerings are all `/services/<slug>`; a new one follows them. */
export function serviceCanonicalPath(slug: string): string {
  return `/services/${slug}`
}

/**
 * The upsert accepts only these three slots, while the read returns everything
 * placed on the offering — `features.N.image` and the generated `social_card`
 * included. Sending those back is rejected, so the round-trip carries only the
 * slots the write side owns, in their stored order.
 */
const WRITABLE_MEDIA_SLOTS = new Set(['thumbnail', 'hero', 'gallery'])

/**
 * One row of the upsert body. A row that already exists carries its id; a new
 * one does not, and the endpoint mints one for an unseen slug. Nothing is
 * reached for on the row's behalf: `canonical_path` follows the shape every
 * existing offering has, and `source` names this screen only when the row has
 * never had one.
 */
export function serviceUpsertRow(row: ProfessionalServiceRow): Record<string, unknown> {
  const media = (row.media ?? []).filter(item => WRITABLE_MEDIA_SLOTS.has(item.slot))
  return {
    ...(row.id ? { id: row.id } : {}),
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    short_description: row.short_description,
    sort_order: row.sort_order,
    featured: row.featured,
    schema_type: row.schema_type,
    canonical_path: row.canonical_path ?? serviceCanonicalPath(row.slug),
    source: row.source ?? 'dashboard',
    label: row.label ?? null,
    body: row.body ?? null,
    features: row.features ?? [],
    faqs: row.faqs ?? [],
    cta_label: row.cta_label ?? null,
    cta_url: row.cta_url ?? null,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    location_id: row.location_id ?? null,
    source_ref: row.source_ref ?? null,
    ...(media.length ? { media: media.map(item => ({ asset_id: item.asset_id, slot: item.slot })) } : {}),
  }
}
