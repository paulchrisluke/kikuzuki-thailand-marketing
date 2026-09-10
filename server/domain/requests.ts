import { z } from 'zod'
import { queryFirst, type BatchQuery, type DbClient } from '~/server/db'

const guest = z.object({ name: z.string(), email: z.string(), phone: z.string().nullable() })
const bookingPayload = z.object({
  guest,
  party_size_is_minimum: z.boolean(),
  notes: z.string().nullable(),
  ip_hash: z.string().nullable(),
  cancellation: z.object({ token_hash: z.string().nullable(), expires_at: z.string().nullable(), used_at: z.string().nullable() }),
  completion: z.object({ at: z.string().nullable(), source: z.enum(['manual', 'auto']).nullable() }),
  review: z.object({ request_sent_at: z.string().nullable(), reminder_sent_at: z.string().nullable(), submitted_at: z.string().nullable() }),
})
const guestScope = z.object({
  id: z.string(), organization_id: z.string(), site_id: z.string(), location_id: z.string().nullable(),
  product_id: z.string().nullable(), customer_id: z.string().nullable(), review_id: z.string().nullable(),
  conversation_state: z.enum(['needs_attention', 'waiting_on_guest', 'resolved']), resolved_at: z.string().nullable(),
  created_at: z.string(), updated_at: z.string(),
})
const booking = guestScope.extend({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  booking_date: z.string(), time_slot: z.string(), party_size: z.number().int().positive(), payload: bookingPayload,
})
export const guestRequestSchema = z.discriminatedUnion('kind', [
  guestScope.extend({ kind: z.literal('contact'), status: z.null(), payload: z.object({
    guest, subject: z.string().nullable(), message: z.string(), consent_at: z.string().nullable(), ip_hash: z.string().nullable(),
    // Where the message came from, when a form or ChatGPT escalation says so.
    source: z.string().nullable().optional(), route_context: z.string().nullable().optional(),
    suggested_summary: z.string().nullable().optional(), agent_metadata: z.unknown().optional(),
  }) }),
  booking.extend({ kind: z.literal('reservation'), product_id: z.null(), payload: bookingPayload.extend({ guest: guest.extend({ phone: z.string() }) }) }),
  booking.extend({ kind: z.literal('experience_booking'), product_id: z.string() }),
])
export type GuestRequest = z.infer<typeof guestRequestSchema>
export type BookingRequest = Extract<GuestRequest, { kind: 'reservation' | 'experience_booking' }>
export type GuestRequestKind = GuestRequest['kind']
export type BookingPayload = z.infer<typeof bookingPayload>

export function parseGuestRequest(row: Record<string, unknown>): GuestRequest {
  if (typeof row.payload_json !== 'string') throw new Error('Request payload is missing')
  return guestRequestSchema.parse({ ...row, payload: JSON.parse(row.payload_json) })
}

export async function getGuestRequest(db: DbClient, id: string, siteId?: string, kind?: GuestRequestKind): Promise<GuestRequest | null> {
  const row = await queryFirst<Record<string, unknown>>(db, `SELECT * FROM requests WHERE id = ? AND kind IN ('contact', 'reservation', 'experience_booking')${siteId ? ' AND site_id = ?' : ''}${kind ? ' AND kind = ?' : ''}`, [id, ...(siteId ? [siteId] : []), ...(kind ? [kind] : [])])
  return row ? parseGuestRequest(row) : null
}

