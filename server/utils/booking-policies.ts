import { HTTPError } from 'nitro';
import { sanitizeUrl } from '~/utils/sanitize'
import { execute, queryAll, queryFirst, type DbClient } from '../db/index.ts'
export { formatBookingPolicySummary as renderBookingPolicySummary } from './booking-policy-summary.ts'
export type {
  FormattedBookingPolicySummary as RenderedBookingPolicySummary,
  FormattedBookingPolicySummaryItem as RenderedBookingPolicySummaryItem,
} from './booking-policy-summary.ts'

export type BookingPolicyType = 'reservation' | 'experience'
export type BookingPolicyScopeType = 'site' | 'location' | 'experience'

export interface BookingPolicy {
  id: string
  organization_id: string
  site_id: string
  policy_type: BookingPolicyType
  scope_type: BookingPolicyScopeType
  location_id: string | null
  experience_id: string | null
  advance_notice_minutes: number | null
  free_cancellation_until_minutes: number | null
  reschedule_allowed: boolean | null
  reschedule_cutoff_minutes: number | null
  deposit_required: boolean | null
  deposit_trigger_party_size: number | null
  minimum_guest_age: number | null
  accessibility_contact_required: boolean | null
  additional_notes_html: string | null
  created_at: string
  updated_at: string
}

export interface BookingPolicyPatch {
  advance_notice_minutes?: number | null
  free_cancellation_until_minutes?: number | null
  reschedule_allowed?: boolean
  reschedule_cutoff_minutes?: number | null
  deposit_required?: boolean
  deposit_trigger_party_size?: number | null
  minimum_guest_age?: number | null
  accessibility_contact_required?: boolean
  additional_notes_html?: string | null
}

export interface ResolveBookingPolicyInput {
  siteId: string
  policyType: BookingPolicyType
  locationId?: string | null
  experienceId?: string | null
}

export interface ResolvedBookingPolicy extends Omit<BookingPolicy,
  'id' | 'organization_id' | 'created_at' | 'updated_at'
> {
  id: string | null
  organization_id: string | null
  created_at: string | null
  updated_at: string | null
  source_scope: BookingPolicyScopeType | 'default'
}

type NumericBookingPolicyField =
  | 'advance_notice_minutes'
  | 'free_cancellation_until_minutes'
  | 'reschedule_cutoff_minutes'
  | 'deposit_trigger_party_size'
  | 'minimum_guest_age'

type BooleanBookingPolicyField =
  | 'reschedule_allowed'
  | 'deposit_required'
  | 'accessibility_contact_required'

type OverlayBookingPolicyField =
  | NumericBookingPolicyField
  | BooleanBookingPolicyField
  | 'additional_notes_html'

interface BookingPolicyRow {
  id: string
  organization_id: string
  site_id: string
  policy_type: BookingPolicyType
  scope_type: BookingPolicyScopeType
  location_id: string | null
  experience_id: string | null
  advance_notice_minutes: number | null
  free_cancellation_until_minutes: number | null
  reschedule_allowed: number | null
  reschedule_cutoff_minutes: number | null
  deposit_required: number | null
  deposit_trigger_party_size: number | null
  minimum_guest_age: number | null
  accessibility_contact_required: number | null
  additional_notes_html: string | null
  created_at: string
  updated_at: string
}

interface GetDirectBookingPolicyInput {
  siteId: string
  policyType: BookingPolicyType
  scopeType: BookingPolicyScopeType
  locationId?: string | null
  experienceId?: string | null
}

interface UpsertBookingPolicyInput extends GetDirectBookingPolicyInput {
  organizationId: string
  patch: BookingPolicyPatch
}

const policyFields = ['advance_notice_minutes', 'free_cancellation_until_minutes', 'reschedule_allowed', 'reschedule_cutoff_minutes', 'deposit_required', 'deposit_trigger_party_size', 'minimum_guest_age', 'accessibility_contact_required', 'additional_notes_html', 'created_at', 'updated_at'] as const

