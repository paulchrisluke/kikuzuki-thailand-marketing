// The professional-service offering, shared by the list and the record's own
// editor so neither restates the other's shape.

export interface ProfessionalServiceMediaRef {
  asset_id: string
  slot: string
}

export interface ProfessionalServiceRow {
  id: string
  name: string
  slug: string
  summary: string | null
  short_description: string | null
  sort_order: number
  featured: boolean
  /**
   * The upsert requires these three and the dashboard never sent them, so
   * saving this screen has always failed with
   * "offerings.<slug>.schema_type is required." They belong to the record and
   * are carried back unchanged; `schema_type` is the site's schema.org type
   * (LegalService, AccountingService) and has no default to reach for, so a new
   * service asks for it.
   */
  schema_type: string | null
  canonical_path: string | null
  source: string | null
  /**
   * Omitting media is not neutral: the upsert compares what it is given against
   * what is stored per slot, and an empty list clears `thumbnail`/`hero` and
   * refuses a `gallery` outright. Sending the stored placements back unchanged
   * makes each slot compare equal and be skipped.
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
export function professionalServiceCreateBlockers(form: { name: string; slug: string }): string[] {
  if (!form.name.trim()) return ['Name']
  return form.slug.trim() || slugifyServiceName(form.name) ? [] : ['Slug']
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
export const SERVICE_WRITABLE_MEDIA_SLOTS = ['thumbnail', 'hero', 'gallery'] as const

export function serviceWritableMedia(media: ProfessionalServiceMediaRef[] | undefined): ProfessionalServiceMediaRef[] {
  return (media ?? [])
    .filter(item => (SERVICE_WRITABLE_MEDIA_SLOTS as readonly string[]).includes(item.slot))
    .map(item => ({ asset_id: item.asset_id, slot: item.slot }))
}
