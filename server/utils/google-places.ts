import { normalizeGoogleOpeningHours, type OpeningHours } from '~/shared/reservation-hours'
import { serializeOpeningHours } from '~/server/utils/location-management'
import type { D1Database } from '@cloudflare/workers-types'
import { normalizeGoogleReview, type GoogleReview } from '~/shared/google-review'
import { executeBatch } from '~/server/db'

const PLACES_BASE = 'https://places.googleapis.com/v1/places'

// Generate a canonical Google Maps embed URL from the location data already
// stored by the Places importer. This helper does not call Google.
export const calculateMapEmbedUrl = (loc: {
  title: string
  maps_url?: string | null
  latitude?: number | null
  longitude?: number | null
  address?: string | null
  city?: string | null
}) => {
  if (loc.maps_url) {
    try {
      const url = new URL(loc.maps_url)
      const cid = url.searchParams.get('cid')
      if (cid) return `https://maps.google.com/maps?cid=${cid}&output=embed`
    } catch { /* use the next available source */ }
  }

  if (loc.latitude != null && loc.longitude != null) {
    return `https://maps.google.com/maps?q=${loc.latitude},${loc.longitude}&output=embed`
  }

  let address = loc.address || loc.city || ''
  if (address.startsWith('{')) {
    try {
      const parsed = JSON.parse(address) as { addressLines?: string[]; streetAddress?: string }
      address = parsed.addressLines?.[0] || parsed.streetAddress || loc.city || ''
    } catch { /* use the raw address */ }
  }

  if (!address) return null
  const query = loc.title ? `${loc.title}, ${address}` : address
  return `https://maps.google.com/maps?q=${encodeURIComponent(String(query))}&output=embed`
}

export class PlaceDetailsError extends Error {
  public readonly statusCode: number

  constructor(
    message: string,
    statusCode: number = 502
  ) {
    super(message)
    this.name = 'PlaceDetailsError'
    this.statusCode = statusCode
  }
}

const SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.googleMapsUri',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.rating',
  'places.userRatingCount',
].join(',')

const DETAIL_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'location',
  'googleMapsUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'regularOpeningHours',
  'timeZone',
  'reviews',
].join(',')

export interface PlaceSearchResult {
  placeId: string
  name: string
  formattedAddress: string
  lat: number | null
  lng: number | null
  mapsUrl: string | null
  phone: string | null
  rating: number | null
  ratingCount: number | null
}

export type PlaceReview = GoogleReview

export interface PlaceDetails {
  placeId: string
  name: string
  formattedAddress: string
  city: string | null
  lat: number | null
  lng: number | null
  mapsUrl: string | null
  phone: string | null
  websiteUrl: string | null
  rating: number | null
  ratingCount: number | null
  timezone: string | null
  openingHours: OpeningHours
  reviews: PlaceReview[]
}

interface RawPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  googleMapsUri?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  regularOpeningHours?: { periods?: unknown[] }
  timeZone?: { id?: string }
  addressComponents?: Array<{ longText?: string; types?: string[]; languageCode?: string }>
  reviews?: unknown[]
}

function extractCity(components?: RawPlace['addressComponents']): string | null {
  if (!components) return null
  for (const type of ['locality', 'administrative_area_level_2', 'administrative_area_level_1']) {
    const component = components.find(component => component.types?.includes(type) && component.longText)
    if (component?.longText) return component.longText
  }
  return null
}

function normalizeSearchResult(place: RawPlace): PlaceSearchResult {
  return {
    placeId: place.id ?? '',
    name: place.displayName?.text ?? '',
    formattedAddress: place.formattedAddress ?? '',
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
  }
}

function normalizeDetail(place: RawPlace): PlaceDetails {
  return {
    placeId: place.id ?? '',
    name: place.displayName?.text ?? '',
    formattedAddress: place.formattedAddress ?? '',
    city: extractCity(place.addressComponents),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    websiteUrl: place.websiteUri ?? null,
    rating: place.rating ?? null,
    ratingCount: place.userRatingCount ?? null,
    timezone: place.timeZone?.id ?? null,
    openingHours: normalizeGoogleOpeningHours(place.regularOpeningHours?.periods),
    reviews: (place.reviews ?? []).map(normalizeGoogleReview),
  }
}