const BOOKING_POLICY_SELECT = `SELECT owner_id AS id, organization_id, site_id, policy_type, scope_type, location_id, experience_id,
  ${policyFields.map(field => `json_extract(policy, '$.${field}') AS ${field}`).join(', ')}
  FROM (
    SELECT id AS owner_id, organization_id, id AS site_id, 'experience' AS policy_type, 'site' AS scope_type, NULL AS location_id, NULL AS experience_id, json_extract(settings_json, '$.booking.experience') AS policy FROM sites
    UNION ALL
    SELECT id, organization_id, site_id, 'reservation', 'location', id, NULL, json_extract(booking_json, '$.reservation.policy') FROM business_locations
    UNION ALL
    SELECT id, organization_id, site_id, 'experience', 'location', id, NULL, json_extract(booking_json, '$.experience.policy') FROM business_locations
    UNION ALL
    SELECT id, organization_id, site_id, 'experience', 'experience', NULL, id, json_extract(experience_json, '$.policy') FROM products WHERE product_type = 'experience'
  ) WHERE policy IS NOT NULL`

const EMPTY_RESERVATION_POLICY: Omit<ResolvedBookingPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'source_scope'> = {
  site_id: '',
  policy_type: 'reservation',
  scope_type: 'site',
  location_id: null,
  experience_id: null,
  advance_notice_minutes: null,
  free_cancellation_until_minutes: null,
  reschedule_allowed: null,
  reschedule_cutoff_minutes: null,
  deposit_required: null,
  deposit_trigger_party_size: null,
  minimum_guest_age: null,
  accessibility_contact_required: null,
  additional_notes_html: null,
}

const EXPERIENCE_DEFAULTS: Omit<ResolvedBookingPolicy, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'source_scope'> = {
  site_id: '',
  policy_type: 'experience',
  scope_type: 'site',
  location_id: null,
  experience_id: null,
  advance_notice_minutes: null,
  free_cancellation_until_minutes: 24 * 60,
  reschedule_allowed: true,
  reschedule_cutoff_minutes: 24 * 60,
  deposit_required: false,
  deposit_trigger_party_size: null,
  minimum_guest_age: null,
  accessibility_contact_required: false,
  additional_notes_html: null,
}

function rowToPolicy(row: BookingPolicyRow): BookingPolicy {
  return {
    ...row,
    reschedule_allowed: row.reschedule_allowed === null ? null : Boolean(row.reschedule_allowed),
    deposit_required: row.deposit_required === null ? null : Boolean(row.deposit_required),
    accessibility_contact_required: row.accessibility_contact_required === null ? null : Boolean(row.accessibility_contact_required),
  }
}

function baseDefaults(siteId: string, policyType: BookingPolicyType): ResolvedBookingPolicy {
  const defaults = policyType === 'experience' ? EXPERIENCE_DEFAULTS : EMPTY_RESERVATION_POLICY
  return {
    ...defaults,
    site_id: siteId,
    policy_type: policyType,
    id: null,
    organization_id: null,
    created_at: null,
    updated_at: null,
    source_scope: 'default',
  }
}

// Row seed for a newly-created policy, before the caller's patch is applied. Experience site-scope
// rows hold the established experience defaults. Location/experience-scope rows
// must start with every overlay field null — seeding them with baseDefaults would persist a
// concrete value for every unset field, which applyPolicy's overlay then treats as an explicit
// override and applies to every guest, silently breaking inheritance from the site-level policy.
function seedDefaultsForScope(
  siteId: string,
  policyType: BookingPolicyType,
  scopeType: BookingPolicyScopeType,
): ResolvedBookingPolicy {
  const base = baseDefaults(siteId, policyType)
  if (scopeType === 'site') return base
  return {
    ...base,
    advance_notice_minutes: null,
    free_cancellation_until_minutes: null,
    reschedule_cutoff_minutes: null,
    deposit_trigger_party_size: null,
    minimum_guest_age: null,
  }
}

