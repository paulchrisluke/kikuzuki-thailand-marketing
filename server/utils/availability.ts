import { HTTPError } from 'nitro'
import { executeBatch, queryAll, queryFirst, type BatchQuery, type DbClient } from '~/server/db'
import { generateReservationTimes, parseOpeningHours, parseSpecialHours, parseRecurringSlots, resolveExperienceScheduleSlots, closureOnDate, datedHours, getDateIntervals, toMinutes, type OpeningHours, type SpecialHours, type RecurringSlots } from '~/shared/reservation-hours'
import { assertCalendarDate, localNow, addLocalDays, localDateTimeToInstant, isValidTimezone } from '~/utils/timezone'
import { isTimeSlotInPast } from '~/server/utils/site-config'

const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const MAX_NOTE_LENGTH = 1000
const MAX_CALENDAR_DAYS = 42

export type AvailabilityOwner =
  | { kind: 'location'; locationId: string }
  | { kind: 'experience'; experienceId: string }

export interface AvailabilityOverride {
  id: string
  organization_id: string
  site_id: string
  owner_type: AvailabilityOwner['kind']
  location_id: string | null
  experience_id: string | null
  override_date: string
  time_slot: string
  status: 'open' | 'closed'
  capacity_override: number | null
  note: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface PublicAvailabilitySlot {
  time_slot: string
  capacity: number | null
  booked: number
  remaining: number | null
  is_closed: boolean
  is_full: boolean
}

export interface PrivateAvailabilitySlot extends PublicAvailabilitySlot {
  override: Pick<
    AvailabilityOverride,
    'id' | 'status' | 'capacity_override' | 'note' | 'updated_at'
  > | null
}

export interface AvailabilityCalendarBooking {
  id: string
  time_slot: string
  party_size: number
  label: string
  status: string
}

export interface AvailabilityCalendarDay {
  date: string
  slots: PrivateAvailabilitySlot[]
  bookings: AvailabilityCalendarBooking[]
}

export interface AvailabilityCalendarOwner {
  owner: AvailabilityOwner
  label: string
  location_id: string
  timezone: string
  days: AvailabilityCalendarDay[]
}

export interface AvailabilityCalendar {
  from: string
  to: string
  owners: AvailabilityCalendarOwner[]
}

export type AvailabilityChange = {
  override_date: string
  time_slot: string
} & (
  | { directive: 'inherit' }
  | {
      directive: 'set'
      status: 'open' | 'closed'
      capacity_override?: number | null
      note?: string | null
    }
)

type AvailabilityOwnerRecord = {
  id: string
  location_id: string
}

export function assertAvailabilityDate(value: string, field = 'date'): void {
  try { assertCalendarDate(value) } catch { throw new HTTPError({ statusCode: 400, statusMessage: `${field} must be a valid YYYY-MM-DD date` }) }
}

function assertAvailabilityChange(change: AvailabilityChange): void {
  assertAvailabilityDate(change.override_date, 'override_date')
  if (!TIME_SLOT_PATTERN.test(change.time_slot)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'time_slot must be in "HH:MM" format' })
  }
  if (change.directive === 'inherit') return
  if (change.status !== 'open' && change.status !== 'closed') {
    throw new HTTPError({ statusCode: 400, statusMessage: 'status must be "open" or "closed"' })
  }
  const capacity = change.capacity_override
  if (capacity !== null && capacity !== undefined && (!Number.isInteger(capacity) || capacity < 0)) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'capacity_override must be a non-negative integer' })
  }
  if ((change.note?.length ?? 0) > MAX_NOTE_LENGTH) {
    throw new HTTPError({ statusCode: 400, statusMessage: `note must not exceed ${MAX_NOTE_LENGTH} characters` })
  }
}

