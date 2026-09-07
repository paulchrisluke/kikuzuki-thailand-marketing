import { createHmac, timingSafeEqual } from 'node:crypto'
import { HTTPError } from 'nitro'
import { z } from 'zod'
import { executeBatch, queryFirst, type BatchQuery, type DbClient } from '~/server/db'
import { readAvailability, executeAvailabilityClaim } from '~/server/utils/availability'
import { assertResourceAccess, resolveOrganizationMembership } from '~/server/utils/member-access'
import { resolveBookingPresentation } from '~/utils/booking-presentation'
import type { CloudflareEnv } from '~/server/utils/auth'
import { notifyBookingChangeOwner } from '~/server/utils/notifications'
import { appendEntry, findEntryByDedupeKey, getEntryById } from './entries'
import { createDeliveryReceipt, deliverGuestThreadEmail } from './deliveries'
import { updateThreadProjection } from './repository'
import { getGuestRequest, requestSummary } from '~/server/domain/requests'
import type { GuestThreadRow } from './types'

/**
 * Guest-facing copy uses the tenant's own word for the booking, resolved from
 * the same table the dashboard reads. Deriving it here from submission_type
 * alone told a professional-services client's guest about their "booking" while
 * every screen their host saw said consultation.
 */
async function bookingNoun(db: DbClient, thread: Pick<GuestThreadRow, 'site_id' | 'kind'>): Promise<string> {
	const site = await queryFirst<{ vertical: string }>(db, 'SELECT vertical FROM sites WHERE id = ? LIMIT 1', [thread.site_id])
	const kind = thread.kind === 'reservation' ? 'reservation' : 'experience_booking'
	return resolveBookingPresentation(kind, site?.vertical).noun
}

const fieldsSchema = z.object({
  bookingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }),
  bookingTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  partySize: z.number().int().min(1).max(99),
  locationId: z.string().min(1),
})
const requestSchema = fieldsSchema.extend({ expectedUpdatedAt: z.string().min(1) })
const sourceSchema = fieldsSchema.extend({ status: z.string(), experienceId: z.string().nullable(), completedAt: z.string().nullable(),
  partySizeIsMinimum: z.boolean(), notes: z.string().nullable(), guest: z.object({ name: z.string(), email: z.string(), phone: z.string().nullable() }) })
const proposalSchema = z.object({ before: sourceSchema, after: fieldsSchema, updatedAt: z.string(), locationTitle: z.string(), originalLocationTitle: z.string() })
type Fields = z.infer<typeof fieldsSchema>
type Source = z.infer<typeof sourceSchema> & { updatedAt: string }
type ChangeEnv = CloudflareEnv

async function sourceSummary(db: DbClient, thread: GuestThreadRow) {
  return requestSummary(db, thread)
}

async function loadSource(db: DbClient, thread: GuestThreadRow): Promise<Source> {
  if (thread.kind === 'contact') throw new HTTPError({ statusCode: 400, message: 'This conversation is not a reservation or booking' })
  if (!thread.location_id) throw new HTTPError({ statusCode: 409, message: 'Booking location is missing' })
  return { bookingDate: thread.booking_date, bookingTime: thread.time_slot, partySize: thread.party_size, locationId: thread.location_id,
    updatedAt: thread.updated_at, status: thread.status, experienceId: thread.product_id, completedAt: thread.payload.completion.at,
    partySizeIsMinimum: thread.payload.party_size_is_minimum, notes: thread.payload.notes, guest: thread.payload.guest }
}

async function validateDestination(db: DbClient, thread: GuestThreadRow, before: Source, after: Fields) {
  const location = await queryFirst<{ id: string; title: string }>(db,
    `SELECT id, title FROM business_locations WHERE id = ? AND site_id = ? AND organization_id = ?`,
    [after.locationId, thread.site_id, thread.organization_id])
  if (!location) throw new HTTPError({ statusCode: 400, message: 'Choose a location belonging to this site' })
  if (thread.kind !== 'reservation' && !before.experienceId) throw new HTTPError({ statusCode: 409, message: 'Experience is missing' })
  const [snapshot] = await readAvailability(db, { siteId: thread.site_id,
    owners: [thread.kind === 'reservation' ? { kind: 'location', locationId: after.locationId } : { kind: 'experience', experienceId: before.experienceId! }],
    dates: [after.bookingDate], excludeBookingId: thread.id,
  })
  if (snapshot!.row.location_id !== after.locationId) throw new HTTPError({ statusCode: 409, message: 'This experience is only offered at its configured location' })
  const slot = snapshot!.days[0]!.slots.find(s => s.time_slot === after.bookingTime)
  if (!slot || slot.is_closed || slot.remaining !== null && slot.remaining < after.partySize) throw new HTTPError({ statusCode: 409, message: 'The requested time or guest count is no longer available' })
  return { ...location, snapshot: snapshot! }

}