function applyPolicy(base: ResolvedBookingPolicy, next: BookingPolicy): ResolvedBookingPolicy {
  const merged: ResolvedBookingPolicy = {
    ...base,
    id: next.id,
    organization_id: next.organization_id,
    site_id: next.site_id,
    policy_type: next.policy_type,
    scope_type: next.scope_type,
    location_id: next.location_id,
    experience_id: next.experience_id,
    source_scope: next.scope_type,
    created_at: next.created_at,
    updated_at: next.updated_at,
  }

  const overlayKeys: OverlayBookingPolicyField[] = [
    'advance_notice_minutes',
    'free_cancellation_until_minutes',
    'reschedule_allowed',
    'reschedule_cutoff_minutes',
    'deposit_required',
    'deposit_trigger_party_size',
    'minimum_guest_age',
    'accessibility_contact_required',
    'additional_notes_html',
  ]

  for (const key of overlayKeys) {
    const value = next[key]
    if (value !== null && value !== undefined) {
      switch (key) {
        case 'advance_notice_minutes':
          merged.advance_notice_minutes = value as number
          break
        case 'free_cancellation_until_minutes':
          merged.free_cancellation_until_minutes = value as number
          break
        case 'reschedule_allowed':
          merged.reschedule_allowed = value as boolean
          break
        case 'reschedule_cutoff_minutes':
          merged.reschedule_cutoff_minutes = value as number
          break
        case 'deposit_required':
          merged.deposit_required = value as boolean
          break
        case 'deposit_trigger_party_size':
          merged.deposit_trigger_party_size = value as number
          break
        case 'minimum_guest_age':
          merged.minimum_guest_age = value as number
          break
        case 'accessibility_contact_required':
          merged.accessibility_contact_required = value as boolean
          break
        case 'additional_notes_html':
          merged.additional_notes_html = value as string
          break
      }
    }
  }

  return merged
}

export function validateBookingPolicyScope(input: Pick<GetDirectBookingPolicyInput, 'policyType' | 'scopeType' | 'locationId' | 'experienceId'>) {
  if (input.policyType === 'reservation' && input.scopeType !== 'location') {
    throw new HTTPError({ statusCode: 400, statusMessage: 'reservation policies must use location scope' })
  }
  if (input.scopeType === 'site') {
    if (input.locationId || input.experienceId) {
      throw new HTTPError({ statusCode: 400, statusMessage: 'site scope cannot include location_id or experience_id' })
    }
    return
  }
  if (input.scopeType === 'location') {
    if (!input.locationId) {
      throw new HTTPError({ statusCode: 400, statusMessage: 'location scope requires location_id' })
    }
    if (input.experienceId) {
      throw new HTTPError({ statusCode: 400, statusMessage: 'location scope cannot include experience_id' })
    }
    return
  }
  if (input.policyType !== 'experience') {
    throw new HTTPError({ statusCode: 400, statusMessage: 'experience scope is only valid for experience policies' })
  }
  if (!input.experienceId) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'experience scope requires experience_id' })
  }
}

function normalizeInteger(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new HTTPError({ statusCode: 400, statusMessage: `${field} must be a non-negative integer or null` })
  }
  return value
}

function normalizeBoolean(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    throw new HTTPError({ statusCode: 400, statusMessage: `${field} must be a boolean` })
  }
  return value
}

function normalizeString(value: unknown, field: string) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw new HTTPError({ statusCode: 400, statusMessage: `${field} must be a string or null` })
  }
  const trimmed = value.trim()
  return trimmed || null
}