export async function resolveAvailabilityOwner(
  db: DbClient,
  organizationId: string,
  siteId: string,
  owner: AvailabilityOwner,
): Promise<AvailabilityOwnerRecord> {
  const row = owner.kind === 'location'
    ? await queryFirst<AvailabilityOwnerRecord>(db, `
        SELECT id, id AS location_id
        FROM business_locations
        WHERE organization_id = ? AND site_id = ? AND id = ?
      `, [organizationId, siteId, owner.locationId])
    : await queryFirst<AvailabilityOwnerRecord>(db, `
        SELECT id, location_id
        FROM products
        WHERE product_type = 'experience' AND organization_id = ? AND site_id = ? AND id = ?
      `, [organizationId, siteId, owner.experienceId])
  if (!row) throw new HTTPError({ statusCode: 404, statusMessage: 'Availability owner not found' })
  return row
}

function availabilityOwnerStorage(owner: AvailabilityOwner) {
  return owner.kind === 'location'
    ? { table: 'business_locations', column: 'booking_json', path: '$.reservation.overrides', id: owner.locationId, predicate: '' }
    : { table: 'products', column: 'experience_json', path: '$.overrides', id: owner.experienceId, predicate: " AND product_type = 'experience'" }
}

export async function listAvailabilityOverrides(
  db: DbClient,
  siteId: string,
  owner: AvailabilityOwner,
  range: { from?: string; to?: string } = {},
): Promise<AvailabilityOverride[]> {
  if (range.from) assertAvailabilityDate(range.from, 'from')
  if (range.to) assertAvailabilityDate(range.to, 'to')
  if (range.from && range.to && range.from > range.to) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'from must not be after to' })
  }
  const storage = availabilityOwnerStorage(owner)
  return queryAll<AvailabilityOverride>(db, `SELECT day.key || '|' || slot.key AS id, o.organization_id, o.site_id, ? AS owner_type,
    ${owner.kind === 'location' ? 'o.id' : 'NULL'} AS location_id, ${owner.kind === 'experience' ? 'o.id' : 'NULL'} AS experience_id,
    day.key AS override_date, slot.key AS time_slot, json_extract(slot.value, '$.status') AS status,
    json_extract(slot.value, '$.capacity_override') AS capacity_override, json_extract(slot.value, '$.note') AS note,
    json_extract(slot.value, '$.created_at') AS created_at, json_extract(slot.value, '$.updated_at') AS updated_at, json_extract(slot.value, '$.created_by') AS created_by
    FROM ${storage.table} o, json_each(json_extract(o.${storage.column}, ?)) day, json_each(day.value) slot
    WHERE o.site_id = ? AND o.id = ?${storage.predicate} AND (? IS NULL OR day.key >= ?) AND (? IS NULL OR day.key <= ?)
    ORDER BY day.key, slot.key`, [owner.kind, storage.path, siteId, storage.id, range.from ?? null, range.from ?? null, range.to ?? null, range.to ?? null])
}

