import assert from 'node:assert/strict'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import * as schema from '../../server/db/schema.ts'
import { bookingPayloadForGuest, requestInsertQueries } from '../../server/domain/requests.ts'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { readAvailability, executeAvailabilityClaim, readAvailabilityCalendar, setAvailability, type AvailabilitySnapshot } from '../../server/utils/availability.ts'

const date = '2099-01-05'
test('D1 booking claims preserve schedule decisions, enforce current capacity, and keep commitments visible', async () => {
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'availability-proof', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' } } },
    env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await runtime.getD1Database('DB')
    await db.batch((await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema))).map(statement => db.prepare(statement)))
    for (const statement of [
      "INSERT INTO organization (id, name, slug) VALUES ('org-proof', 'Proof', 'proof')",
      "INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('site-proof', 'org-proof', 'proof', 'proof')",
      "INSERT INTO user (id, name, email) VALUES ('user-proof', 'Proof Owner', 'owner@proof.example')",
      "INSERT INTO business_locations (id, organization_id, site_id, slug, title, timezone, max_capacity) VALUES ('location-proof', 'org-proof', 'site-proof', 'proof', 'Proof', 'Asia/Bangkok', 2)",
      "INSERT INTO product_categories (id, organization_id, site_id, location_id, product_type, name, slug, sort_order, created_by, updated_by) VALUES ('category-proof', 'org-proof', 'site-proof', 'location-proof', 'experience', 'Experiences', 'experiences', 0, 'user-proof', 'user-proof')",
      "INSERT INTO products (id, organization_id, site_id, location_id, name, slug, product_type, category_id, created_by, updated_by, sort_order, experience_json) VALUES ('experience-proof', 'org-proof', 'site-proof', 'location-proof', 'Proof', 'proof', 'experience', 'category-proof', 'user-proof', 'user-proof', 0, '{\"recurring_slots\":{\"monday\":[\"15:00\"]},\"max_capacity\":2}')",
    ]) await db.prepare(statement).run()
    const hours = JSON.stringify({ periods: [{ open: { day: 1, hour: 16, minute: 0 }, close: { day: 1, hour: 22, minute: 0 } }] })
    await db.prepare('UPDATE business_locations SET opening_hours = ?').bind(hours).run()
    const read = async (experience = false, dates = [date]) => (await readAvailability(db, { siteId: 'site-proof', owners: [experience ? { kind: 'experience', experienceId: 'experience-proof' } : { kind: 'location', locationId: 'location-proof' }], dates }))[0]!
    const claim = async (snapshot: AvailabilitySnapshot, id: string, time = '16:00', guests = 1) => {
      const now = new Date().toISOString()
      const experience = snapshot.row.owner_type === 'experience'
      const [statement, ...following] = requestInsertQueries({ id, kind: experience ? 'experience_booking' : 'reservation',
        organization_id: 'org-proof', site_id: 'site-proof', location_id: 'location-proof', product_id: experience ? 'experience-proof' : null,
        customer_id: null, review_id: null, booking_date: date, time_slot: time, party_size: guests, status: 'confirmed',
        conversation_state: 'needs_attention', resolved_at: null, created_at: now, updated_at: now,
        payload: bookingPayloadForGuest({ name: 'Guest', email: 'guest@proof.example', phone: '+66812345678' }) })
      statement.query = statement.query.replace(/VALUES \(([^)]+)\)/, 'SELECT $1 WHERE /* availability_claim */')
      await executeAvailabilityClaim(db, { snapshot, date, time, partySize: guests, statement, following })
      return db.prepare('SELECT id FROM requests WHERE id=?').bind(id).first('id')
    }
    assert.equal((await read(true)).days[0]!.slots.find(s => s.time_slot === '15:00')?.is_closed, false)
    const claimExperience = (snapshot: AvailabilitySnapshot, id: string) => claim(snapshot, id, '15:00')
    const override = (experience: boolean, directive: 'set' | 'inherit') => setAvailability(db, {
      organizationId: 'org-proof', siteId: 'site-proof', actorUserId: 'user-proof',
      owner: experience ? { kind: 'experience', experienceId: 'experience-proof' } : { kind: 'location', locationId: 'location-proof' },
      changes: [{ directive, override_date: date, time_slot: experience ? '15:00' : '16:00', status: 'open' }],
    })
    for (const column of ['is_visible', 'available']) {
      const snapshot = await read(true)
      await db.prepare(`UPDATE products SET ${column} = 0`).run()
      assert.equal(await claimExperience(snapshot, `experience-${column}`), null)
      await db.prepare(`UPDATE products SET ${column} = 1`).run()
    }
    const priorRecurrence = await read(true)
    await db.prepare("UPDATE products SET experience_json = json_set(experience_json, '$.recurring_slots', json(?))").bind('{"monday":["16:00"]}').run()
    assert.equal(await claimExperience(priorRecurrence, 'recurrence-race'), null)
    await db.prepare("UPDATE products SET experience_json = json_set(experience_json, '$.recurring_slots', json(?))").bind('{"monday":["15:00"]}').run()
    await db.prepare('UPDATE business_locations SET special_hours = ?').bind(JSON.stringify([{ kind: 'hours', date, periods: [{ open_time: '16:00', close_time: '20:00', close_day_offset: 0 }], note: null }])).run()
    assert.equal((await read(true)).days[0]!.slots[0]?.is_closed, true)
    await override(true, 'set')
    assert.equal(await claimExperience(await read(true), 'excluded-open-override'), null)
    await db.prepare('UPDATE business_locations SET special_hours = NULL').run()
    await override(true, 'inherit')
    const exCapacity = await read(true)
    await db.prepare("UPDATE products SET experience_json = json_set(experience_json, '$.max_capacity', 1)").run()
    assert.equal((await Promise.all([claimExperience(exCapacity, 'experience-winner-one'), claimExperience(exCapacity, 'experience-winner-two')])).filter(Boolean).length, 1)
    await db.prepare("DELETE FROM requests WHERE kind='experience_booking'").run()
    const beforeConfig = await read()
    await db.prepare("UPDATE sites SET settings_json=json_set(settings_json, '$.config.default_timezone', 'UTC')").run()
    assert.equal(await claim(beforeConfig, 'config-independent'), 'config-independent')
    await db.prepare("DELETE FROM requests WHERE id = 'config-independent'").run()
    await db.prepare("UPDATE sites SET settings_json=json_remove(settings_json, '$.config.default_timezone')").run()
    const original = await read()
    await db.prepare('UPDATE business_locations SET special_hours = ?').bind(JSON.stringify([{ kind: 'closure', starts_on: date, ends_on: null, note: null }])).run()
    assert.equal(await claim(original, 'closed-race'), null)
    assert.equal((await read(true)).days[0]!.slots[0]?.is_closed, true)
    await db.prepare('UPDATE business_locations SET special_hours = NULL').run()
    const beforeCapacity = await read()
    await db.prepare('UPDATE business_locations SET max_capacity = 1').run()
    const results = await Promise.all([claim(beforeCapacity, 'winner-one'), claim(beforeCapacity, 'winner-two')])
    assert.equal(results.filter(Boolean).length, 1)
    await db.prepare("DELETE FROM requests WHERE kind='reservation'").run()
    const beforeOverride = await read()
    await override(false, 'set')
    assert.equal(await claim(beforeOverride, 'override-created-race'), null)
    const withOverride = await read()
    await override(false, 'inherit')
    assert.equal(await claim(withOverride, 'override-deleted-race'), null)
    for (const [column, value] of [['opening_hours', null], ['timezone', 'UTC'], ['status', 'inactive']]) {
      const snapshot = await read()
      await db.prepare(`UPDATE business_locations SET ${column} = ?`).bind(value).run()
      assert.equal(await claim(snapshot, `changed-${column}`), null)
      await db.prepare("UPDATE business_locations SET opening_hours = ?, timezone = 'Asia/Bangkok', status = 'active'").bind(hours).run()
    }
    const last = await read()
    assert.equal(await claim(last, 'commitment'), 'commitment')
    const moved = (await readAvailability(db, { siteId: 'site-proof', owners: [{ kind: 'location', locationId: 'location-proof' }], dates: [date], excludeBookingId: 'commitment' }))[0]!
    const accept = async (snapshot: AvailabilitySnapshot) => executeAvailabilityClaim(db, { snapshot, date, time: '16:00', partySize: 1, statement: {
      query: `INSERT INTO activity_entries (id, request_id, kind, scope_kind, actor_kind, event_name, dedupe_key, sequence, occurred_at)
        SELECT 'acceptance-proof', 'commitment', 'operation', 'request', 'guest', 'booking_change.accepted', 'acceptance-proof', 2, '2099-01-01T00:00:00Z' WHERE /* availability_claim */`, params: [],
    }, following: [{ query: "UPDATE requests SET payload_json=json_set(payload_json, '$.notes', 'Accepted') WHERE id = 'commitment' AND EXISTS (SELECT 1 FROM activity_entries WHERE id = 'acceptance-proof')", params: [] }] })
    await db.prepare('UPDATE business_locations SET special_hours = ?').bind(JSON.stringify([{ kind: 'closure', starts_on: date, ends_on: null, note: null }])).run()
    await accept(moved)
    assert.equal(await db.prepare("SELECT id FROM activity_entries WHERE id = 'acceptance-proof'").first('id'), null)
    assert.equal(await db.prepare("SELECT json_extract(payload_json, '$.notes') AS notes FROM requests WHERE id = 'commitment'").first('notes'), null)
    await db.prepare('UPDATE business_locations SET special_hours = NULL').run()
    const reopened = (await readAvailability(db, { siteId: 'site-proof', owners: [{ kind: 'location', locationId: 'location-proof' }], dates: [date], excludeBookingId: 'commitment' }))[0]!
    await accept(reopened)
    assert.equal(await db.prepare("SELECT json_extract(payload_json, '$.notes') AS notes FROM requests WHERE id = 'commitment'").first('notes'), 'Accepted')
    await db.prepare('UPDATE business_locations SET opening_hours = ?').bind('{"periods":[]}').run()
    const calendar = await readAvailabilityCalendar(db, { organizationId: 'org-proof', siteId: 'site-proof', locationId: 'location-proof', owner: { kind: 'location', locationId: 'location-proof' }, range: { from: date, to: date } })
    assert.equal(calendar.owners[0]!.days[0]!.slots[0]?.is_closed, true)
    assert.equal(calendar.owners[0]!.days[0]!.bookings[0]?.id, 'commitment')
    await db.prepare("UPDATE business_locations SET timezone = 'America/New_York', opening_hours = ?").bind(JSON.stringify({ periods: [{ open: { day: 0, hour: 0, minute: 0 } }] })).run()
    const spring = await read(false, ['2099-03-08'])
    assert.equal(spring.days[0]!.slots.some(s => s.time_slot === '02:30'), false)
    const autumn = await read(false, ['2099-11-01'])
    assert.equal(autumn.days[0]!.slots.filter(s => s.time_slot === '01:30').length, 1)
    await db.prepare("UPDATE sites SET settings_json=json_set(settings_json, '$.config.default_timezone', 'UTC')").run()
    await db.prepare('UPDATE business_locations SET timezone = NULL').run()
    await assert.rejects(() => read(), /timezone/)
  } finally { await runtime.dispose() }
})