function linkToken(env: ChangeEnv, threadId: string, requestId: string) {
  if (!env.EMAIL_REPLY_SECRET) throw new HTTPError({ statusCode: 503, message: 'Guest email signing is not configured' })
  return createHmac('sha256', env.EMAIL_REPLY_SECRET).update(`booking-change:v1:${threadId}:${requestId}`).digest('hex')
}

async function deliverEmail(db: DbClient, env: ChangeEnv, thread: GuestThreadRow, entryId: string, subject: string, body: string, status: 'requested' | 'accepted' | 'declined', proposal: z.infer<typeof proposalSchema>, noun: string) {
  const summary = await sourceSummary(db, thread)
  if (!summary.guestEmail) throw new HTTPError({ statusCode: 400, message: 'Guest email is required' })
  const site = await queryFirst<{ brand_name: string }>(db, 'SELECT brand_name FROM sites WHERE id = ?', [thread.site_id])
  if (!site?.brand_name) throw new HTTPError({ statusCode: 409, message: 'Site name is not configured' })
  const delivery = await createDeliveryReceipt(db, {
    entryId,
    channel: 'email',
    provider: env.EMAIL_DELIVERY_MODE === 'provider' ? 'resend' : 'log_only',
    purpose: 'status_update',
    idempotencyKey: `booking-change:${entryId}`,
  })
  const sent = await deliverGuestThreadEmail(db, {
    delivery,
    env,
    to: summary.guestEmail,
    fromName: site.brand_name,
    subject,
    body,
    submissionType: thread.kind,
    submissionId: thread.id,
  })
  if (sent.status === 'failed') throw new HTTPError({ statusCode: 502, message: sent.error || 'Guest email could not be sent' })
  if (sent.status === 'unknown') throw new HTTPError({ statusCode: 504, message: sent.error || 'Guest email outcome is unknown' })
  await notifyBookingChangeOwner(env, db, {
    organizationId: thread.organization_id, siteId: thread.site_id, siteName: site.brand_name,
    locationId: status === 'accepted' ? proposal.after.locationId : proposal.before.locationId,
    threadId: thread.id, submissionType: thread.kind as 'reservation' | 'experience_booking', submissionId: thread.id, sourceEntryId: entryId,
    guestName: summary.guestName, guestEmail: summary.guestEmail, status, noun,
    date: proposal.after.bookingDate, time: proposal.after.bookingTime, guests: proposal.after.partySize, locationTitle: proposal.locationTitle,
  })
}