function calendarDateKeys(from: string, to: string): string[] {
  assertAvailabilityDate(from, 'from')
  assertAvailabilityDate(to, 'to')
  if (from > to) throw new HTTPError({ statusCode: 400, statusMessage: 'from must not be after to' })
  const dates: string[] = []
  const cursor = new Date(`${from}T00:00:00.000Z`)
  while (cursor.toISOString().slice(0, 10) <= to) {
    dates.push(cursor.toISOString().slice(0, 10))
    if (dates.length > MAX_CALENDAR_DAYS) {
      throw new HTTPError({ statusCode: 400, statusMessage: `Calendar ranges may not exceed ${MAX_CALENDAR_DAYS} days` })
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export async function readAvailabilityCalendar(db: DbClient, input: {
  organizationId: string; siteId: string; locationId: string; range: { from: string; to: string }; owner?: AvailabilityOwner
}): Promise<AvailabilityCalendar> {
  const dates = calendarDateKeys(input.range.from, input.range.to)
  const owners = input.owner ? [input.owner] : [
    { kind: 'location', locationId: input.locationId } as const,
    ...(await queryAll<{ id: string }>(db, "SELECT id FROM products WHERE product_type = 'experience' AND organization_id = ? AND site_id = ? AND location_id = ?", [input.organizationId, input.siteId, input.locationId])).map(row => ({ kind: 'experience', experienceId: row.id } as const)),
  ]
  const snapshots = await readAvailability(db, { siteId: input.siteId, owners, dates, includePast: true })
  if (snapshots.some(s => s.row.organization_id !== input.organizationId || s.row.location_id !== input.locationId)) throw new HTTPError({ statusCode: 404, statusMessage: 'Availability owner not found at this location' })
  return { ...input.range, owners: snapshots.map(snapshot => ({
    owner: snapshot.owner, label: snapshot.row.label, location_id: snapshot.row.location_id, timezone: snapshot.timezone,
    days: snapshot.days.map(day => ({ date: day.date, slots: day.slots.map(slot => {
      const override = snapshot.events.find(e => e.kind === 'override' && e.date === day.date && e.time_slot === slot.time_slot)
      return { ...slot, override: override ? { id: override.id, status: override.status as 'open' | 'closed', capacity_override: override.capacity_override, note: override.note, updated_at: override.updated_at } : null }
    }), bookings: snapshot.events.filter(e => e.kind === 'booking' && e.date === day.date).map(e => ({ id: e.id, time_slot: e.time_slot, party_size: e.party_size, label: e.label!, status: e.status })) }))
  })) }
}

export async function setAvailability(
  db: DbClient,
  input: {
    organizationId: string
    siteId: string
    owner: AvailabilityOwner
    changes: AvailabilityChange[]
    actorUserId: string
  },
): Promise<AvailabilityOverride[]> {
  if (input.changes.length === 0) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'At least one availability change is required' })
  }
  const seen = new Set<string>()
  for (const change of input.changes) {
    assertAvailabilityChange(change)
    const key = `${change.override_date}|${change.time_slot}`
    if (seen.has(key)) throw new HTTPError({ statusCode: 400, statusMessage: `Duplicate availability change for ${key}` })
    seen.add(key)
  }
  await resolveAvailabilityOwner(db, input.organizationId, input.siteId, input.owner)

  const now = new Date().toISOString()
  const storage = availabilityOwnerStorage(input.owner)
  const writes = input.changes.map((change): BatchQuery => {
    const path = `${storage.path}."${change.override_date}"."${change.time_slot}"`
    if (change.directive === 'inherit') return {
      query: `UPDATE ${storage.table} SET ${storage.column} = json_remove(${storage.column}, ?), updated_at = ? WHERE id = ? AND organization_id = ? AND site_id = ?${storage.predicate}`,
      params: [path, now, storage.id, input.organizationId, input.siteId],
    }
    return {
      query: `UPDATE ${storage.table} SET ${storage.column} = json_set(${storage.column}, ?, json_object('status', ?, 'capacity_override', ?, 'note', ?, 'created_at', COALESCE(json_extract(${storage.column}, ?), ?), 'updated_at', ?, 'created_by', COALESCE(json_extract(${storage.column}, ?), ?))), updated_at = ? WHERE id = ? AND organization_id = ? AND site_id = ?${storage.predicate}`,
      params: [path, change.status, change.capacity_override ?? null, change.note?.trim() || null, `${path}.created_at`, now, now, `${path}.created_by`, input.actorUserId, now, storage.id, input.organizationId, input.siteId],
    }
  })
  await executeBatch(db, writes, { operation: 'Set availability' })

  const dates = input.changes.map(change => change.override_date).sort()
  return await listAvailabilityOverrides(db, input.siteId, input.owner, {
    from: dates[0],
    to: dates.at(-1),
  })
}

