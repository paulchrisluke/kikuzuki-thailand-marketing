// The professional-service offering as the editor endpoint returns it, shared
// by the list and the record editor.
import { slugifyTitle } from '~/utils/post-slugs'

export interface ProfessionalServiceRow {
  id: string
  name: string
  slug: string
  summary: string | null
  short_description: string | null
  schema_type: string | null
  sort_order: number
  featured: boolean
}

const isProfessionalServiceRow = (value: unknown): value is ProfessionalServiceRow =>
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.name === 'string'
  && typeof value.slug === 'string'
  && (value.summary === null || typeof value.summary === 'string')
  && (value.short_description === null || typeof value.short_description === 'string')
  && (value.schema_type === null || typeof value.schema_type === 'string')
  && typeof value.sort_order === 'number'
  && typeof value.featured === 'boolean'

export const isProfessionalServicesResponse = (value: unknown): value is { offerings: ProfessionalServiceRow[] } =>
  isRecord(value) && Array.isArray(value.offerings) && value.offerings.every(isProfessionalServiceRow)

export const isProfessionalServiceWriteResponse = (value: unknown): value is { offering_ids: string[] } =>
  isRecord(value) && Array.isArray(value.offering_ids) && value.offering_ids.every(id => typeof id === 'string')

/** The slug the endpoint derives when none is typed, shown before it is asked for. */
export function derivedServiceSlug(name: string): string {
  return slugifyTitle(name).slice(0, 180)
}

/**
 * What the endpoint will not create an offering without. Slug is asked for
 * only when nothing can be derived from the name.
 */
export function professionalServiceCreateBlockers(form: { name: string; slug: string; schema_type: string }): Array<'name' | 'slug' | 'schema_type'> {
  if (!form.name.trim()) return ['name']
  const missing: Array<'name' | 'slug' | 'schema_type'> = form.slug.trim() || derivedServiceSlug(form.name) ? [] : ['slug']
  if (!form.schema_type.trim()) missing.push('schema_type')
  return missing
}
