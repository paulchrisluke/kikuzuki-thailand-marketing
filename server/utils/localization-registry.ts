import { localizationError } from '~/server/utils/localization-errors'

import { LOCALIZED_RESOURCE_TYPES, type LocalizedResourceType } from '~/shared/content-registries'
export { LOCALIZED_RESOURCE_TYPES, type LocalizedResourceType } from '~/shared/content-registries'

export type LocalizedValues = Record<string, unknown>

type ValueShape = 'text' | 'string_array' | 'details' | 'features' | 'faqs' | { readonly [field: string]: ValueShape }

interface ResourceLocalizationDefinition {
  table: string
  fields: Readonly<Record<string, ValueShape>>
  route: 'none' | 'location' | 'product' | 'offering'
}

const POLICY_FIELDS = { additional_notes_html: 'text' } as const
const EXPERIENCE_FIELDS = { tagline: 'text', pricing_note: 'text',
  included_items: 'string_array', what_to_bring: 'string_array', meeting_point: 'text',
  cancellation_policy: 'text', policy: POLICY_FIELDS } as const

export const RESOURCE_LOCALIZATION_REGISTRY: Readonly<Record<LocalizedResourceType, ResourceLocalizationDefinition>> = Object.freeze({
  site: { table: 'sites', fields: { brand_name: 'text', brand_description: 'text', seo_title: 'text', seo_description: 'text',
    compliance: { service_area: 'text', disclaimer: 'text', footer_disclaimer: 'text' }, consultation: { cta_label: 'text' },
    booking: { experience: POLICY_FIELDS } }, route: 'none' },
  business_location: { table: 'business_locations', fields: { title: 'text', address: 'text', city: 'text',
    neighborhood: 'text', description: 'text', short_description: 'text', seo_title: 'text', seo_description: 'text',
    booking: { reservation: { policy: POLICY_FIELDS }, experience: { policy: POLICY_FIELDS } } }, route: 'location' },
  product: { table: 'products', fields: { name: 'text', description: 'text', tags_json: 'string_array', details_json: 'details',
    seo_title: 'text', seo_description: 'text', experience: EXPERIENCE_FIELDS }, route: 'product' },
  product_category: { table: 'product_categories', fields: { name: 'text' }, route: 'none' },
  offering: { table: 'offerings', fields: { name: 'text', label: 'text', summary: 'text', short_description: 'text', body: 'text',
    features_json: 'features', faqs_json: 'faqs', cta_label: 'text', seo_title: 'text', seo_description: 'text' }, route: 'offering' },
  media_asset: { table: 'media_assets', fields: { alt_text: 'text' }, route: 'none' },
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonBlankText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validateShape(field: string, value: unknown, shape: ValueShape): void {
  if (shape === 'text' && typeof value === 'string') return
  if (typeof shape === 'object' && isRecord(value)) {
    if (Object.keys(value).some(key => !Object.hasOwn(shape, key))) localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', `${field} contains unknown localized fields`, { field })
    for (const [key, nested] of Object.entries(value)) validateShape(`${field}.${key}`, nested, shape[key]!)
    return
  }
  if (shape === 'string_array') {
    if (Array.isArray(value) && value.every(isNonBlankText)) return
  } else if (shape === 'details') {
    if (Array.isArray(value) && value.every(item => isRecord(item)
      && Object.keys(item).every(key => key === 'key' || key === 'label' || key === 'values')
      && isNonBlankText(item.key) && isNonBlankText(item.label)
      && Array.isArray(item.values) && item.values.every(isNonBlankText))) return
  } else if (shape === 'features') {
    if (Array.isArray(value) && value.every(item => isRecord(item)
      && Object.keys(item).every(key => ['title', 'description', 'icon', 'sort_order'].includes(key))
      && isNonBlankText(item.title) && isNonBlankText(item.description)
      && (item.icon === undefined || item.icon === null || typeof item.icon === 'string')
      && (item.sort_order === undefined || Number.isInteger(item.sort_order)))) return
  } else if (shape === 'faqs') {
    if (Array.isArray(value) && value.every(item => isRecord(item)
      && Object.keys(item).every(key => key === 'question' || key === 'answer')
      && isNonBlankText(item.question) && isNonBlankText(item.answer))) return
  }
  localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', `${field} has an invalid localized value shape`, { field })
}

export function parseLocalizedResourceType(value: unknown): LocalizedResourceType {
  if (typeof value === 'string' && (LOCALIZED_RESOURCE_TYPES as readonly string[]).includes(value)) {
    return value as LocalizedResourceType
  }
  localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'Unsupported localized resource type', { resource_type: value })
}

export function validateLocalizedValues(resourceType: LocalizedResourceType, input: unknown): LocalizedValues {
  if (!isRecord(input)) localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'values must be an object')
  const definition = RESOURCE_LOCALIZATION_REGISTRY[resourceType]
  const unknown = Object.keys(input).filter(key => !Object.hasOwn(definition.fields, key)).sort()
  if (unknown.length) {
    localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', `Unknown localized field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`, { fields: unknown })
  }
  for (const [field, shape] of Object.entries(definition.fields)) {
    if (!Object.hasOwn(input, field)) continue
    const value = input[field]
    if (value === undefined || value === null) {
      localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', `${field} must be omitted instead of null`, { field })
    }
    if (shape === 'text' && typeof value !== 'string') {
      localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', `${field} must be a string`, { field })
    }
    validateShape(field, value, shape)
  }
  return Object.fromEntries(Object.entries(input).sort(([left], [right]) => left.localeCompare(right)))
}

const SEGMENT = '[^/?#]+'

export function validateLocalizedRoutePath(resourceType: LocalizedResourceType, locale: string, routePath: unknown,
  vertical: string, productType: string | null = null): string | null {
  const definition = RESOURCE_LOCALIZATION_REGISTRY[resourceType]
  if (definition.route === 'none') {
    if (routePath !== undefined && routePath !== null) localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', resourceType + ' does not accept route_path')
    return null
  }
  if (typeof routePath !== 'string' || !routePath.trim()) localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'route_path is required for ' + resourceType)
  const path = routePath.trim()
  const prefix = '/' + locale + '/'
  const family = vertical === 'restaurant' ? 'menu' : 'products'
  const suffix = definition.route === 'location' ? 'locations/' + SEGMENT
    : definition.route === 'product' ? productType === 'experience' ? 'experiences/' + SEGMENT : 'locations/' + SEGMENT + '/' + family + '/' + SEGMENT
    : 'services/' + SEGMENT
  if (!path.startsWith(prefix) || !new RegExp('^' + suffix + '$').test(path.slice(prefix.length)) || path.includes('//')) localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'route_path is invalid for ' + resourceType, { route_path: path })
  return path
}