type ScheduleRow = {
  owner_type: AvailabilityOwner['kind']; owner_id: string; organization_id: string; site_id: string
  location_id: string; label: string; opening_hours: string | null; special_hours: string | null
  timezone: string | null; location_status: string
  recurring_slots: string | null; max_capacity: number | null; is_visible: number | null; available: number | null
}
type AvailabilityEvent = {
  kind: 'booking' | 'override'; owner_type: AvailabilityOwner['kind']; owner_id: string; id: string
  date: string; time_slot: string; status: string; capacity_override: number | null
  note: string | null; updated_at: string; party_size: number; label: string | null
}
export type AvailabilitySnapshot = {
  owner: AvailabilityOwner; row: ScheduleRow; timezone: string; hours: OpeningHours; special: SpecialHours; recurring: RecurringSlots
  events: AvailabilityEvent[]; excludeBookingId: string | null
  days: Array<{ date: string; schedule_state: 'unknown' | 'closed' | 'scheduled'; slots: PublicAvailabilitySlot[] }>
}
const scheduleSelect = `
  SELECT 'location' AS owner_type, l.id AS owner_id, l.organization_id, l.site_id, l.id AS location_id,
    l.title AS label, l.opening_hours, l.special_hours, l.timezone,
    l.status AS location_status, NULL AS recurring_slots, l.max_capacity, NULL AS is_visible, NULL AS available
  FROM business_locations l WHERE l.site_id = ? AND l.id IN (SELECT value FROM json_each(?))
  UNION ALL
  SELECT 'experience', p.id, p.organization_id, p.site_id, p.location_id, p.name,
    l.opening_hours, l.special_hours, l.timezone,
    l.status, json_extract(p.experience_json, '$.recurring_slots'), json_extract(p.experience_json, '$.max_capacity'), p.is_visible, p.available
  FROM products p
  JOIN business_locations l ON l.id = p.location_id AND l.site_id = p.site_id AND l.organization_id = p.organization_id
  WHERE p.product_type = 'experience' AND p.site_id = ? AND p.id IN (SELECT value FROM json_each(?))`

export async function readAvailability(db: DbClient, input: {
  siteId: string; owners: AvailabilityOwner[]; dates: string[] | { daysFromToday: number }; includePast?: boolean; excludeBookingId?: string
}): Promise<AvailabilitySnapshot[]> {
  const locationIds = JSON.stringify(input.owners.flatMap(o => o.kind === 'location' ? [o.locationId] : []))
  const experienceIds = JSON.stringify(input.owners.flatMap(o => o.kind === 'experience' ? [o.experienceId] : []))
  const rows = await queryAll<ScheduleRow>(db, scheduleSelect, [input.siteId, locationIds, input.siteId, experienceIds])
  if (rows.length !== input.owners.length) throw new HTTPError({ statusCode: 404, statusMessage: 'Availability owner not found' })
  const snapshots = rows.map((row): AvailabilitySnapshot => {
    const timezone = row.timezone
    if (!isValidTimezone(timezone)) throw new HTTPError({ statusCode: 409, statusMessage: 'Set the location timezone before offering bookings' })
    const dates = Array.isArray(input.dates) ? [...new Set(input.dates)] : Array.from({ length: input.dates.daysFromToday }, (_, i) => addLocalDays(localNow(timezone).date, i))
    dates.forEach(date => assertAvailabilityDate(date))
    return {
      owner: row.owner_type === 'location' ? { kind: 'location', locationId: row.owner_id } : { kind: 'experience', experienceId: row.owner_id },
      row, timezone, hours: parseOpeningHours(row.opening_hours ? JSON.parse(row.opening_hours) : null),
      special: parseSpecialHours(row.special_hours ? JSON.parse(row.special_hours) : null),
      recurring: parseRecurringSlots(row.recurring_slots ? JSON.parse(row.recurring_slots) : null), events: [], excludeBookingId: input.excludeBookingId ?? null,
      days: dates.map(date => ({ date, schedule_state: 'unknown', slots: [] })),
    }
  })
  const dates = JSON.stringify([...new Set(snapshots.flatMap(s => s.days.map(d => d.date)))])
  const events = await queryAll<AvailabilityEvent>(db, `
    SELECT 'override' AS kind, owner_type, owner_id, day.key || '|' || slot.key AS id, day.key AS date, slot.key AS time_slot,
      json_extract(slot.value, '$.status') AS status, json_extract(slot.value, '$.capacity_override') AS capacity_override,
      json_extract(slot.value, '$.note') AS note, json_extract(slot.value, '$.updated_at') AS updated_at, 0 AS party_size, NULL AS label
    FROM (
      SELECT 'location' AS owner_type, id AS owner_id, json_extract(booking_json, '$.reservation.overrides') AS overrides FROM business_locations WHERE site_id = ? AND id IN (SELECT value FROM json_each(?))
      UNION ALL
      SELECT 'experience', id, json_extract(experience_json, '$.overrides') FROM products WHERE site_id = ? AND product_type = 'experience' AND id IN (SELECT value FROM json_each(?))
    ) owners, json_each(owners.overrides) day, json_each(day.value) slot WHERE day.key IN (SELECT value FROM json_each(?))
    UNION ALL
    SELECT 'booking', CASE kind WHEN 'reservation' THEN 'location' ELSE 'experience' END, COALESCE(product_id, location_id), id, booking_date, time_slot, status, NULL, NULL, updated_at, party_size, json_extract(payload_json, '$.guest.name')
    FROM requests WHERE site_id = ? AND ((kind = 'reservation' AND location_id IN (SELECT value FROM json_each(?)) AND status != 'cancelled') OR (kind = 'experience_booking' AND product_id IN (SELECT value FROM json_each(?)) AND status IN ('pending', 'confirmed')))
      AND booking_date IN (SELECT value FROM json_each(?)) AND id IS NOT ?
  `, [input.siteId, locationIds, input.siteId, experienceIds, dates, input.siteId, locationIds, experienceIds, dates, input.excludeBookingId ?? null])
  for (const snapshot of snapshots) {
    snapshot.events = events.filter(e => e.owner_type === snapshot.row.owner_type && e.owner_id === snapshot.row.owner_id)
    snapshot.days = snapshot.days.map(({ date }) => calculateAvailabilityDay(snapshot, date, Boolean(input.includePast)))
  }
  return snapshots
}

