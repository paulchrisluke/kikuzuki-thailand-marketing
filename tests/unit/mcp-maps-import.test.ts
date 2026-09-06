import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveGoogleMapsPlace } from '../../server/utils/mcp-executor/shared.ts'
import { MCP_ERROR } from '../../server/utils/mcp-protocol.ts'
import { validateArguments } from '../../server/utils/mcp-tool-validation.ts'
import { ONBOARDING_TOOLS } from '../../server/utils/mcp-tools/onboarding.ts'

const fullMapsUrl = 'https://www.google.com/maps/place/Pottery+House/@8.054,98.91,17z'

function importFromMapsSchema(): Record<string, unknown> {
  const tool = ONBOARDING_TOOLS.find(candidate => candidate.name === 'import_from_maps')
  assert.ok(tool)
  return tool.inputSchema
}

function isInvalidParamsContaining(message: string) {
  return (error: unknown) => (
    error instanceof Error
    && error.message.includes(message)
    && (error as Error & { mcp?: { code?: number } }).mcp?.code === MCP_ERROR.invalidParams
  )
}

test('import_from_maps exposes only the backend-owned maps_url input', () => {
  const schema = importFromMapsSchema()
  assert.deepEqual(Object.keys(schema.properties as Record<string, unknown>), ['maps_url'])
  assert.equal(schema.additionalProperties, false)

  for (const removedArgument of ['parsed_hint', 'matching_policy']) {
    assert.throws(
      () => validateArguments(schema, {
        maps_url: fullMapsUrl,
        [removedArgument]: {},
      }),
      isInvalidParamsContaining(removedArgument),
    )
  }
})

test('short-link resolution failure is explicit after one attempt and never searches', async () => {
  let resolveAttempts = 0
  let searchAttempts = 0

  await assert.rejects(
    () => resolveGoogleMapsPlace('https://maps.app.goo.gl/abc123', {
      resolveShortLink: async () => {
        resolveAttempts += 1
        throw new Error('network unavailable')
      },
      searchPlaces: async () => {
        searchAttempts += 1
        return []
      },
    }),
    (error: unknown) => (
      error instanceof Error
      && error.message === 'Google Maps link resolution failed.'
      && (error as Error & { statusCode?: number }).statusCode === 502
    ),
  )

  assert.equal(resolveAttempts, 1)
  assert.equal(searchAttempts, 0)
})

test('a full URL without valid coordinates fails before a Places search', async () => {
  let searchAttempts = 0

  await assert.rejects(
    () => resolveGoogleMapsPlace('https://www.google.com/maps/place/Pottery+House', {
      resolveShortLink: async () => assert.fail('full URLs must not be resolved'),
      searchPlaces: async () => {
        searchAttempts += 1
        return []
      },
    }),
    isInvalidParamsContaining('does not contain valid location coordinates'),
  )

  assert.equal(searchAttempts, 0)
})

test('an out-of-range URL coordinate fails before a Places search', async () => {
  let searchAttempts = 0

  await assert.rejects(
    () => resolveGoogleMapsPlace('https://www.google.com/maps/place/Pottery+House/@108.054,98.91,17z', {
      resolveShortLink: async () => assert.fail('full URLs must not be resolved'),
      searchPlaces: async () => {
        searchAttempts += 1
        return []
      },
    }),
    isInvalidParamsContaining('does not contain valid location coordinates'),
  )

  assert.equal(searchAttempts, 0)
})

test('a Places candidate without valid coordinates fails after exactly one search', async () => {
  let searchAttempts = 0

  await assert.rejects(
    () => resolveGoogleMapsPlace(fullMapsUrl, {
      resolveShortLink: async () => assert.fail('full URLs must not be resolved'),
      searchPlaces: async () => {
        searchAttempts += 1
        return [{ placeId: 'ChIJCandidateWithoutCoordinates' }]
      },
    }),
    isInvalidParamsContaining('did not include valid coordinates'),
  )

  assert.equal(searchAttempts, 1)
})