export function googleReviewUpserts(scope: { organizationId: string; siteId: string; locationId: string }, reviews: PlaceReview[], now: string) {
  const { organizationId, siteId, locationId } = scope
  return reviews.map(review => {
    const reviewId = `gplaces-${locationId}-${review.google_review_id.replace(/\//g, '-')}`
    return {
      query: `INSERT INTO reviews (id, organization_id, site_id, location_id, google_review_id, author_name, rating, content,
        original_review_date, original_reference, google_review_metadata, status, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'google_places', ?, ?)
        ON CONFLICT(organization_id, site_id, location_id, google_review_id) DO UPDATE SET
          author_name = excluded.author_name, rating = excluded.rating, content = excluded.content,
          original_review_date = excluded.original_review_date, original_reference = excluded.original_reference,
          google_review_metadata = excluded.google_review_metadata, updated_at = excluded.updated_at`,
      params: [reviewId, organizationId, siteId, locationId, review.google_review_id, review.author_name, review.rating, review.content,
        review.original_review_date, review.original_reference, JSON.stringify(review.google_review_metadata), now, now],
    }
  })
}

export async function syncPlaceToLocation(
  db: D1Database,
  apiKey: string,
  organizationId: string,
  siteId: string,
  locationId: string,
  placeId: string
): Promise<{ place: PlaceDetails; reviewsUpserted: number }> {
  const place = await getPlaceDetails(apiKey, placeId)
  const now = new Date().toISOString()

  const results = await executeBatch(db, [{ query: `
    UPDATE business_locations SET
      phone = COALESCE(?, phone),
      website_url = COALESCE(?, website_url),
      city = COALESCE(?, city),
      address = ?,
      latitude = COALESCE(?, latitude),
      longitude = COALESCE(?, longitude),
      maps_url = COALESCE(?, maps_url),
      opening_hours = ?,
      timezone = COALESCE(?, timezone),
      rating = COALESCE(?, rating),
      review_count = COALESCE(?, review_count),
      last_synced_at = ?,
      updated_at = ?
    WHERE id = ? AND organization_id = ? AND site_id = ?
  `, params: [
    place.phone,
    place.websiteUrl,
    place.city,
    JSON.stringify({ addressLines: [place.formattedAddress] }),
    place.lat,
    place.lng,
    place.mapsUrl,
    serializeOpeningHours(place.openingHours),
    place.timezone,
    place.rating,
    place.ratingCount,
    now,
    now,
    locationId,
    organizationId,
    siteId
  ] }, ...googleReviewUpserts({ organizationId, siteId, locationId }, place.reviews, now)])
  const reviewsUpserted = results.slice(1).reduce((count, result) => count + Number(result.meta?.changes ?? 0), 0)

  return { place, reviewsUpserted }
}

export async function searchPlaces(
  apiKey: string,
  query: string,
  locationBias?: { latitude: number; longitude: number; radiusMeters?: number },
): Promise<PlaceSearchResult[]> {
  const body: Record<string, unknown> = { textQuery: query, maxResultCount: 5, languageCode: 'en' }
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.latitude, longitude: locationBias.longitude },
        radius: locationBias.radiusMeters ?? 500,
      },
    }
  }
  const response = await fetch(`${PLACES_BASE}:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': SEARCH_FIELD_MASK,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Places search failed: ${response.status} ${text.slice(0, 200)}`)
  }

  const data = await response.json() as { places?: RawPlace[] }
  return (data.places ?? []).map(normalizeSearchResult)
}

function extractPlaceIdFromUrl(url: string): string | null {
  const explicitId = new URL(url).searchParams.get('query_place_id')
  if (explicitId) return explicitId
  const match = url.match(/!1s(ChIJ[^!&%]+)/)
  if (match?.[1]) {
    try { return decodeURIComponent(match[1]) } catch { return match[1] }
  }
  return null
}

async function resolveShortUrl(url: string): Promise<string> {
  let parsed: URL
  try { parsed = new URL(url) } catch { return url }
  if (parsed.protocol !== 'https:') return url
  if (!['maps.app.goo.gl', 'goo.gl', 'share.google'].includes(parsed.hostname)) return url
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(parsed.toString(), { method: 'HEAD', redirect: 'follow', signal: controller.signal })
    return res.url || url
  } catch { return url } finally { clearTimeout(timeout) }
}

export async function getPlaceDetailsByUrl(
  apiKey: string,
  mapsUrl: string,
): Promise<PlaceDetails> {
  const resolved = await resolveShortUrl(mapsUrl)
  const placeId = extractPlaceIdFromUrl(resolved)
  if (placeId) {
    return getPlaceDetails(apiKey, placeId)
  }

  throw new PlaceDetailsError('Choose a Google place and provide its place ID in the Maps URL (!1sChIJ... or query_place_id=...).', 422)
}

export async function getPlaceDetails(
  apiKey: string,
  placeId: string,
): Promise<PlaceDetails> {
  const response = await fetch(`${PLACES_BASE}/${encodeURIComponent(placeId)}?languageCode=en`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAIL_FIELD_MASK,
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Places detail failed: ${response.status} ${text.slice(0, 200)}`)
  }

  return normalizeDetail(await response.json() as RawPlace)
}