const ALLOWED_NOTES_TAGS = new Set(['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'a'])
const ALLOWED_NOTES_ATTRS: Record<string, Set<string>> = { a: new Set(['href', 'target', 'rel']) }

// Uses the Workers runtime's native HTMLRewriter rather than a DOM-based sanitizer
// (e.g. DOMPurify/jsdom) — those depend on Node's `vm`/native bindings and crash the
// whole Worker at module load if imported anywhere in the server bundle, since jsdom
// has no Workers-compatible build. See utils/sanitize.ts's server-side fallback for
// the same constraint on the client/shared sanitize path.
async function sanitizeAdditionalNotesHtml(value: string | null): Promise<string | null> {
  if (!value) return null
  const rewriter = new HTMLRewriter().on('*', {
    element(el) {
      const tag = el.tagName.toLowerCase()
      if (!ALLOWED_NOTES_TAGS.has(tag)) {
        el.removeAndKeepContent()
        return
      }
      const allowedAttrs = ALLOWED_NOTES_ATTRS[tag] ?? new Set<string>()
      // Workers' HTMLRewriter Element.attributes is IterableIterator<string[]> (name/value
      // pairs), but @cloudflare/workers-types' global `Element` collides with lib.dom's
      // `Element` in this project's tsconfig (both declare a same-named global interface),
      // so TS resolves .attributes to the DOM NamedNodeMap shape here. Cast back to the
      // actual runtime shape rather than touching the shared tsconfig lib/types config.
      const attrPairs = el.attributes as unknown as IterableIterator<[string, string]>
      for (const [name] of [...attrPairs]) {
        if (!allowedAttrs.has(name)) el.removeAttribute(name)
      }
      if (tag === 'a') {
        el.setAttribute('href', sanitizeUrl(el.getAttribute('href')))
        el.setAttribute('rel', 'noopener noreferrer')
      }
    },
  })
  const response = rewriter.transform(new Response(`<div>${value}</div>`, { headers: { 'content-type': 'text/html' } }))
  const rewritten = await response.text()
  const sanitized = rewritten.replace(/^<div>/, '').replace(/<\/div>$/, '').trim()
  return sanitized || null
}

export async function validateBookingPolicyPatch(input: Record<string, unknown>, policyType: BookingPolicyType): Promise<BookingPolicyPatch> {
  const patch: BookingPolicyPatch = {}
  const numericFields: NumericBookingPolicyField[] = [
    'advance_notice_minutes',
    'free_cancellation_until_minutes',
    'reschedule_cutoff_minutes',
    'deposit_trigger_party_size',
    'minimum_guest_age',
  ]
  for (const field of numericFields) {
    const normalized = normalizeInteger(input[field], field)
    if (normalized !== undefined) patch[field] = normalized
  }

  const booleanFields: BooleanBookingPolicyField[] = [
    'reschedule_allowed',
    'deposit_required',
    'accessibility_contact_required',
  ]
  for (const field of booleanFields) {
    const normalized = normalizeBoolean(input[field], field)
    if (normalized !== undefined) patch[field] = normalized
  }

  const notes = normalizeString(input.additional_notes_html, 'additional_notes_html')
  if (notes !== undefined) patch.additional_notes_html = await sanitizeAdditionalNotesHtml(notes)

  void policyType

  return patch
}

export async function getDirectBookingPolicy(
  db: DbClient,
  input: GetDirectBookingPolicyInput,
): Promise<BookingPolicy | null> {
  validateBookingPolicyScope(input)
  if (input.scopeType === 'site') {
    const row = await queryFirst<BookingPolicyRow>(
      db,
      `${BOOKING_POLICY_SELECT}
       AND site_id = ? AND policy_type = ? AND scope_type = 'site'
       LIMIT 1`,
      [input.siteId, input.policyType],
    )
    return row ? rowToPolicy(row) : null
  }
  if (input.scopeType === 'location') {
    const row = await queryFirst<BookingPolicyRow>(
      db,
      `${BOOKING_POLICY_SELECT}
       AND site_id = ? AND policy_type = ? AND scope_type = 'location' AND location_id = ?
       LIMIT 1`,
      [input.siteId, input.policyType, input.locationId!],
    )
    return row ? rowToPolicy(row) : null
  }
  const row = await queryFirst<BookingPolicyRow>(
    db,
    `${BOOKING_POLICY_SELECT}
     AND site_id = ? AND policy_type = 'experience' AND scope_type = 'experience' AND experience_id = ?
     LIMIT 1`,
    [input.siteId, input.experienceId!],
  )
  return row ? rowToPolicy(row) : null
}

export async function resolveBookingPolicy(
  db: DbClient,
  input: ResolveBookingPolicyInput,
): Promise<ResolvedBookingPolicy> {
  if (input.policyType === 'reservation') {
    if (!input.locationId) {
      throw new HTTPError({ statusCode: 400, statusMessage: 'reservation policies require location_id' })
    }
    const direct = await getDirectBookingPolicy(db, {
      siteId: input.siteId,
      policyType: 'reservation',
      scopeType: 'location',
      locationId: input.locationId,
    })
    const empty = baseDefaults(input.siteId, 'reservation')
    empty.location_id = input.locationId
    empty.scope_type = 'location'
    return direct ? applyPolicy(empty, direct) : empty
  }

  let resolved = baseDefaults(input.siteId, input.policyType)

  const sitePolicy = await getDirectBookingPolicy(db, {
    siteId: input.siteId,
    policyType: input.policyType,
    scopeType: 'site',
  })
  if (sitePolicy) resolved = applyPolicy(resolved, sitePolicy)

  if (input.locationId) {
    const locationPolicy = await getDirectBookingPolicy(db, {
      siteId: input.siteId,
      policyType: input.policyType,
      scopeType: 'location',
      locationId: input.locationId,
    })
    if (locationPolicy) resolved = applyPolicy(resolved, locationPolicy)
  }

  if (input.policyType === 'experience' && input.experienceId) {
    const experiencePolicy = await getDirectBookingPolicy(db, {
      siteId: input.siteId,
      policyType: 'experience',
      scopeType: 'experience',
      experienceId: input.experienceId,
    })
    if (experiencePolicy) resolved = applyPolicy(resolved, experiencePolicy)
  }

  return resolved
}

export interface BookingPolicyTarget {
  locationId?: string | null
  experienceId?: string | null
}

export interface BookingPolicyIndex {
  site: ResolvedBookingPolicy | null
  byLocation: Map<string, ResolvedBookingPolicy>
  byExperience: Map<string, ResolvedBookingPolicy>
}

/**
 * Loads every policy needed by a public page in one statement and resolves
 * inheritance in memory. Query count is constant regardless of target count.
 */
export async function resolveBookingPolicyIndex(
  db: DbClient,
  input: {
    siteId: string
    policyType: BookingPolicyType
    locations?: string[]
    experiences?: Map<string, BookingPolicyTarget>
  },
): Promise<BookingPolicyIndex> {
  const rows = await queryAll<BookingPolicyRow>(
    db,
    `${BOOKING_POLICY_SELECT}
     AND site_id = ? AND policy_type = ?`,
    [input.siteId, input.policyType],
  )
  const policies = (rows ?? []).map(rowToPolicy)
  const sitePolicy = policies.find(policy => policy.scope_type === 'site') ?? null
  const locationPolicies = new Map(
    policies
      .filter(policy => policy.scope_type === 'location' && policy.location_id)
      .map(policy => [policy.location_id!, policy]),
  )
  const experiencePolicies = new Map(
    policies
      .filter(policy => policy.scope_type === 'experience' && policy.experience_id)
      .map(policy => [policy.experience_id!, policy]),
  )

  let site: ResolvedBookingPolicy | null = input.policyType === 'experience'
    ? baseDefaults(input.siteId, input.policyType)
    : null
  if (sitePolicy && site) site = applyPolicy(site, sitePolicy)

  const byLocation = new Map<string, ResolvedBookingPolicy>()
  for (const locationId of new Set(input.locations ?? [])) {
    const direct = locationPolicies.get(locationId)
    if (input.policyType === 'reservation') {
      const empty = baseDefaults(input.siteId, 'reservation')
      empty.location_id = locationId
      empty.scope_type = 'location'
      byLocation.set(locationId, direct ? applyPolicy(empty, direct) : empty)
    } else {
      byLocation.set(locationId, direct && site ? applyPolicy(site, direct) : site!)
    }
  }

  const byExperience = new Map<string, ResolvedBookingPolicy>()
  for (const [experienceId, target] of input.experiences ?? []) {
    let resolved = target.locationId
      ? (byLocation.get(target.locationId)
        ?? (locationPolicies.get(target.locationId)
          ? applyPolicy(site!, locationPolicies.get(target.locationId)!)
          : site!))
      : site!
    const direct = experiencePolicies.get(experienceId)
    if (direct) resolved = applyPolicy(resolved, direct)
    byExperience.set(experienceId, resolved)
  }

  return { site, byLocation, byExperience }
}

export function applyBookingPolicyPatch(
  policy: ResolvedBookingPolicy,
  patch: BookingPolicyPatch,
): ResolvedBookingPolicy {
  const next: ResolvedBookingPolicy = { ...policy }

  for (const [key, value] of Object.entries(patch) as Array<[keyof BookingPolicyPatch, BookingPolicyPatch[keyof BookingPolicyPatch]]>) {
    if (value === undefined) continue
    switch (key) {
      case 'advance_notice_minutes':
        next.advance_notice_minutes = value as number | null
        break
      case 'free_cancellation_until_minutes':
        next.free_cancellation_until_minutes = value as number | null
        break
      case 'reschedule_cutoff_minutes':
        next.reschedule_cutoff_minutes = value as number | null
        break
      case 'deposit_trigger_party_size':
        next.deposit_trigger_party_size = value as number | null
        break
      case 'minimum_guest_age':
        next.minimum_guest_age = value as number | null
        break
      case 'additional_notes_html':
        next.additional_notes_html = value as string | null
        break
      case 'reschedule_allowed':
      case 'deposit_required':
      case 'accessibility_contact_required':
        next[key] = value as boolean
        break
    }
  }

  return next
}

export async function upsertBookingPolicy(db: DbClient, input: UpsertBookingPolicyInput): Promise<BookingPolicy> {
  validateBookingPolicyScope(input)
  const owner = input.scopeType === 'site'
    ? { table: 'sites', column: 'settings_json', path: '$.booking.experience', id: input.siteId, scope: 'id = ?' }
    : input.scopeType === 'location'
      ? { table: 'business_locations', column: 'booking_json', path: `$.${input.policyType}.policy`, id: input.locationId, scope: 'site_id = ?' }
      : { table: 'products', column: 'experience_json', path: '$.policy', id: input.experienceId, scope: "site_id = ? AND product_type = 'experience'" }
  const now = new Date().toISOString()
  const seeded = seedDefaultsForScope(input.siteId, input.policyType, input.scopeType)
  const defaults = Object.fromEntries(policyFields.map(field => [field, field === 'created_at' || field === 'updated_at' ? now : seeded[field]]))
  if (input.scopeType !== 'site') {
    defaults.reschedule_allowed = null
    defaults.deposit_required = null
    defaults.accessibility_contact_required = null
  }
  const changes = Object.entries(input.patch).filter(([, value]) => value !== undefined)
  const paths = changes.map(([field]) => `'$.${field}', json(?)`)
  const result = await execute(db, `UPDATE ${owner.table}
    SET ${owner.column} = json_set(${owner.column}, ?, json_set(COALESCE(json_extract(${owner.column}, ?), json(?)), '$.updated_at', ?${paths.length ? ', ' + paths.join(', ') : ''})), updated_at = ?
    WHERE id = ? AND organization_id = ? AND ${owner.scope}`,
  [owner.path, owner.path, JSON.stringify(defaults), now, ...changes.map(([, value]) => JSON.stringify(value)), now, owner.id, input.organizationId, input.siteId])
  if (!result.meta.changes) throw new HTTPError({ statusCode: 404, statusMessage: 'Booking policy owner not found' })
  const policy = await getDirectBookingPolicy(db, input)
  if (!policy) throw new Error('Booking policy write did not persist')
  return policy
}