test('non-ChIJ URL identifiers use one coordinate-verified search instead of a direct-ID fallback', async () => {
  let searchAttempts = 0

  const result = await resolveGoogleMapsPlace(
    `${fullMapsUrl}/data=!4m6!3m5!1sopaque-provider-id!3d8.054!4d98.91`,
    {
      resolveShortLink: async () => assert.fail('full URLs must not be resolved'),
      searchPlaces: async (query, locationBias) => {
        searchAttempts += 1
        assert.equal(query, 'Pottery House')
        assert.deepEqual(locationBias, { latitude: 8.054, longitude: 98.91 })
        return [{ placeId: 'ChIJVerifiedCandidate', lat: 8.0541, lng: 98.9101 }]
      },
    },
  )

  assert.equal(searchAttempts, 1)
  assert.equal(result.placeId, 'ChIJVerifiedCandidate')
  assert.equal(result.usedTextSearch, true)
})

test('a canonical ChIJ URL needs no redirect or text-search fallback', async () => {
  const result = await resolveGoogleMapsPlace(
    'https://www.google.com/maps/place/Pottery+House/data=!4m6!3m5!1sChIJCanonicalPlaceId!3d8.054!4d98.91',
    {
      resolveShortLink: async () => assert.fail('full URLs must not be resolved'),
      searchPlaces: async () => assert.fail('canonical place IDs must not be searched'),
    },
  )

  assert.equal(result.placeId, 'ChIJCanonicalPlaceId')
  assert.equal(result.usedTextSearch, false)
})

import { normalizeGoogleReview, parseGoogleReviewMetadata } from '../../shared/google-review.ts'

const providerReview = {
  name: 'places/place-id/reviews/review-id',
  authorAttribution: { displayName: 'สมชาย', uri: 'https://maps.google.com/profile/author', photoUri: 'https://example.com/avatar.jpg' },
  rating: 4,
  text: { text: 'อาหารดี', languageCode: 'th' },
  originalText: { text: 'อาหารดี', languageCode: 'th' },
  publishTime: '2026-07-06T05:00:33.994123456Z',
  googleMapsUri: 'https://maps.google.com/review/review-id',
  flagContentUri: 'https://maps.google.com/report/review-id',
  visitDate: { year: 2026, month: 7 },
}

test('Google review import preserves author, text, timestamp precision and attribution', () => {
  const result = normalizeGoogleReview(providerReview)
  assert.equal(result.author_name, providerReview.authorAttribution.displayName)
  assert.equal(result.content, providerReview.text.text)
  assert.equal(result.original_review_date, providerReview.publishTime)
  assert.equal(result.original_reference, providerReview.googleMapsUri)
  assert.deepEqual(parseGoogleReviewMetadata(JSON.stringify(result.google_review_metadata)), result.google_review_metadata)
  assert.equal(result.google_review_metadata.author_photo_uri, providerReview.authorAttribution.photoUri)
  assert.deepEqual(result.google_review_metadata.visit_date, providerReview.visitDate)
})

test('rating-only reviews keep absent provider facts null', () => {
  const result = normalizeGoogleReview({ name: providerReview.name, authorAttribution: { displayName: 'Author' }, rating: 5, publishTime: providerReview.publishTime })
  assert.equal(result.content, null)
  assert.equal(result.original_reference, null)
  assert.equal(result.google_review_metadata.original_text, null)
})

test('invalid provider identity, rating and attribution fail at import', () => {
  for (const value of [
    { ...providerReview, name: 'places/other' },
    { ...providerReview, rating: Number.NaN },
    { ...providerReview, rating: 6 },
    { ...providerReview, publishTime: 'yesterday' },
    { ...providerReview, googleMapsUri: 'javascript:alert(1)' },
  ]) assert.throws(() => normalizeGoogleReview(value))
})
