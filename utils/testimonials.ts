// The owner-entered testimonial shape, shared by the list and the record's own
// editor so neither restates the other's validators.

export type CollectionMethod = 'in_person' | 'email' | 'phone' | 'migration' | 'other'
export type TestimonialStatus = 'pending' | 'approved' | 'rejected'

export interface SiteTestimonial {
  id: string
  author_name: string
  rating: number
  title: string | null
  content: string
  collection_method: CollectionMethod
  original_review_date: string | null
  original_reference: string | null
  publication_authorized: boolean
  status: TestimonialStatus
}

export const COLLECTION_METHODS: Array<{ label: string; value: CollectionMethod }> = [
  { label: 'In person', value: 'in_person' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Migration', value: 'migration' },
  { label: 'Other', value: 'other' },
]

export const TESTIMONIAL_STATUSES: TestimonialStatus[] = ['pending', 'approved', 'rejected']

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string'

export const isSiteTestimonial = (value: unknown): value is SiteTestimonial =>
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.author_name === 'string'
  && typeof value.rating === 'number'
  && typeof value.content === 'string'
  && isStringOrNull(value.title)
  && COLLECTION_METHODS.some(method => method.value === value.collection_method)
  && isStringOrNull(value.original_review_date)
  && isStringOrNull(value.original_reference)
  && typeof value.publication_authorized === 'boolean'
  && TESTIMONIAL_STATUSES.some(status => status === value.status)

export const isTestimonialsResponse = (value: unknown): value is { reviews: SiteTestimonial[] } =>
  isRecord(value) && Array.isArray(value.reviews) && value.reviews.every(isSiteTestimonial)

export const isReviewCreatedResponse = (value: unknown): value is { id: string; created: true } =>
  isRecord(value) && typeof value.id === 'string' && value.created === true

export const isReviewUpdatedResponse = (value: unknown): value is { updated: true } =>
  isRecord(value) && value.updated === true

export const isReviewDeletedResponse = (value: unknown): value is { review_id: string; deleted: true } =>
  isRecord(value) && typeof value.review_id === 'string' && value.deleted === true

/**
 * What `createOwnerEnteredSiteReview` refuses to insert without: a name, a
 * body, a rating in range, and an explicit publication consent. A record cannot
 * be posted as a blank draft, which is why the new-testimonial level holds its
 * state until all four are answered.
 */
export function testimonialCreateBlockers(form: {
  author_name: string
  content: string
  rating: number
  publication_authorized: boolean
}): string[] {
  const missing: string[] = []
  if (!form.author_name.trim()) missing.push('Reviewer')
  if (!form.content.trim()) missing.push('Testimonial')
  if (!Number.isInteger(form.rating) || form.rating < 1 || form.rating > 5) missing.push('Rating')
  if (!form.publication_authorized) missing.push('Publication authorization')
  return missing
}