/** A proposal is an immutable fact in the existing conversation, not a second booking record. */
export async function requestBookingChange(db: DbClient, env: CloudflareEnv, thread: GuestThreadRow, actorUserId: string, body: unknown, idempotencyKey: string) {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) throw new HTTPError({ statusCode: 400, message: 'Valid location, date, time, guest count, and latest reservation details are required' })
  const after = fieldsSchema.parse(parsed.data)
  const before = await loadSource(db, thread)
  const summary = await sourceSummary(db, thread)
  if (before.completedAt || !['pending', 'confirmed'].includes(before.status)) throw new HTTPError({ statusCode: 409, message: 'This reservation or booking can no longer be changed' })
  const membership = await resolveOrganizationMembership(env, { organizationId: thread.organization_id, userId: actorUserId })
  if (!membership) throw new HTTPError({ statusCode: 403, message: 'Organization access required' })
  for (const locationId of new Set([before.locationId, after.locationId])) {
    await assertResourceAccess(db, { env, memberId: membership.memberId, role: membership.role, organizationId: thread.organization_id, siteId: thread.site_id, resourceLocationId: locationId })
  }
  const externalId = `booking-change-request:${thread.id}:${idempotencyKey}`
  let entry = await findEntryByDedupeKey(db, externalId)
  if (entry) {
    const previous = proposalSchema.parse(JSON.parse(entry.payload_json || '{}'))
    if (JSON.stringify(previous.after) !== JSON.stringify(after) || previous.updatedAt !== parsed.data.expectedUpdatedAt) throw new HTTPError({ statusCode: 409, message: 'Request key was reused for different changes' })
  } else {
    if (before.updatedAt !== parsed.data.expectedUpdatedAt) throw new HTTPError({ statusCode: 409, message: 'The reservation changed. Reload before sending a request.' })
    if (JSON.stringify(fieldsSchema.parse(before)) === JSON.stringify(after)) throw new HTTPError({ statusCode: 400, message: 'Choose at least one change' })
    const location = await validateDestination(db, thread, before, after)
    const original = await queryFirst<{ title: string }>(db, 'SELECT title FROM business_locations WHERE id = ? AND site_id = ?', [before.locationId, thread.site_id])
    // Validate delivery configuration before persisting a proposal.
    linkToken(env, thread.id, 'configuration-check')
    if (!summary.guestEmail || !env.NUXT_PUBLIC_PLATFORM_DOMAIN) throw new HTTPError({ statusCode: 503, message: 'Guest email delivery is not configured' })
    entry = await appendEntry(db, { threadId: thread.id, kind: 'operation', actorKind: 'member', actorUserId,
      eventName: 'booking_change.requested', dedupeKey: externalId, body: `Requested ${after.bookingDate} at ${after.bookingTime} for ${after.partySize} guests at ${location.title}.`,
      payloadJson: { before: sourceSchema.parse(before), after, updatedAt: before.updatedAt, locationTitle: location.title, originalLocationTitle: original?.title || location.title },
    })
  }
  const noun = await bookingNoun(db, thread)
  const proposal = proposalSchema.parse(JSON.parse(entry.payload_json || '{}'))
  const url = new URL(`/booking-changes/${thread.id}/${entry.id}`, env.NUXT_PUBLIC_PLATFORM_DOMAIN)
  url.hash = linkToken(env, thread.id, entry.id)
  await deliverEmail(db, env, thread, entry.id, `Please review changes to your ${noun}`,
    `Hi ${summary.guestName},\n\nYour host has requested changes to your ${noun}:\nLocation: ${proposal.locationTitle}\nDate: ${proposal.after.bookingDate}\nTime: ${proposal.after.bookingTime}\nGuests: ${proposal.after.partySize}\n\nReview and accept or decline: ${url.href}\n\nYour ${noun} stays unchanged until you accept. This link expires in 7 days. You can also reply to this email to talk with your host.`, 'requested', proposal, noun)
  await updateThreadProjection(db, thread.id, { conversationState: 'waiting_on_guest' })
}