function civilTimeExists(date: string, time: string, timezone: string): boolean {
  try { localDateTimeToInstant(date, time, timezone); return true }
  catch (error) { if (error instanceof RangeError) return false; throw error }
}

function calculateAvailabilityDay(snapshot: AvailabilitySnapshot, date: string, includePast: boolean) {
  const { row, hours, special, recurring, timezone } = snapshot
  const periods = getDateIntervals(hours, special, date)
  const scheduled = row.owner_type === 'location' ? generateReservationTimes(hours, date, { specialHours: special }) : resolveExperienceScheduleSlots({ recurring_slots: recurring }, date)
  const events = snapshot.events.filter(e => e.date === date)
  const overrides = new Map(events.filter(e => e.kind === 'override').map(e => [e.time_slot, e]))
  const closed = row.location_status !== 'active' || Boolean(closureOnDate(special, date)) || (row.owner_type === 'experience' && (!row.is_visible || !row.available))
  const hasDated = Boolean(datedHours(special, date))
  const candidates = new Set([...scheduled, ...events.filter(e => includePast || e.kind === 'override' && e.status === 'open').map(e => e.time_slot)])
  const slots = [...candidates].sort().filter(time => includePast || !isTimeSlotInPast(date, time, timezone) && civilTimeExists(date, time, timezone)).map((time_slot): PublicAvailabilitySlot => {
    const override = overrides.get(time_slot)
    const allowed = civilTimeExists(date, time_slot, timezone) && !closed && (!hasDated || (periods ?? []).some(p => p.start <= toMinutes(time_slot) && p.end > toMinutes(time_slot)))
      && (scheduled.includes(time_slot) || override?.status === 'open') && override?.status !== 'closed'
    const capacity = override?.capacity_override ?? row.max_capacity
    const booked = events.filter(e => e.kind === 'booking' && e.time_slot === time_slot).reduce((sum, e) => sum + e.party_size, 0)
    const remaining = capacity === null ? null : capacity - booked
    return { time_slot, capacity, booked, remaining, is_closed: !allowed, is_full: remaining !== null && remaining <= 0 }
  })
  const unknown = row.owner_type === 'location' ? periods === null : recurring === null
  return { date, schedule_state: closed ? 'closed' as const : unknown ? 'unknown' as const : scheduled.length ? 'scheduled' as const : 'closed' as const, slots }
}