export function requestInsertQueries(request: GuestRequest): [BatchQuery, BatchQuery] {
  const booking = request.kind !== 'contact'
  return [{
    query: `INSERT INTO requests (id, kind, organization_id, site_id, location_id, product_id, customer_id, review_id, status, booking_date, time_slot, party_size, conversation_state, resolved_at, payload_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params: [request.id, request.kind, request.organization_id, request.site_id, request.location_id, request.product_id, request.customer_id, request.review_id, request.status,
      booking ? request.booking_date : null, booking ? request.time_slot : null, booking ? request.party_size : null,
      request.conversation_state, request.resolved_at, JSON.stringify(request.payload), request.created_at, request.updated_at],
  }, {
    query: `INSERT INTO activity_entries (id, request_id, kind, scope_kind, actor_kind, channel, payload_json, dedupe_key, sequence, occurred_at, created_at)
      SELECT ?, id, 'submission', 'request', 'guest', 'web', json_object('kind', kind), ?, 1, created_at, created_at FROM requests WHERE id = ? AND changes() = 1`,
    params: [crypto.randomUUID(), `request:${request.id}:submission`, request.id],
  }]
}

interface GuestBookingInput { name: string; email: string; phone?: string | null; notes?: string | null; ipHash?: string | null; partySizeIsMinimum?: boolean }
export function bookingPayloadForGuest(input: GuestBookingInput & { phone: string }): BookingPayload & { guest: { phone: string } }
export function bookingPayloadForGuest(input: GuestBookingInput): BookingPayload
export function bookingPayloadForGuest(input: GuestBookingInput): BookingPayload {
  return { guest: { name: input.name, email: input.email, phone: input.phone ?? null }, notes: input.notes ?? null, ip_hash: input.ipHash ?? null,
    party_size_is_minimum: input.partySizeIsMinimum ?? false, cancellation: { token_hash: null, expires_at: null, used_at: null },
    completion: { at: null, source: null }, review: { request_sent_at: null, reminder_sent_at: null, submitted_at: null } }
}

export function requestActions(request: GuestRequest): string[] {
  if (request.kind === 'contact' || request.status === 'cancelled' || request.status === 'completed') return []
  if (request.status === 'pending') return ['confirm', 'cancel']
  return ['complete', 'cancel']
}

export function requestPreview(request: GuestRequest): string {
  return (request.kind === 'contact' ? request.payload.message : request.payload.notes || `${request.booking_date} ${request.time_slot} · ${request.party_size}${request.payload.party_size_is_minimum ? '+' : ''} guests`).replace(/\s+/g, ' ').trim().slice(0, 160)
}

export async function requestSummary(db: DbClient, request: GuestRequest) {
  const labels = await queryFirst<{ location_title: string | null; product_title: string | null }>(db, `SELECT l.title AS location_title, p.name AS product_title FROM requests r LEFT JOIN business_locations l ON l.id = r.location_id LEFT JOIN products p ON p.id = r.product_id WHERE r.id = ?`, [request.id])
  return { guestName: request.payload.guest.name, guestEmail: request.payload.guest.email, guestPhone: request.payload.guest.phone,
    organizationId: request.organization_id, siteId: request.site_id, locationId: request.location_id, locationTitle: labels?.location_title ?? null,
    productTitle: labels?.product_title ?? null, contextLabel: requestPreview(request), createdAt: request.created_at, operationalStatus: request.status }
}

export async function cancelBookingRequest(db: DbClient, input: { id: string; siteId: string; kind: BookingRequest['kind']; tokenHash: string; now: string }): Promise<{ request: BookingRequest; wasConfirmed: boolean } | null> {
  const current = await getGuestRequest(db, input.id, input.siteId, input.kind)
  if (!current || current.kind === 'contact' || !['pending', 'confirmed'].includes(current.status)) return null
  const row = await queryFirst<Record<string, unknown>>(db, `UPDATE requests SET status = 'cancelled',
    payload_json = json_set(payload_json, '$.cancellation.used_at', ?), updated_at = ?
    WHERE id = ? AND site_id = ? AND kind = ? AND status = ? AND json_extract(payload_json, '$.cancellation.token_hash') = ?
      AND json_extract(payload_json, '$.cancellation.used_at') IS NULL AND json_extract(payload_json, '$.cancellation.expires_at') > ? RETURNING *`,
  [input.now, input.now, input.id, input.siteId, input.kind, current.status, input.tokenHash, input.now])
  if (!row) return null
  const request = parseGuestRequest(row)
  if (request.kind === 'contact') throw new Error('Cancellation returned a contact request')
  return { request, wasConfirmed: current.status === 'confirmed' }
}