/** GET only reads the immutable proposal. POST records one idempotent guest decision. */
export async function respondToBookingChange(db: DbClient, env: ChangeEnv, input: { threadId: string; requestId: string; token: string; decision?: 'accept' | 'decline' }) {
  const expected = linkToken(env, input.threadId, input.requestId)
  if (!/^[a-f0-9]{64}$/.test(input.token) || !timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(input.token, 'hex'))) throw new HTTPError({ statusCode: 404, message: 'Change request not found' })
  const entry = await getEntryById(db, input.requestId)
  if (!entry || entry.request_id !== input.threadId || entry.event_name !== 'booking_change.requested') throw new HTTPError({ statusCode: 404, message: 'Change request not found' })
  const thread = await getGuestRequest(db, entry.request_id)
  if (!thread) throw new HTTPError({ statusCode: 404, message: 'Change request not found' })
  const proposal = proposalSchema.parse(JSON.parse(entry.payload_json || '{}'))
  const resultId = `booking-change-decision:${entry.id}`
  let result = await findEntryByDedupeKey(db, resultId)
  if (!result && Date.now() > Date.parse(entry.occurred_at) + 7 * 86400_000) throw new HTTPError({ statusCode: 410, message: 'This change request has expired' })
  const current = await loadSource(db, thread)
  if (!result && JSON.stringify(sourceSchema.parse(current)) !== JSON.stringify(proposal.before)) throw new HTTPError({ statusCode: 409, message: 'This reservation has changed since the request was sent. Ask your host for a new request.' })
  if (!result && input.decision) {
    if (current.completedAt || !['pending', 'confirmed'].includes(current.status)) throw new HTTPError({ statusCode: 409, message: 'This reservation or booking can no longer be changed' })
    const destination = input.decision === 'accept' ? await validateDestination(db, thread, current, proposal.after) : null
    const id = crypto.randomUUID()
    const condition = { sql: `source.id = ? AND source.site_id = ? AND source.updated_at = ? AND source.status IN ('pending', 'confirmed') AND json_extract(source.payload_json, '$.completion.at') IS NULL`, params: [thread.id, thread.site_id, current.updatedAt] as unknown[] }
    if (destination) condition.sql += ' AND /* availability_claim */'
    const now = new Date().toISOString()
    const entryInsert: BatchQuery = {
      query: `INSERT INTO activity_entries
        (id, request_id, kind, scope_kind, actor_kind, event_name, body, payload_json, dedupe_key, sequence, occurred_at, created_at)
        SELECT ?, ?, 'operation', 'request', 'guest', ?, ?, ?, ?,
          (SELECT COALESCE(MAX(sequence), 0) + 1 FROM activity_entries WHERE request_id = ?), ?, ?
        FROM requests source WHERE ${condition.sql}
        ON CONFLICT DO NOTHING`,
      params: [id, thread.id, `booking_change.${input.decision === 'accept' ? 'accepted' : 'declined'}`, `Guest ${input.decision === 'accept' ? 'accepted' : 'declined'} the requested changes.`, JSON.stringify({ requestId: entry.id }), resultId, thread.id, now, now, ...condition.params],
    }
    const queries: BatchQuery[] = [entryInsert]
    if (input.decision === 'accept') queries.push({ query: `UPDATE requests SET booking_date = ?, time_slot = ?, party_size = ?, location_id = ?, updated_at = ?, payload_json = json_set(payload_json, '$.party_size_is_minimum', json('false'))
      WHERE id = ? AND site_id = ? AND EXISTS (SELECT 1 FROM activity_entries WHERE id = ?)`, params: [proposal.after.bookingDate, proposal.after.bookingTime, proposal.after.partySize, proposal.after.locationId, now, thread.id, thread.site_id, id] })
    if (destination) await executeAvailabilityClaim(db, { snapshot: destination.snapshot, date: proposal.after.bookingDate, time: proposal.after.bookingTime, partySize: proposal.after.partySize, statement: entryInsert, following: queries.slice(1) })
    else await executeBatch(db, queries, { operation: 'respond to booking change' })
    result = await findEntryByDedupeKey(db, resultId)
    if (!result) throw new HTTPError({ statusCode: 409, message: 'This reservation changed or is no longer available' })
  }
  // Resolved once and returned, so the guest-facing page names the booking with
  // the same word as the email it arrived from.
  const noun = await bookingNoun(db, thread)
  const summary = await sourceSummary(db, thread)
  if (result && input.decision) {
    const accepted = result.event_name === 'booking_change.accepted'
    await deliverEmail(db, env, thread, result.id, `Your ${noun} change was ${accepted ? 'accepted' : 'declined'}`,
      accepted ? `Your changes are confirmed: ${proposal.after.bookingDate} at ${proposal.after.bookingTime} for ${proposal.after.partySize} guests at ${proposal.locationTitle}.` : `You declined the requested changes. Your original ${noun} remains unchanged.`, accepted ? 'accepted' : 'declined', proposal, noun)
    await updateThreadProjection(db, thread.id, { conversationState: 'resolved' })
  }
  return { type: thread.kind, noun, guestName: summary.guestName, before: fieldsSchema.parse(proposal.before), after: proposal.after, locationTitle: proposal.locationTitle,
    originalLocationTitle: proposal.originalLocationTitle, status: result ? result.event_name === 'booking_change.accepted' ? 'accepted' : 'declined' : 'pending' }
}