function bookingClaimPredicate(snapshot: AvailabilitySnapshot, date: string, time: string, partySize: number): BatchQuery {
  const { row } = snapshot
  const slot = snapshot.days.find(d => d.date === date)?.slots.find(s => s.time_slot === time)
  if (!slot || slot.is_closed || isTimeSlotInPast(date, time, snapshot.timezone) || !civilTimeExists(date, time, snapshot.timezone)) return { query: '0', params: [] }
  const experience = row.owner_type === 'experience'
  const override = snapshot.events.find(e => e.kind === 'override' && e.date === date && e.time_slot === time)
  const path = `${experience ? '$.overrides' : '$.reservation.overrides'}."${date}"."${time}"`
  const document = experience ? 'p.experience_json' : 'l.booking_json'
  const capacity = experience ? "json_extract(p.experience_json, '$.max_capacity')" : 'l.max_capacity'
  return { query: `EXISTS (
    SELECT 1 FROM business_locations l
    ${experience ? "JOIN products p ON p.location_id = l.id AND p.site_id = l.site_id AND p.organization_id = l.organization_id AND p.product_type = 'experience'" : ''}
    WHERE l.id = ? AND l.site_id = ? AND l.organization_id = ?
      AND l.opening_hours IS ? AND l.special_hours IS ? AND l.timezone IS ? AND l.status IS ?
      ${experience ? "AND p.id = ? AND json_extract(p.experience_json, '$.recurring_slots') IS ? AND p.is_visible IS ? AND p.available IS ?" : ''}
      AND json_extract(${document}, ?) IS ? AND json_extract(${document}, ?) IS ? AND json_extract(${document}, ?) IS ?
      AND (COALESCE(json_extract(${document}, ?), ${capacity}) IS NULL OR
        (SELECT COALESCE(SUM(party_size), 0) FROM requests
         WHERE site_id = ? AND kind = ? AND ${experience ? 'product_id' : 'location_id'} = ? AND booking_date = ? AND time_slot = ?
           AND ${experience ? "status IN ('pending', 'confirmed')" : "status != 'cancelled'"} AND id IS NOT ?
        ) + ? <= COALESCE(json_extract(${document}, ?), ${capacity}))
  )`, params: [row.location_id, row.site_id, row.organization_id, row.opening_hours, row.special_hours, row.timezone, row.location_status,
    ...(experience ? [row.owner_id, row.recurring_slots, row.is_visible, row.available] : []),
    `${path}.status`, override?.status ?? null, `${path}.capacity_override`, override?.capacity_override ?? null, `${path}.updated_at`, override?.updated_at ?? null,
    `${path}.capacity_override`, row.site_id, experience ? 'experience_booking' : 'reservation', row.owner_id, date, time, snapshot.excludeBookingId, partySize, `${path}.capacity_override`] }

}

export async function executeAvailabilityClaim(db: DbClient, input: {
  snapshot: AvailabilitySnapshot; date: string; time: string; partySize: number
  statement: BatchQuery; following?: BatchQuery[]
}): Promise<void> {
  if (!input.statement.query.includes('/* availability_claim */')) throw new Error('Booking claim is missing its availability predicate')
  const predicate = bookingClaimPredicate(input.snapshot, input.date, input.time, input.partySize)
  const statement = { query: input.statement.query.replace('/* availability_claim */', predicate.query), params: [...(input.statement.params ?? []), ...(predicate.params ?? [])] }
  await executeBatch(db, [statement, ...(input.following ?? [])], { operation: 'Claim booking availability' })
}
