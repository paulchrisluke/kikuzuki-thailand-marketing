// The professional-service offering, shared by the list and the record's own
// editor so neither restates the other's shape.

export interface ProfessionalServiceRow {
  id: string
  name: string
  slug: string
  summary: string | null
  short_description: string | null
  sort_order: number
  featured: boolean
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
