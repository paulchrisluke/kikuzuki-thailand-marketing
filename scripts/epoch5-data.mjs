#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import Database from 'better-sqlite3'
import { marked } from 'marked'
import { CONTENT_DOCUMENT_SCOPE_QUERY, MEDIA_PLACEMENT_OWNER_AUDIT_QUERY } from './audit-orphaned-media-placements.mjs'

const REMOVED = {
  sites: ['primary_location_id', 'theme', 'custom_domain', 'custom_domain_status', 'public_url'],
  business_locations: ['is_primary', 'facebook_page_id', 'facebook_connection_id', 'attributes'], experiences: ['time_slots'],
  customers: ['marketing_opted_out_at', 'loyalty_points_balance'],
  contact_submissions: ['status'], platform_contact_submissions: ['status'],
  chowbot_channel_state: ['selected_site_id', 'active_conversation_id', 'pending_message_id'],
  posts: ['cta_type', 'cta_url', 'event_title', 'event_start', 'event_end', 'offer_coupon', 'offer_terms'],
  organization_billing: ['stripe_customer_id', 'stripe_subscription_id'],
  site_transfer_requests: ['custom_domains_snapshot', 'custom_domains_removed_at'],
  oauthClient: ['scopesJson', 'requirePkce'], account: ['expiresAt'],
  oauthRefreshToken: ['accessTokenId'], subscription: ['limits', 'createdAt', 'updatedAt'],
}
const ADDED = { content_documents: ['site_id'], posts: ['call_to_action', 'event', 'offer', 'alert_type'], oauthClient: ['requirePKCE'], reviews: ['google_review_metadata'] }
const ARCHIVED_TABLES = ['canary_runs', 'chowbot_conversations', 'chowbot_messages', 'platform_locale_catalogs', 'platform_locale_messages']
const RETIRED_TABLES = ['dashboard_preferences', 'themes', ...ARCHIVED_TABLES]
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const THAI_DAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
const TIME_COLUMNS = { resource_localizations: ['created_at', 'updated_at'] }
const EPOCH4_SCHEMA_SHA256 = 'cd62201f995370ec67f94cfa3ab322caa3434ebde0dac2bafe6521bc07fc2b7e'
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const qi = value => `"${value.replaceAll('"', '""')}"`
const rows = (db, table) => db.prepare(`SELECT * FROM ${qi(table)}`).all()
const columns = (db, table) => db.prepare(`PRAGMA table_info(${qi(table)})`).all().map(column => column.name)
const tables = db => db.prepare("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name").all().map(row => row.name).filter(name => !['d1_migrations', '__drizzle_migrations'].includes(name) && !name.startsWith('sqlite_') && !name.startsWith('_cf_'))
const hash = value => createHash('sha256').update(value).digest('hex')
const hashRows = (records, names) => hash(records.map(record => JSON.stringify(names.map(name => record[name]))).sort().join('\n'))
const json = value => value === null ? null : JSON.parse(value)
const serialize = value => value === null ? null : JSON.stringify(value)
const validZone = value => { try { return typeof value === 'string' && Boolean(new Intl.DateTimeFormat('en', { timeZone: value })) } catch { return false } }
const schemaHash = db => hash(JSON.stringify(db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND tbl_name NOT IN ('d1_migrations','__drizzle_migrations') ORDER BY type,name").all().map(row => ({ ...row, sql: row.sql.trim().replace(/\s+/g, ' ') }))))

export function openDatabase(path) {
  if (!path.endsWith('.sql')) return new Database(path, { readonly: true, fileMustExist: true })
  const db = new Database(':memory:')
  db.pragma('foreign_keys = OFF')
  db.exec(readFileSync(path, 'utf8'))
  return db
}

export function historicalArchive(source) {
  return {
    source_epoch: 4,
    source_schema_sha256: schemaHash(source),
    tables: tables(source).map(table => {
      const names = columns(source, table)
      const query = `SELECT *, ${names.map((name, index) => `typeof(${qi(name)}) AS ${qi(`_archive_type_${index}`)}`).join(', ')} FROM ${qi(table)}`
      const records = source.prepare(query).safeIntegers().all().map(row => names.map((name, index) => {
        const type = row[`_archive_type_${index}`]
        const value = type === 'integer' ? row[name].toString() : type === 'blob' ? row[name].toString('hex') : row[name]
        return [type, value]
      })).sort((a, b) => JSON.stringify(a) < JSON.stringify(b) ? -1 : JSON.stringify(a) > JSON.stringify(b) ? 1 : 0)
      return { table, columns: names, records, sha256: hash(JSON.stringify(records)) }
    }),
  }
}

export function verifyHistoricalArchive(source, archive) {
  const expected = historicalArchive(source)
  assert(JSON.stringify(archive) === JSON.stringify(expected), 'Historical archive differs from exact typed source records')
  return expected.tables.map(({ table, records, sha256 }) => ({ table, rows: records.length, sha256 }))
}

const SOURCE_PAGE_QUERY = `SELECT p.id FROM tenant_pages p WHERE NOT EXISTS (
  SELECT 1 FROM site_locales l JOIN tenant_page_variants v
    ON v.site_id = l.site_id AND v.organization_id = l.organization_id AND v.locale = l.locale
   JOIN content_documents d ON d.id = v.document_id AND d.owner_type = 'tenant_page' AND d.owner_id = v.id
   WHERE l.site_id = p.site_id AND l.organization_id = p.organization_id AND l.locale = 'en' AND l.is_source = 1
     AND v.page_id = p.id
)`
const LOCALIZED_OWNER_TABLES = {
  site: 'sites', business_location: 'business_locations', product: 'products', product_category: 'product_categories',
  offering: 'offerings', media_asset: 'media_assets',
}
export const TARGET_INVARIANT_QUERIES = {
  media_owner_scope: MEDIA_PLACEMENT_OWNER_AUDIT_QUERY,
  document_owner_scope: `WITH scope AS (${CONTENT_DOCUMENT_SCOPE_QUERY}) SELECT d.id FROM content_documents d WHERE (SELECT count(*) FROM scope s WHERE s.id = d.id) <> 1`,
  editorial_representation_scope: `SELECT d.id FROM content_documents d WHERE d.row_role = 'representation' AND NOT EXISTS (
    SELECT 1 FROM content_documents r WHERE r.id = d.root_id AND r.row_role = 'root' AND r.locale = 'en'
      AND r.kind = d.kind AND r.organization_id = d.organization_id AND r.site_id = d.site_id
  )`,
  english_source_locale: `SELECT s.id FROM sites s WHERE NOT EXISTS (SELECT 1 FROM site_locales l WHERE l.site_id = s.id AND l.organization_id = s.organization_id AND l.locale = 'en' AND l.is_source = 1)`,
  block_parent_scope: `SELECT b.id FROM content_blocks b WHERE b.parent_block_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM content_blocks p WHERE p.id = b.parent_block_id AND p.document_id = b.document_id)`,
  block_cycles: `WITH RECURSIVE ancestors(origin, id, parent_id, depth) AS (
    SELECT id, id, parent_block_id, 0 FROM content_blocks
    UNION ALL SELECT a.origin, p.id, p.parent_block_id, a.depth + 1 FROM ancestors a
      JOIN content_blocks p ON p.id = a.parent_id WHERE a.depth < (SELECT count(*) FROM content_blocks)
  ) SELECT DISTINCT origin FROM ancestors WHERE depth > 0 AND id = origin`,
  localized_resource_owner_scope: `SELECT r.id FROM resource_localizations r WHERE NOT (
    ${Object.entries(LOCALIZED_OWNER_TABLES).map(([type, table]) => `(r.resource_type = '${type}' AND EXISTS (SELECT 1 FROM ${table} o WHERE o.id = r.resource_id AND o.organization_id = r.organization_id AND ${type === 'site' ? 'o.id' : 'o.site_id'} = r.site_id))`).join(' OR ')}
  )`,
  activity_request_scope: `SELECT e.id FROM activity_entries e WHERE e.scope_kind = 'request' AND NOT EXISTS (
    SELECT 1 FROM requests r WHERE r.id = e.request_id AND r.kind IN ('contact','reservation','experience_booking')
  )`,
  experience_product_scope: `SELECT r.id FROM requests r WHERE r.kind = 'experience_booking' AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.id = r.product_id AND p.product_type = 'experience'
      AND p.organization_id = r.organization_id AND p.site_id = r.site_id AND p.location_id = r.location_id
  )`,
}

export function auditTargetInvariants(target) {
  return Object.entries(TARGET_INVARIANT_QUERIES).map(([name, query]) => ({ name, violations: target.prepare(query).all().reduce((total, row) => total + Number(row.orphaned_count ?? 1), 0), sql_sha256: hash(query) }))
}

function minute(value) {
  assert(typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value), 'Invalid minute time')
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}
const point = (day, value) => ({ day, hour: Math.floor(value / 60), minute: value % 60 })
function period(day, start, end, closeDay) {
  const close = closeDay ?? (end <= start ? (day + 1) % 7 : day)
  return { open: point(day, start), close: point(close, end) }
}
function weekday(value) {
  const index = DAYS.indexOf(String(value).toLowerCase())
  assert(index !== -1, 'Unknown weekday')
  return index
}
function proseHours(lines, thai = false) {
  assert(Array.isArray(lines) && lines.length === 7, 'Hours prose must account for all seven days')
  const periods = [], seen = new Set()
  for (const line of lines) {
    const normalized = line.replace(/[\u2009\u202f]/g, ' ').trim()
    const match = thai ? /^(วัน\S+)\s+(.+)$/.exec(normalized) : /^(\w+):\s*(.+)$/.exec(normalized)
    assert(match, 'Unknown hours prose')
    const day = thai ? THAI_DAYS.indexOf(match[1]) : weekday(match[1])
    assert(day >= 0 && !seen.has(day), 'Duplicate or unknown hours day')
    seen.add(day)
    if (match[2] === (thai ? 'ปิด' : 'Closed')) continue
    assert(match[2] !== 'Open 24 hours', '24-hour prose requires an explicit reviewed period projection')
    if (thai) {
      const range = /^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})\s*น\.$/.exec(match[2])
      assert(range, 'Unknown Thai hours range')
      periods.push(period(day, minute(range[1]), minute(range[2])))
    } else {
      for (const shift of match[2].split(/,\s*/)) {
        const range = /^(\d{1,2}:\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}:\d{2})\s*(AM|PM)$/.exec(shift)
        assert(range, 'Ambiguous AM/PM hours require same-owner localized evidence')
        const parse = (time, meridiem) => { const [h, m] = time.split(':').map(Number); assert(h >= 1 && h <= 12 && m < 60, 'Invalid AM/PM time'); return (h % 12 + (meridiem === 'PM' ? 12 : 0)) * 60 + m }
        periods.push(period(day, parse(range[1], range[2]), parse(range[3], range[4])))
      }
    }
  }
  return { periods: periods.sort((a, b) => a.open.day - b.open.day || a.open.hour - b.open.hour || a.open.minute - b.open.minute) }
}

export function weeklyMinutes(hours) {
  if (hours === null) return null
  const result = new Set()
  for (const entry of hours.periods) {
    const start = entry.open.day * 1440 + entry.open.hour * 60 + entry.open.minute
    let end = entry.close ? entry.close.day * 1440 + entry.close.hour * 60 + entry.close.minute : start + 10080
    if (end <= start) end += 10080
    for (let value = start; value < end; value++) { assert(!result.has(value % 10080), 'Overlapping weekly hours'); result.add(value % 10080) }
  }
  return [...result].sort((a, b) => a - b)
}

export function convertHours(raw, localized = []) {
  let value = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return raw.split('\n') } })() : raw
  if (value === null) return null
  if (Array.isArray(value) && value.length > 0 && value.every(line => typeof line === 'string')) value = { weekdayDescriptions: value }
  let output
  if (Array.isArray(value)) {
    output = { periods: value.map(entry => {
      assert(Object.keys(entry).every(key => ['openDay', 'openTime', 'closeDay', 'closeTime'].includes(key)), 'Unknown structured hours key')
      return period(weekday(entry.openDay), minute(entry.openTime), minute(entry.closeTime), entry.closeDay === undefined ? undefined : weekday(entry.closeDay))
    }) }
  } else {
    assert(value && Object.keys(value).length === 1 && Array.isArray(value.weekdayDescriptions), 'Unknown legacy hours representation')
    try { output = proseHours(value.weekdayDescriptions) } catch (error) {
      const matches = localized.filter(entry => entry.locale === 'th' && Array.isArray(entry.hours))
      assert(matches.length === 1, error.message)
      output = proseHours(matches[0].hours, true)
      for (const line of value.weekdayDescriptions) {
        const match = /^(\w+):\s*(.*)$/.exec(line.replace(/[\u2009\u202f]/g, ' '))
        assert(match, 'Unknown corroborated English hours')
        const day = weekday(match[1]), periods = output.periods.filter(entry => entry.open.day === day)
        if (match[2] === 'Closed') { assert(periods.length === 0, 'English and Thai closed days disagree'); continue }
        const range = /^(\d{1,2}):([0-5]\d)\s*[–-]\s*(\d{1,2}):([0-5]\d)\s*PM$/.exec(match[2])
        assert(range && periods.length === 1, 'Unsupported ambiguous hours')
        const entry = periods[0]
        assert(entry.open.hour % 12 === Number(range[1]) % 12 && entry.open.minute === Number(range[2]) && entry.close.hour === Number(range[3]) % 12 + 12 && entry.close.minute === Number(range[4]), 'English and Thai endpoint evidence disagrees')
      }
    }
  }
  weeklyMinutes(output)
  for (const entry of localized) {
    assert(entry.locale === 'th', 'Unmapped hours localization')
    assert(JSON.stringify(weeklyMinutes(output)) === JSON.stringify(weeklyMinutes(proseHours(entry.hours, true))), 'Localized hours differ from canonical weekly minutes')
  }
  return output
}

function recurring(row) {
  const old = json(row.recurring_slots), flat = json(row.time_slots)
  if (old === null && flat === null) return null
  const output = {}
  if (old !== null) {
    assert(!Array.isArray(old) && typeof old === 'object', 'Invalid recurring slots object')
    for (const [key, times] of Object.entries(old)) { const day = DAYS[weekday(key)]; assert(!(day in output), 'Duplicate normalized recurring day'); output[day] = times }
  } else { assert(Array.isArray(flat), 'Invalid flat time slots'); for (const day of DAYS) output[day] = flat }
  for (const times of Object.values(output)) { assert(Array.isArray(times), 'Invalid recurring day slots'); times.forEach(minute); assert(new Set(times).size === times.length, 'Duplicate recurring time') }
  return Object.fromEntries(DAYS.filter(day => day in output).map(day => [day, [...output[day]].sort()]))
}

function iso(value) {
  if (value === null) return null
  if (/^\d+(?:\.\d+)?$/.test(String(value))) { const milliseconds = Number(value) * 1000; assert(Number.isSafeInteger(milliseconds), 'Timestamp precision loss'); return new Date(milliseconds).toISOString() }
  assert(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*Z$/.test(value) && Number.isFinite(Date.parse(value)), 'Unsupported text timestamp')
  return value
}

function draftPayload(raw) {
  const payload = JSON.parse(raw)
  assert(payload.version === 2 && payload.source && payload.preview, 'Unmapped onboarding draft version')
  const details = payload.source.details
  details.openingHours = convertHours(details.openingHours)
  delete details.isPrimary
  if (payload.source.place !== null) throw new Error('Google-source onboarding draft requires explicit provider-field projection')
  if (payload.preview.draftMedia) {
    assert(!payload.preview.media, 'Draft has two media representations')
    payload.preview.media = Object.entries(payload.preview.draftMedia).map(([slot, asset]) => {
      assert(['logo', 'hero'].includes(slot), 'Unknown draft media slot')
      const { category, ...retained } = asset
      assert(category === 'logo' || category === 'other', 'Unmapped draft asset category')
      return { slot, asset: retained }
    })
    delete payload.preview.draftMedia
  }
  for (const location of payload.preview.locations) {
    location.opening_hours = convertHours(location.opening_hours)
    assert(location.special_hours == null, 'Unmapped draft special hours')
    location.special_hours = null
    delete location.is_primary
    for (const field of ['hero_url', 'thumbnail_url']) {
      assert(location[field] == null || payload.preview.media.some(entry => entry.slot === 'hero' && [entry.asset.publicUrl, entry.asset.thumbnailUrl].includes(location[field])), 'Draft location media URL lacks retained hero asset')
      delete location[field]
    }
  }
  return JSON.stringify(payload)
}

export function project(source, evidence = {}) {
  assert(schemaHash(source) === EPOCH4_SCHEMA_SHA256, 'Source schema differs from audited immutable Epoch 4 baseline')
  assert(columns(source, 'business_locations').includes('is_primary') && columns(source, 'oauthClient').includes('scopesJson'), 'Source is not Epoch 4')
  assert(source.pragma('foreign_key_check').length === 0, 'Source has foreign key violations')
  assert(source.prepare(SOURCE_PAGE_QUERY).all().length === 0, 'Source tenant pages are missing their canonical English variant')
  const data = Object.fromEntries(tables(source).map(table => [table, rows(source, table)]))
  const changed = [], discarded = [], discardedRows = [], unresolved = [], derived = []
  const folded = {}
  const change = (table, row, key, value, reason) => {
    if (row[key] === value) return
    changed.push({ table, id: row.id ?? null, key, reason, before_hash: hash(JSON.stringify(row[key])), after_hash: hash(JSON.stringify(value)) })
    row[key] = value
  }
  const sourceData = structuredClone(data)
  data.media_placements = data.media_placements.filter(placement => {
    if (placement.owner_type !== 'content_block' || data.content_blocks.some(block => block.id === placement.owner_id)) return true
    const match = /^(.+):media:(\d+)$/.exec(placement.owner_id)
    const parent = match && data.content_blocks.find(block => block.id === match[1] && block.type === 'markdown')
    const asset = data.media_assets.find(asset => asset.id === placement.asset_id && asset.organization_id === placement.organization_id && asset.site_id === placement.site_id)
    assert(parent && asset && typeof asset.public_url === 'string' && typeof json(parent.data_json).markdown === 'string', 'Orphan placement lacks exact retained Markdown and media evidence')
    let imageRetained = false
    marked.walkTokens(marked.lexer(json(parent.data_json).markdown), token => { if (token.type === 'image' && token.href === asset.public_url) imageRetained = true })
    assert(imageRetained, 'Orphan placement lacks exact retained Markdown and media evidence')
    discardedRows.push({ table: 'media_placements', id: placement.id, row_sha256: hashRows([placement], columns(source, 'media_placements')), parent_block_id: parent.id, parent_payload_sha256: hash(parent.data_json), asset_id: asset.id, asset_row_sha256: hashRows([asset], columns(source, 'media_assets')), reason: 'Obsolete synthetic Markdown media owner has no content_blocks row; exact inline image URL, Markdown bytes and asset remain unchanged; no reattachment' })
    return false
  })
  for (const [table, names] of Object.entries(REMOVED)) for (const key of names) discarded.push({ table, column: key, rows: data[table].length, non_null: data[table].filter(row => row[key] !== null).length, hash: hashRows(data[table], ['id', key]) })
  const archived = historicalArchive(source).tables.map(({ table, records, sha256 }) => ({ table, rows: records.length, sha256 }))
  for (const table of RETIRED_TABLES) {
    if (!ARCHIVED_TABLES.includes(table)) discarded.push({ table, rows: data[table].length, hash: hashRows(data[table], columns(source, table)) })
    delete data[table]
  }
  for (const [table, fields] of [['account', ['expiresAt']], ['oauthRefreshToken', ['accessTokenId']], ['subscription', ['limits']], ['site_transfer_requests', ['custom_domains_snapshot', 'custom_domains_removed_at']], ['business_locations', ['facebook_page_id', 'facebook_connection_id']], ['chowbot_channel_state', ['selected_site_id', 'active_conversation_id', 'pending_message_id']]]) for (const row of data[table]) for (const field of fields) assert(row[field] === null, `${table}.${field}: unexpected retained value`)
  for (const row of data.customers) assert(row.marketing_opted_out_at === null && row.loyalty_points_balance === 0, 'Customer has active data in retired unused fields')
  for (const row of data.business_locations) assert(row.attributes === null, 'Location has unmapped attributes')
  for (const table of ['contact_submissions', 'platform_contact_submissions']) for (const row of data[table]) assert(row.status === 'new', `${table}: non-default retired contact status needs disposition`)
  for (const row of data.oauthClient) {
    assert(Array.isArray(json(row.scopesJson)) && json(row.scopesJson).every(scope => typeof scope === 'string'), 'Invalid canonical OAuth scopes')
    assert(row.requirePkce === 0 || row.requirePkce === 1, 'Invalid PKCE flag')
    change('oauthClient', row, 'scopes', row.scopesJson, 'Exact canonical scope projection')
    row.requirePKCE = row.requirePkce
  }
  for (const row of data.organization_billing) {
    const organization = data.organization.find(organization => organization.id === row.organization_id)
    assert(organization && row.stripe_customer_id === organization.stripeCustomerId, 'Billing customer differs from Better Auth identity')
    if (row.stripe_subscription_id !== null) assert(data.subscription.some(sub => sub.referenceId === row.organization_id && sub.stripeSubscriptionId === row.stripe_subscription_id), 'Billing subscription differs from Better Auth identity')
  }
  for (const row of data.posts) {
    assert(['update', 'standard'].includes(row.post_type), 'Event/offer post requires a reviewed complete local schedule projection')
    assert(['event_title', 'event_start', 'event_end', 'offer_coupon', 'offer_terms'].every(key => row[key] === null), 'Post has unmapped event or offer content')
    change('posts', row, 'post_type', 'standard', 'Retire update topic')
    let cta = null
    if (row.cta_type !== null) {
      assert(['book', 'order', 'shop', 'learn_more', 'sign_up', 'call'].includes(row.cta_type), 'Unknown CTA action')
      if (row.cta_type === 'call') { assert(row.cta_url === null && data.business_locations.some(location => location.id === row.location_id && location.phone), 'CALL lacks explicit location phone'); cta = { action_type: 'call' } }
      else { assert(typeof row.cta_url === 'string' && ['http:', 'https:'].includes(new URL(row.cta_url).protocol), 'Invalid CTA URL'); cta = { action_type: row.cta_type, url: row.cta_url } }
    } else assert(row.cta_url === null, 'CTA URL has no action')
    Object.assign(row, { call_to_action: serialize(cta), event: null, offer: null, alert_type: null })
  }
  for (const location of data.business_locations) {
    const localized = data.resource_localizations.filter(row => row.resource_type === 'business_location' && row.resource_id === location.id && Object.hasOwn(json(row.values_json), 'opening_hours')).map(row => ({ locale: row.locale, hours: json(row.values_json).opening_hours }))
    change('business_locations', location, 'opening_hours', serialize(convertHours(location.opening_hours, localized)), 'Exact weekly endpoint projection, localized minute parity')
    assert(location.special_hours === null, 'Special hours require an explicit reviewed conversion')
    const correction = evidence.location_timezones?.[location.id]
    if (correction) {
      assert(location.timezone === null && validZone(correction.timezone) && correction.source && correction.source_sha256, 'Invalid authoritative timezone evidence')
      change('business_locations', location, 'timezone', correction.timezone, `Authoritative timezone: ${correction.source}`)
    }
    const oldDefault = data.site_config.find(config => config.site_id === location.site_id && config.key === 'default_timezone')?.value
    if (location.timezone === null && validZone(oldDefault)) change('business_locations', location, 'timezone', oldDefault, 'Materialize existing tenant-authored site timezone previously inherited by this location; exclude new analytics defaults')
    if (!validZone(location.timezone)) unresolved.push({ table: 'business_locations', id: location.id, field: 'timezone', disposition: 'Preserve unknown location timezone; availability remains explicitly unavailable until owner configuration', scheduled: location.opening_hours !== null || data.experiences.some(experience => experience.location_id === location.id && recurring(experience) !== null), reservations: data.reservation_submissions.filter(row => row.location_id === location.id).length, experience_bookings: data.experience_bookings.filter(row => data.experiences.some(experience => experience.id === row.experience_id && experience.location_id === location.id)).length })
  }
  for (const row of data.experiences) change('experiences', row, 'recurring_slots', serialize(recurring(row)), 'Preserve seven-day effective offered starts; recurring takes precedence')
  for (const row of data.resource_localizations) {
    const value = json(row.values_json)
    if (Object.hasOwn(value, 'opening_hours')) {
      assert(row.resource_type === 'business_location' && data.business_locations.some(location => location.id === row.resource_id), 'Unscoped localized hours')
      delete value.opening_hours
      change('resource_localizations', row, 'values_json', JSON.stringify(value), 'Retire redundant hours after exact localized weekly minute parity')
    }
    assert(!['event_title', 'offer_terms'].some(key => Object.hasOwn(value, key)), 'Post localization needs explicit nested field conversion')
    assert(row.document_id === null || row.resource_type !== 'tenant_blog_post', 'Localized blog document requires reviewed ownership projection')
  }
  for (const row of data.content_documents) {
    let siteId
    if (['tenant_blog', 'platform_blog'].includes(row.owner_type)) {
      const owner = data.blog_posts.find(post => post.id === row.owner_id)
      assert(owner && (row.owner_type === 'platform_blog') === (owner.site_id === 'platform'), 'Blog document ownership mismatch')
      siteId = owner.site_id
    } else if (row.owner_type === 'tenant_page') {
      const owner = data.tenant_page_variants.find(variant => variant.id === row.owner_id && variant.document_id === row.id)
      assert(owner, 'Page document ownership mismatch'); siteId = owner.site_id
    } else if (row.owner_type === 'platform_doc') { assert(data.platform_docs.some(doc => doc.id === row.owner_id), 'Platform document owner missing'); siteId = 'platform' }
    else if (row.owner_type === 'resource_localization') {
      const owner = data.resource_localizations.find(localization => localization.id === row.owner_id && localization.document_id === row.id && localization.resource_type === 'tenant_blog_post')
      assert(owner, 'Localized body lacks its article representation'); siteId = owner.site_id
    }
    else throw new Error('Unknown document owner')
    assert(data.sites.some(site => site.id === siteId), 'Document site missing'); row.site_id = siteId
  }
  for (const [table, fields] of Object.entries(TIME_COLUMNS)) for (const row of data[table]) for (const field of fields) change(table, row, field, iso(row[field]), 'Exact Unix seconds to ISO UTC')
  for (const row of data.mcp_tool_call_events) for (const field of ['arguments_summary_json', 'result_summary_json']) {
    if (row[field] === null) continue
    try { json(row[field]) } catch { assert(row[field].length === 4012 && /^[{[]/.test(row[field]) && row[field].endsWith('…[truncated]'), 'Unknown malformed MCP summary'); change('mcp_tool_call_events', row, field, JSON.stringify({ truncated: true, summary: row[field] }), 'Preserve entire retained truncated summary as JSON string') }
  }
  for (const row of data.reviews) {
    row.google_review_metadata = null
    if (row.status === 'published') { assert(row.source === 'google_places' && row.google_review_id && row.id === `gplaces-${row.google_review_id.replaceAll('/', '-')}`, 'Published review lacks original importer provenance'); change('reviews', row, 'status', 'approved', 'Importer commit ca4daf92d21d740dedb51b71173041d36b9b245a published Google reviews; canonical moderation state is approved') }
  }
  for (const row of data.onboarding_drafts) change('onboarding_drafts', row, 'payload_json', draftPayload(row.payload_json), 'Project existing draft hours, explicit media slots, retire primary flags')
  for (const site of data.sites) {
    const canonical = data.site_domains.filter(domain => domain.site_id === site.id && domain.organization_id === site.organization_id && domain.role === 'canonical' && domain.status === 'active')
    assert(canonical.length <= 1, 'Site has multiple active canonical domains')
    const publicUrl = canonical.length === 1 ? `https://${canonical[0].domain}` : null
    derived.push({ table: 'sites', id: site.id, field: 'public_url', old_cache_hash: hash(JSON.stringify(site.public_url)), canonical_hash: hash(JSON.stringify(publicUrl)), repaired_missing_cache: site.public_url === null && publicUrl !== null, source: 'Retained active canonical site_domains; no domain fabrication from cache or subdomain' })
    if (site.public_url !== null) assert(data.site_domains.some(domain => domain.site_id === site.id && domain.organization_id === site.organization_id && domain.role === 'canonical' && domain.status === 'active' && site.public_url === `https://${domain.domain}`), 'Cached site public URL differs from canonical active domain')
    if (site.custom_domain !== null) assert(data.site_domains.some(domain => domain.site_id === site.id && domain.organization_id === site.organization_id && domain.type === 'custom' && domain.role === 'canonical' && domain.domain === site.custom_domain && domain.status === site.custom_domain_status), 'Cached custom domain differs from canonical domain record')
    else assert(site.custom_domain_status === 'none', 'Unmapped custom domain status without domain')
    const config = data.site_config.find(config => config.site_id === site.id && config.key === 'default_timezone')
    const priorLocation = sourceData.business_locations.find(location => location.id === site.primary_location_id && location.site_id === site.id)
    const priorZone = validZone(priorLocation?.timezone) ? priorLocation.timezone : 'UTC'
    if (config?.value) { assert(validZone(config.value), 'Invalid existing site timezone'); assert(config.value === priorZone || evidence.analytics_timezone_changes?.[site.id]?.from === priorZone && evidence.analytics_timezone_changes[site.id]?.to === config.value, `Site ${site.id}: analytics timezone changes require explicit disposition`); continue }
    if (config) change('site_config', config, 'value', priorZone, 'Materialize prior analytics civil-time behavior')
    else data.site_config.push({ organization_id: site.organization_id, site_id: site.id, key: 'default_timezone', value: priorZone, updated_at: site.updated_at })
  }
  for (const [table, names] of Object.entries(REMOVED)) for (const row of data[table]) for (const name of names) delete row[name]
  folded.sites = ['sites', 'site_config', 'site_theme_tokens', 'site_consultation_settings', 'tenant_compliance', 'facebook_pages_connections', 'google_analytics_connections']
  for (const site of data.sites) {
    const settings = {}, integrations = {}
    for (const [table, provider] of [['facebook_pages_connections', 'facebook'], ['google_analytics_connections', 'google']]) {
      const records = data[table].filter(row => row.site_id === site.id)
      assert(records.length <= 1 && records.every(row => row.organization_id === site.organization_id), `${table}: invalid provider owner`)
      if (records.length) {
        const { organization_id, site_id, ...fields } = records[0]
        integrations[provider] = { kind: 'oauth', revision: `epoch5:${fields.id}`, ...Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== null)) }
      }
    }
    const config = {}
    for (const row of data.site_config.filter(row => row.site_id === site.id)) {
      assert(row.organization_id === site.organization_id, 'Config owner differs from site')
      if (['source_locale', 'hero_image_is_placeholder'].includes(row.key)) continue
      if (['ga4_property_id', 'google_analytics_measurement_id', 'search_console_site_url'].includes(row.key)) {
        const field = row.key === 'google_analytics_measurement_id' ? 'ga4_measurement_id' : row.key
        if (integrations.google?.kind === 'oauth') assert(integrations.google[field] === row.value, 'Google config mirror differs from canonical connection')
        else {
          assert(field === 'ga4_measurement_id', 'Provider property config lacks canonical OAuth connection')
          integrations.google = { kind: 'manual', status: row.value ? 'active' : 'disabled', ga4_measurement_id: row.value,
            revision: `epoch5:manual:${site.id}`, updated_at: row.updated_at }
        }
        continue
      }
      assert(['brand_color', 'press_email', 'partnerships_email', 'catering_email', 'careers_email', 'google_site_verification',
        'default_timezone', 'whatsapp_phone', 'owner_notification_channels', 'resource_team_generation'].includes(row.key), `Unmapped site setting: ${row.key}`)
      config[row.key] = ['owner_notification_channels', 'resource_team_generation'].includes(row.key) ? json(row.value) : row.value
    }
    if (Object.keys(config).length) settings.config = config
    const themes = data.site_theme_tokens.filter(row => row.site_id === site.id)
    if (themes.length) settings.theme_by_template = Object.fromEntries(themes.map(row => {
      assert(row.organization_id === site.organization_id, 'Theme owner differs from site')
      return [row.template_slug, { tokens: json(row.tokens_json), status: row.status, created_at: row.created_at, updated_at: row.updated_at, updated_by: row.updated_by }]
    }))
    for (const [table, branch] of [['site_consultation_settings', 'consultation'], ['tenant_compliance', 'compliance']]) {
      const records = data[table].filter(row => row.site_id === site.id)
      assert(records.length <= 1 && records.every(row => row.organization_id === site.organization_id), `${table}: invalid settings owner`)
      if (!records.length) continue
      const { id, organization_id, site_id, ...fields } = records[0]
      fields.metadata_json = json(fields.metadata_json)
      if (branch === 'consultation') {
        assert([0, 1].includes(fields.tracking_enabled), 'Invalid consultation tracking flag')
        fields.tracking_enabled = fields.tracking_enabled === 1
      } else {
        for (const key of ['privacy_page_id', 'terms_page_id', 'notice_page_id']) {
          assert(fields[key] === null, `Unmapped compliance page identity: ${key}`)
          delete fields[key]
        }
        fields.same_as = json(fields.same_as)
        fields.contact_points = json(fields.contact_points)
      }
      settings[branch] = fields
    }
    site.settings_json = JSON.stringify(settings)
    site.integrations_json = JSON.stringify(integrations)
  }
  folded.site_locales = ['site_locales', 'site_language_licenses']
  for (const row of data.site_locales) Object.assign(row, { activated_at: null, disabled_at: null })
  for (const license of data.site_language_licenses) {
    const locale = data.site_locales.find(row => row.organization_id === license.organization_id && row.site_id === license.site_id && row.locale === license.locale)
    assert(locale && !locale.is_source, 'Language entitlement lacks non-source locale')
    for (const key of ['stripe_subscription_id', 'stripe_subscription_item_id', 'operation_id', 'provider_idempotency_key', 'last_provider_quantity', 'last_error_code']) {
      assert(license[key] === null, `Language entitlement has unresolved provider state: ${key}`)
    }
    assert((license.status === 'active' && locale.status === 'published') || (license.status === 'disabled' && locale.status === 'disabled'), 'Language publication and entitlement disagree')
    locale.activated_at = iso(license.activated_at)
    locale.disabled_at = iso(license.disabled_at)
  }
  folded.user_workspace_state = ['mcp_workspace_preferences', 'chowbot_channel_state']
  data.user_workspace_state = data.mcp_workspace_preferences.map(row => ({ ...row, whatsapp_pending_confirmation: null, whatsapp_last_inbound_id: null, whatsapp_updated_at: null }))
  for (const row of data.chowbot_channel_state) {
    assert(row.channel === 'whatsapp', 'Unmapped workspace channel')
    let workspace = data.user_workspace_state.find(workspace => workspace.user_id === row.user_id)
    if (!workspace) {
      workspace = { user_id: row.user_id, organization_id: null, site_id: null, location_id: null, created_at: row.updated_at, updated_at: row.updated_at }
      data.user_workspace_state.push(workspace)
    }
    Object.assign(workspace, { whatsapp_pending_confirmation: row.pending_confirmation, whatsapp_last_inbound_id: row.last_inbound_id, whatsapp_updated_at: row.updated_at })
  }
  assert(data.zaraz_sync_lock.every(row => row.locked_at === null), 'Source has an outstanding global provider lease')
  for (const table of [...folded.sites.slice(1), 'site_language_licenses', ...folded.user_workspace_state, 'zaraz_sync_lock']) delete data[table]
  folded.analytics_events = ['site_pageview_events', 'site_conversion_events']
  data.analytics_events = data.site_pageview_events.map(row => {
    const { id, site_id, location_id, page_path, session_id, visitor_id, duration_seconds, created_at, ...payload } = row
    return { id, kind: 'pageview', organization_id: null, site_id, location_id, page_path, session_id, visitor_id,
      duration_seconds, payload_json: JSON.stringify(payload), created_at }
  })
  for (const row of data.site_conversion_events) {
    const { id, organization_id, site_id, location_id, page_path, session_id, visitor_id, created_at,
      source, medium, campaign, term, content, referrer_host, gclid, gbraid, wbraid, fbclid, msclkid, metadata_json, ...payload } = row
    data.analytics_events.push({ id, kind: 'conversion', organization_id, site_id, location_id, page_path, session_id, visitor_id,
      duration_seconds: null, created_at, payload_json: JSON.stringify({ ...payload, metadata: json(metadata_json),
        attribution: { source, medium, campaign, term, content, referrerHost: referrer_host, gclid, gbraid, wbraid, fbclid, msclkid } }) })
  }
  folded.analytics_summaries = ['site_analytics_daily', 'site_analytics_page_daily', 'site_analytics_dimension_daily', 'site_analytics_sessions']
  data.analytics_summaries = data.site_analytics_sessions.map(row => {
    const { id, organization_id, site_id, session_id, created_at, updated_at, last_touch_source, last_touch_medium,
      last_touch_campaign, last_touch_term, last_touch_content, last_touch_referrer_host, last_touch_gclid, last_touch_gbraid,
      last_touch_wbraid, last_touch_fbclid, last_touch_msclkid, ...payload } = row
    return { id, kind: 'session', organization_id, site_id, date: '', key: session_id, created_at, updated_at,
      payload_json: JSON.stringify({ ...payload, attribution: { source: last_touch_source, medium: last_touch_medium,
        campaign: last_touch_campaign, term: last_touch_term, content: last_touch_content, referrerHost: last_touch_referrer_host,
        gclid: last_touch_gclid, gbraid: last_touch_gbraid, wbraid: last_touch_wbraid, fbclid: last_touch_fbclid, msclkid: last_touch_msclkid } }) }
  })
  for (const [table, kind] of [['site_analytics_daily', 'site_day'], ['site_analytics_page_daily', 'page_day'], ['site_analytics_dimension_daily', 'dimension_day']]) {
    for (const row of data[table]) {
      const { id, organization_id, site_id, date, created_at, updated_at, page_path, dimension, value, subvalue, ...payload } = row
      data.analytics_summaries.push({ id, kind, organization_id, site_id, date, created_at, updated_at,
        key: kind === 'site_day' ? '' : kind === 'page_day' ? page_path : JSON.stringify([dimension, value, subvalue]),
        payload_json: JSON.stringify(payload) })
    }
  }
  for (const table of [...folded.analytics_events, ...folded.analytics_summaries]) delete data[table]
  folded.requests = ['contact_submissions', 'reservation_submissions', 'experience_bookings', 'platform_contact_submissions', 'work_requests', 'guest_threads']
  data.requests = []
  const threadRequests = new Map()
  for (const [table, kind] of [['contact_submissions', 'contact'], ['reservation_submissions', 'reservation'], ['experience_bookings', 'experience_booking'], ['platform_contact_submissions', 'platform_contact'], ['work_requests', 'work']]) {
    for (const row of data[table]) {
      const guest = ['contact', 'reservation', 'experience_booking'].includes(kind)
      const threads = guest ? data.guest_threads.filter(thread => thread.submission_type === kind && thread.submission_id === row.id) : []
      assert(threads.length <= 1, 'Submission has multiple guest threads')
      const thread = threads[0]
      if (thread) {
        assert(thread.organization_id === row.organization_id && thread.site_id === row.site_id && thread.location_id === row.location_id, 'Guest thread scope differs from submission')
        threadRequests.set(thread.id, row.id)
      }
      const request = { id: row.id, kind, organization_id: row.organization_id ?? null, site_id: row.site_id ?? null,
        location_id: row.location_id ?? null, product_id: kind === 'reservation' ? null : row.experience_id ?? null,
        customer_id: row.customer_id ?? null, assigned_to: row.assigned_to ?? null, review_id: row.review_id ?? null,
        status: kind === 'contact' || kind === 'platform_contact' ? null : row.status === 'new' ? 'pending' : kind === 'experience_booking' && row.status === 'confirmed' && row.completed_at !== null ? 'completed' : row.status,
        priority: row.priority ?? null, booking_date: null, time_slot: null, party_size: null,
        conversation_state: guest ? thread?.conversation_state ?? 'needs_attention' : null, resolved_at: thread?.resolved_at ?? null,
        created_at: row.created_at, updated_at: [row.updated_at ?? row.created_at, thread?.updated_at ?? row.created_at].sort().at(-1) }
      let payload
      if (kind === 'reservation' || kind === 'experience_booking') {
        const minimum = kind === 'reservation' && row.guests === '8+'
        const size = kind === 'reservation' ? minimum ? 8 : Number(row.guests) : row.party_size
        assert(Number.isSafeInteger(size) && size > 0 && (kind !== 'reservation' || minimum || String(size) === row.guests), 'Booking has unrepresentable party size')
        Object.assign(request, { booking_date: kind === 'reservation' ? row.date : row.booking_date,
          time_slot: kind === 'reservation' ? row.time : row.time_slot, party_size: size })
        payload = { guest: { name: kind === 'reservation' ? row.name : row.guest_name, email: kind === 'reservation' ? row.email : row.guest_email,
          phone: kind === 'reservation' ? row.phone : row.guest_phone }, notes: kind === 'reservation' ? row.requests : row.notes,
          ip_hash: row.ip_hash, party_size_is_minimum: minimum,
          cancellation: { token_hash: row.cancellation_token_hash, expires_at: row.cancellation_token_expires_at, used_at: row.cancellation_token_used_at },
          completion: { at: row.completed_at, source: row.completion_source },
          review: { request_sent_at: row.review_request_sent_at, reminder_sent_at: row.review_reminder_sent_at, submitted_at: row.review_submitted_at } }
      } else if (kind === 'contact') payload = { guest: { name: row.name, email: row.email, phone: null }, subject: row.subject, message: row.message, consent_at: row.consent_at, ip_hash: row.ip_hash }
      else if (kind === 'work') payload = { type: row.type, title: row.title, description: row.description, source: row.source, notes: row.notes, completed_at: row.completed_at }
      else payload = { guest: { name: row.name, email: row.email, phone: null }, topic: row.topic, message: row.message, source: row.source,
        route_context: row.route_context, suggested_summary: row.suggested_summary, agent_metadata: json(row.agent_metadata_json), ip_hash: row.ip_hash }
      request.payload_json = JSON.stringify(payload)
      data.requests.push(request)
    }
  }
  assert(new Set(data.requests.map(row => row.id)).size === data.requests.length, 'Request IDs collide across source submissions')
  assert(threadRequests.size === data.guest_threads.length, 'Guest thread has no canonical submission')
  folded.activity_entries = ['guest_thread_entries', 'notifications', 'notification_reads', 'organization_events', 'site_domain_events']
  data.activity_entries = data.guest_thread_entries.map(row => {
    const { thread_id, ...fields } = row
    assert(threadRequests.has(thread_id), 'Guest entry has no canonical request')
    return { ...fields, request_id: threadRequests.get(thread_id), scope_kind: 'request', organization_id: null, site_id: null, context_site_id: null, location_id: null,
      parent_id: null, target_user_id: null, payload_json: row.payload_json ?? '{}' }
  })
  for (const request of data.requests.filter(row => ['contact', 'reservation', 'experience_booking'].includes(row.kind))) {
    const openings = data.activity_entries.filter(row => row.request_id === request.id && row.kind === 'submission')
    assert(openings.length <= 1, 'Request has multiple opening submission facts')
    if (openings.length) continue
    assert(!data.activity_entries.some(row => row.request_id === request.id), 'Thread history lacks an opening submission fact')
    const id = `epoch5:submission:${request.id}`
    data.activity_entries.push({ id, kind: 'submission', scope_kind: 'request', request_id: request.id,
      organization_id: null, site_id: null, context_site_id: null, location_id: null, parent_id: null, target_user_id: null, actor_kind: 'guest', actor_user_id: null,
      channel: 'web', body: null, event_name: null, payload_json: JSON.stringify({ kind: request.kind }), dedupe_key: `request:${request.id}:submission`,
      sequence: 1, occurred_at: request.created_at, created_at: request.created_at })
    derived.push({ table: 'activity_entries', id, source_request_id: request.id, source: 'Opening fact for retained submission without a historical guest thread; no delivery or notification generated' })
  }
  for (const row of data.notifications) data.activity_entries.push({
    id: row.id, kind: 'notification', scope_kind: row.scope === 'platform' ? 'platform' : 'organization', organization_id: row.organization_id,
    site_id: null, context_site_id: row.site_id, location_id: row.location_id, request_id: null, parent_id: row.source_entry_id,
    actor_kind: 'system', actor_user_id: null, target_user_id: row.target_user_id, channel: null, body: row.message, event_name: row.template,
    payload_json: JSON.stringify({ visibility_scope: row.scope, severity: row.severity, title: row.title, deep_link: row.deep_link }),
    dedupe_key: `notification:${row.id}`, sequence: null, occurred_at: row.created_at, created_at: row.created_at,
  })
  for (const row of data.notification_reads) {
    const notification = data.activity_entries.find(entry => entry.id === row.notification_id && entry.kind === 'notification')
    assert(notification, 'Notification read has no notification')
    const id = `epoch5:ack:${hash(JSON.stringify([row.notification_id, row.user_id]))}`
    data.activity_entries.push({ id, kind: 'acknowledgement', scope_kind: notification.scope_kind,
      organization_id: notification.organization_id, site_id: null, context_site_id: notification.context_site_id, location_id: notification.location_id,
      request_id: null, parent_id: row.notification_id, actor_kind: 'member', actor_user_id: row.user_id, target_user_id: null,
      channel: null, body: null, event_name: null, payload_json: '{}', dedupe_key: `ack:${row.notification_id}:${row.user_id}:${row.read_at}`,
      sequence: null, occurred_at: row.read_at, created_at: row.read_at })
  }
  for (const table of ['organization_events', 'site_domain_events']) for (const row of data[table]) {
    assert(row.actor_id === null || data.user.some(user => user.id === row.actor_id), 'Audit actor has no retained identity')
    const actorKind = row.actor_id ? 'member' : row.actor_type === 'cloudflare' ? 'cloudflare' : 'system'
    data.activity_entries.push({ id: row.id, kind: 'audit', scope_kind: row.site_id ? 'site' : 'organization',
      organization_id: row.site_id ? null : row.organization_id, site_id: row.site_id, context_site_id: null, location_id: row.location_id ?? null,
      request_id: null, parent_id: null, actor_kind: actorKind, actor_user_id: row.actor_id, target_user_id: null, channel: null,
      body: row.message ?? null, event_name: row.event_type, sequence: null, dedupe_key: `audit:${row.id}`,
      occurred_at: row.created_at, created_at: row.created_at, payload_json: JSON.stringify({ sourceOrganizationId: row.organization_id,
        entityType: table === 'site_domain_events' ? 'domain' : row.entity_type, entityId: table === 'site_domain_events' ? row.domain_id : row.entity_id,
        actorType: row.actor_type ?? actorKind, beforeState: json(row.before_state ?? null), afterState: json(row.after_state ?? null), metadata: json(row.metadata) }) })
  }
  assert(new Set(data.activity_entries.map(row => row.id)).size === data.activity_entries.length, 'Activity IDs collide across source histories')
  for (const table of [...folded.requests, ...folded.activity_entries]) delete data[table]
  folded.products = ['products', 'experiences', 'booking_policies', 'availability_overrides']
  folded.business_locations = ['business_locations', 'booking_policies', 'availability_overrides']
  folded.sites.push('booking_policies')
  for (const product of data.products) product.experience_json = null
  for (const row of data.experiences) {
    const product = data.products.find(product => product.id === row.id && product.product_type === 'experience')
    assert(product && product.organization_id === row.organization_id && product.site_id === row.site_id && product.location_id === row.location_id, 'Experience lacks its same-scope product')
    const { id, organization_id, site_id, location_id, ...fields } = row
    for (const field of ['recurring_slots', 'included_items', 'what_to_bring']) fields[field] = json(fields[field])
    product.experience_json = fields
  }
  assert(data.products.every(product => (product.product_type === 'experience') === (product.experience_json !== null)), 'Experience product lacks subtype facts')
  for (const location of data.business_locations) location.booking_json = {}
  const policyOwners = new Map()
  for (const row of data.booking_policies) {
    const { id, organization_id, site_id, policy_type, scope_type, location_id, experience_id, ...fields } = row
    for (const field of ['reschedule_allowed', 'deposit_required', 'accessibility_contact_required']) {
      assert([null, 0, 1].includes(fields[field]), 'Policy has invalid inherited flag')
      if (fields[field] !== null) fields[field] = fields[field] === 1
    }
    let owner, column, path, resourceType
    if (scope_type === 'site') {
      assert(policy_type === 'experience' && location_id === null && experience_id === null, 'Unmapped site policy scope')
      owner = data.sites.find(site => site.id === site_id); column = 'settings_json'; path = ['booking', 'experience']; resourceType = 'site'
    } else if (scope_type === 'location') {
      assert(['reservation', 'experience'].includes(policy_type) && experience_id === null, 'Unmapped location policy scope')
      owner = data.business_locations.find(location => location.id === location_id); column = 'booking_json'; path = [policy_type, 'policy']; resourceType = 'business_location'
    } else {
      assert(scope_type === 'experience' && policy_type === 'experience', 'Unmapped experience policy scope')
      owner = data.products.find(product => product.id === experience_id && product.product_type === 'experience'); column = 'experience_json'; path = ['policy']; resourceType = 'product'
    }
    assert(owner && owner.organization_id === organization_id && (resourceType === 'site' ? owner.id : owner.site_id) === site_id, 'Booking policy owner differs from scope')
    const value = typeof owner[column] === 'string' ? JSON.parse(owner[column]) : owner[column]
    let parent = value
    for (const key of path.slice(0, -1)) parent = parent[key] ??= {}
    assert(!Object.hasOwn(parent, path.at(-1)), 'Two policies claim one owner branch')
    parent[path.at(-1)] = fields
    owner[column] = column === 'settings_json' ? JSON.stringify(value) : value
    policyOwners.set(id, { ownerId: owner.id, resourceType, path: resourceType === 'site' ? ['booking', 'experience'] : resourceType === 'product' ? ['experience', 'policy'] : ['booking', policy_type, 'policy'] })
    derived.push({ table: resourceType === 'site' ? 'sites' : resourceType === 'product' ? 'products' : 'business_locations', id: owner.id,
      field: `${column}.${path.join('.')}`, source_table: 'booking_policies', source_id: id, source: 'Policy moves to its actual owner; inherited NULL and false remain distinct' })
  }
  for (const row of data.availability_overrides) {
    const reservation = row.owner_type === 'location'
    assert(reservation || row.owner_type === 'experience', 'Unmapped availability owner type')
    const owner = reservation ? data.business_locations.find(location => location.id === row.location_id) : data.products.find(product => product.id === row.experience_id)
    assert(owner && owner.organization_id === row.organization_id && owner.site_id === row.site_id, 'Availability override owner differs from scope')
    const value = reservation ? (owner.booking_json.reservation ??= {}) : owner.experience_json
    assert(value, 'Availability override lacks experience subtype')
    const date = ((value.overrides ??= {})[row.override_date] ??= {})
    assert(!Object.hasOwn(date, row.time_slot), 'Duplicate availability slot override')
    date[row.time_slot] = { status: row.status, capacity_override: row.capacity_override, note: row.note, created_at: row.created_at, updated_at: row.updated_at, created_by: row.created_by }
  }
  for (const product of data.products) product.experience_json = serialize(product.experience_json)
  for (const location of data.business_locations) location.booking_json = JSON.stringify(location.booking_json)
  for (const table of ['experiences', 'booking_policies', 'availability_overrides']) delete data[table]
  folded.site_domains = ['site_domains', 'spent_subdomains', 'domain_reconciliation_jobs']
  data.site_domains = data.site_domains.filter(domain => {
    if (!domain.domain.endsWith('.localhost')) return true
    const site = data.sites.find(site => site.id === domain.site_id && site.organization_id === domain.organization_id)
    assert(site && domain.domain === `${site.subdomain}.localhost` && domain.type === 'subdomain'
      && domain.role === 'secondary' && domain.status === 'active' && domain.cloudflare_hostname_id === null
      && data.site_domains.some(other => other.site_id === site.id && other.organization_id === site.organization_id
        && other.domain === `${site.subdomain}.krabiclaw.com` && other.type === 'subdomain' && other.status === 'active')
      && !data.domain_reconciliation_jobs.some(job => job.domain_id === domain.id), 'Localhost domain lacks exact obsolete seed disposition')
    discardedRows.push({ table: 'site_domains', id: domain.id, row_sha256: hashRows([domain], columns(source, 'site_domains')),
      reason: 'Obsolete local-only seed host in deployed source; actual active platform subdomain retained; no provider resource; exact source row archived' })
    return false
  })
  for (const domain of data.site_domains) Object.assign(domain, { former_site_id: null, successor_domain: null, retired_at: null,
    reconciliation_token: null, reconciliation_expires_at: null, desired_state: 'active' })
  for (const job of data.domain_reconciliation_jobs) {
    const domain = data.site_domains.find(row => row.id === job.domain_id)
    assert(domain, 'Domain reconciliation job lacks its domain')
    if (['pending', 'verifying', 'failed', 'blocked'].includes(domain.status) && domain.next_check_at !== null) {
      domain.next_check_at = [domain.next_check_at, job.run_after].sort()[0]
    }
  }
  for (const spent of data.spent_subdomains) {
    let domain = data.site_domains.find(row => row.domain === spent.domain)
    if (domain) assert(domain.type === 'subdomain' && ['disabled', 'deleted'].includes(domain.status), 'Spent subdomain conflicts with an active domain')
    else {
      domain = { ...Object.fromEntries(columns(source, 'site_domains').map(name => [name, null])), id: `epoch5:retired:${hash(spent.domain)}`,
        domain: spent.domain, validation_strategy: 'http_auto', dns_status: 'pending', retry_count: 0, created_at: spent.spent_at, updated_at: spent.spent_at }
      data.site_domains.push(domain)
    }
    Object.assign(domain, { organization_id: null, site_id: null, type: 'subdomain', role: 'secondary', status: 'retired',
      former_site_id: spent.site_id, successor_domain: spent.successor_domain, retired_at: spent.spent_at,
      reconciliation_token: null, reconciliation_expires_at: null, desired_state: 'active', next_check_at: null })
  }
  delete data.spent_subdomains
  delete data.domain_reconciliation_jobs
  folded.resource_localizations = ['resource_localizations', 'experiences', 'booking_policies', 'tenant_compliance', 'site_consultation_settings']
  const mergeLocalized = (target, incoming) => {
    for (const [key, value] of Object.entries(incoming)) {
      if (!Object.hasOwn(target, key)) target[key] = value
      else if (value !== null && target[key] !== null && typeof value === 'object' && typeof target[key] === 'object' && !Array.isArray(value) && !Array.isArray(target[key])) mergeLocalized(target[key], value)
      else assert(JSON.stringify(target[key]) === JSON.stringify(value), `Conflicting localized owner field: ${key}`)
    }
  }
  const remappedTypes = ['experience', 'booking_policy', 'tenant_compliance', 'site_consultation_settings']
  const localizationOwners = new Map()
  const localizations = data.resource_localizations.filter(row => !remappedTypes.includes(row.resource_type))
  for (const row of data.resource_localizations.filter(row => remappedTypes.includes(row.resource_type))) {
    const values = json(row.values_json)
    let resourceType, ownerId, incoming
    if (row.resource_type === 'experience') {
      resourceType = 'product'; ownerId = row.resource_id; incoming = {}
      for (const [key, value] of Object.entries(values)) {
        if (['title', 'body', 'seo_title', 'seo_description'].includes(key)) incoming[key === 'title' ? 'name' : key === 'body' ? 'description' : key] = value
        else (incoming.experience ??= {})[key === 'included_items_json' ? 'included_items' : key] = value
      }
    } else if (row.resource_type === 'booking_policy') {
      const policy = policyOwners.get(row.resource_id)
      assert(policy, 'Localized policy has no canonical owner')
      resourceType = policy.resourceType; ownerId = policy.ownerId; incoming = values
      for (const key of [...policy.path].reverse()) incoming = { [key]: incoming }
    } else {
      const table = row.resource_type
      const owner = sourceData[table].find(owner => owner.id === row.resource_id)
      assert(owner && owner.site_id === row.site_id && owner.organization_id === row.organization_id, 'Localized site branch owner mismatch')
      resourceType = 'site'; ownerId = owner.site_id
      incoming = { [table === 'tenant_compliance' ? 'compliance' : 'consultation']: values }
    }
    const existing = localizations.find(candidate => candidate.organization_id === row.organization_id && candidate.site_id === row.site_id
      && candidate.locale === row.locale && candidate.resource_type === resourceType && candidate.resource_id === ownerId)
    if (existing) {
      assert(row.document_id === null && existing.document_id === null, 'Localized owner has conflicting document')
      if (row.route_path !== null && existing.route_path !== null && row.route_path !== existing.route_path) {
        const product = data.products.find(product => product.id === ownerId && product.product_type === 'experience')
        const location = product && data.business_locations.find(location => location.id === product.location_id)
        const slug = values.slug ?? json(existing.values_json).slug ?? product?.slug
        assert(row.resource_type === 'experience' && product && location
          && row.route_path === `/${row.locale}/experiences/${slug}`
          && existing.route_path === `/${row.locale}/locations/${location.slug}/menu/${slug}`,
        'Localized owner has conflicting public routes')
        derived.push({ table: 'resource_localizations', id: existing.id, field: 'route_path', source_id: row.id,
          previous_sha256: hash(existing.route_path), canonical_sha256: hash(row.route_path),
          source: 'Experience public route retained; product menu route was excluded by the standard-product menu query; exact old value archived' })
        existing.route_path = row.route_path
      }
      const merged = json(existing.values_json)
      mergeLocalized(merged, incoming)
      existing.values_json = JSON.stringify(merged)
      existing.route_path ??= row.route_path
      if (row.created_at < existing.created_at) { existing.created_at = row.created_at; existing.created_by_user_id = row.created_by_user_id }
      if (row.updated_at > existing.updated_at) { existing.updated_at = row.updated_at; existing.updated_by_user_id = row.updated_by_user_id }
    } else localizations.push({ ...row, resource_type: resourceType, resource_id: ownerId, values_json: JSON.stringify(incoming) })
    localizationOwners.set(row.id, { owner_type: 'resource_localization', owner_id: existing?.id ?? row.id })
    derived.push({ table: 'resource_localizations', id: existing?.id ?? row.id, source_id: row.id, source_resource_type: row.resource_type,
      resource_type: resourceType, resource_id: ownerId, source: 'Localized fields move to their canonical owner; conflicting values rejected; source edit provenance retained in archive' })
  }
  data.resource_localizations = localizations
  folded.content_documents = ['content_documents', 'tenant_pages', 'tenant_page_variants', 'blog_posts', 'platform_docs', 'posts', 'post_channel_jobs', 'location_qa', 'site_link_pages', 'resource_localizations']
  folded.content_blocks = ['content_blocks', 'site_link_items', 'resource_localizations']
  for (const block of data.content_blocks) {
    const payload = json(block.data_json)
    block.source_block_id = null
    if (Object.hasOwn(payload, '_localization_source_block_id')) {
      assert(typeof payload._localization_source_block_id === 'string' && payload._localization_source_block_id.length > 0, 'Translated block source identity is invalid')
      block.source_block_id = payload._localization_source_block_id
      delete payload._localization_source_block_id
      change('content_blocks', block, 'data_json', JSON.stringify(payload), 'Move explicit translation source identity into its canonical foreign key')
    }
  }
  const bodies = data.content_documents, documents = [], bodyOwners = new Map(), variantOwners = new Map()
  const document = (owner, kind, fields = {}) => ({
    id: owner.id, organization_id: owner.organization_id, site_id: owner.site_id, kind, row_role: 'root',
    root_id: null, root_role: null, locale: 'en', location_id: null, scope_path: null, title: null, slug: null, path: null,
    summary: null, status: null, visibility: null, sort_order: 0, source: null, author_id: null,
    created_by: null, updated_by: null, published_at: null, first_published_at: null, scheduled_for: null,
    seo_title: null, seo_description: null, seo_keywords: null, canonical_url: null, robots: null,
    metadata_json: '{}', created_at: owner.created_at, updated_at: owner.updated_at, ...fields,
  })
  const bindBody = (body, target) => {
    assert(body && !bodyOwners.has(body.id) && body.site_id === target.site_id, 'Content body has missing, duplicate or cross-site owner')
    bodyOwners.set(body.id, target.id)
    target.updated_at = [target.updated_at, body.updated_at].sort().at(-1)
    derived.push({ table: 'content_documents', id: target.id, source_document_id: body.id,
      source: 'Editorial identity owns exact body blocks; original body identity and edit metadata archived' })
  }
  for (const page of data.tenant_pages) {
    const variants = data.tenant_page_variants.filter(row => row.page_id === page.id)
    const english = variants.filter(row => row.locale === 'en')
    assert(english.length === 1, 'Page lacks exactly one English representation')
    for (const variant of [...english, ...variants.filter(row => row.locale !== 'en')]) {
      assert(variant.organization_id === page.organization_id && variant.site_id === page.site_id, 'Page representation crosses owner scope')
      const root = variant.locale === 'en'
      const target = document(page, 'page', {
        id: root ? page.id : variant.document_id, row_role: root ? 'root' : 'representation',
        root_id: root ? null : page.id, root_role: root ? null : 'root', locale: variant.locale,
        title: variant.title, path: variant.path, summary: variant.summary, seo_title: variant.seo_title,
        seo_description: variant.seo_description, canonical_url: variant.canonical_url, robots: variant.robots,
        sort_order: root ? page.sort_order : 0, source: root ? page.source : null, updated_by: variant.updated_by,
        created_at: root ? page.created_at : variant.created_at, updated_at: [page.updated_at, variant.updated_at].sort().at(-1),
        metadata_json: JSON.stringify(root ? { page_type: page.page_type, recipe: page.recipe, source_ref: page.source_ref } : {}),
      })
      const body = bodies.find(body => body.id === variant.document_id && body.owner_type === 'tenant_page' && body.owner_id === variant.id)
      bindBody(body, target); variantOwners.set(variant.id, target.id); documents.push(target)
    }
  }
  for (const [table, kind] of [['blog_posts', 'article'], ['platform_docs', 'platform_doc']]) for (const row of data[table]) {
    const scope = kind === 'platform_doc' ? { ...row, organization_id: 'platform', site_id: 'platform' } : row
    const copy = Object.fromEntries(['title', 'slug', 'status', 'visibility', 'author_id', 'published_at', 'first_published_at', 'scheduled_for', 'seo_title', 'seo_description', 'seo_keywords', 'canonical_url', 'robots', 'sort_order'].filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))
    const metadata = Object.fromEntries(['category', 'nav_section', 'nav_title', 'nav_order', 'nav_section_order', 'nav_group', 'nav_group_order', 'hide_from_nav', 'featured_order', 'difficulty_level', 'slug_manually_overridden'].filter(key => Object.hasOwn(row, key)).map(key => [key, row[key]]))
    if (kind === 'article') metadata.tags = json(row.tags_json)
    const target = document(scope, kind, { ...copy, summary: row.excerpt, metadata_json: JSON.stringify(metadata) })
    const owned = bodies.filter(body => body.owner_id === row.id && body.owner_type === (kind === 'platform_doc' ? 'platform_doc' : row.site_id === 'platform' ? 'platform_blog' : 'tenant_blog'))
    assert(owned.length === 1, 'Published content lacks exactly one body')
    bindBody(owned[0], target); documents.push(target)
  }
  for (const row of data.posts) {
    const channels = {}
    for (const job of data.post_channel_jobs.filter(job => job.post_id === row.id)) {
      assert(['facebook', 'instagram'].includes(job.channel) && !Object.hasOwn(channels, job.channel), 'Unsupported or duplicate post channel')
      channels[job.channel] = { status: job.status, provider_post_id: job.provider_post_id, error_message: job.error, published_at: job.published_at, created_at: job.created_at }
    }
    documents.push(document(row, 'social_post', { location_id: row.location_id, title: row.title, slug: row.slug, summary: row.body,
      seo_title: row.seo_title, seo_description: row.seo_description, status: row.status, source: row.source, created_by: row.created_by,
      published_at: row.published_at, scheduled_for: row.scheduled_for,
      metadata_json: JSON.stringify({ post_type: row.post_type, call_to_action: json(row.call_to_action), event: json(row.event), offer: json(row.offer), alert_type: row.alert_type, channels }) }))
  }
  assert(data.post_channel_jobs.every(job => data.posts.some(post => post.id === job.post_id)), 'Post channel has no owning post')
  for (const row of data.location_qa) documents.push(document(row, 'qa', {
    location_id: row.location_id, scope_path: row.page_path, title: row.question, summary: row.answer, status: row.status,
    source: row.source, sort_order: row.sort_order,
    metadata_json: JSON.stringify(Object.fromEntries(['question_author', 'question_date', 'answer_author', 'answer_date', 'is_owner_answer', 'upvote_count'].map(key => [key, row[key]]))),
  }))
  for (const row of data.site_link_pages) {
    documents.push(document(row, 'page', { title: row.title, path: row.path, robots: row.robots, seo_title: row.seo_title,
      seo_description: row.seo_description, updated_by: row.updated_by, metadata_json: JSON.stringify({ page_type: 'custom', recipe: 'links' }) }))
    for (const item of data.site_link_items.filter(item => item.link_page_id === row.id)) {
      assert(item.organization_id === row.organization_id && item.site_id === row.site_id, 'Link item crosses owner scope')
      data.content_blocks.push({ id: item.id, document_id: row.id, parent_block_id: null, source_block_id: null, type: 'cta', position: item.sort_order, level: null,
        data_json: JSON.stringify({ label: item.label, url: item.destination, status: item.status, updated_by: item.updated_by }),
        created_at: item.created_at, updated_at: item.updated_at })
    }
  }
  const contentTypes = { tenant_blog_post: 'article', site_post: 'social_post', location_qa: 'qa', site_link_page: 'page' }
  for (const row of data.resource_localizations.filter(row => Object.hasOwn(contentTypes, row.resource_type))) {
    const root = documents.find(doc => doc.id === row.resource_id && doc.row_role === 'root' && doc.kind === contentTypes[row.resource_type])
    assert(root && root.organization_id === row.organization_id && root.site_id === row.site_id && row.locale !== 'en', 'Localized content lacks its canonical owner')
    const values = json(row.values_json), copy = {}, metadata = {}
    for (const [key, value] of Object.entries(values)) {
      const field = { body: 'summary', excerpt: 'summary', question: 'title', answer: 'summary' }[key] ?? key
      if (['title', 'summary', 'slug', 'seo_title', 'seo_description', 'seo_keywords', 'robots', 'canonical_url'].includes(field)) copy[field] = value
      else if (['category', 'tags_json', 'nav_title', 'event', 'offer'].includes(key)) metadata[key === 'tags_json' ? 'tags' : key] = key === 'tags_json' && typeof value === 'string' ? json(value) : value
      else throw new Error(`Unmapped localized content field: ${key}`)
    }
    assert(row.route_path === null || row.route_path.startsWith(`/${row.locale}/`), 'Localized document route lacks its exact locale prefix')
    const target = document(row, root.kind, { ...copy, id: row.document_id ?? `epoch5:representation:${hash(JSON.stringify([root.id, row.locale]))}`,
      row_role: 'representation', root_id: root.id, root_role: 'root', locale: row.locale,
      path: row.route_path === null ? null : row.route_path.slice(row.locale.length + 1),
      created_by: row.created_by_user_id, updated_by: row.updated_by_user_id, metadata_json: JSON.stringify(metadata) })
    if (row.document_id !== null) bindBody(bodies.find(body => body.id === row.document_id && body.owner_type === 'resource_localization' && body.owner_id === row.id), target)
    documents.push(target)
    localizationOwners.set(row.id, { owner_type: 'content_document', owner_id: target.id })
  }
  for (const row of data.resource_localizations.filter(row => row.resource_type === 'site_link_item')) {
    const item = data.site_link_items.find(item => item.id === row.resource_id && item.site_id === row.site_id && item.organization_id === row.organization_id)
    const representation = item && documents.find(doc => doc.root_id === item.link_page_id && doc.locale === row.locale)
    const values = json(row.values_json)
    assert(representation && Object.keys(values).length === 1 && typeof values.label === 'string' && row.route_path === null && row.document_id === null,
      'Localized link requires its page representation and exact label-only copy')
    data.content_blocks.push({ id: row.id, document_id: representation.id, parent_block_id: null, source_block_id: item.id,
      type: 'cta', position: item.sort_order, level: null, data_json: JSON.stringify({ label: values.label }),
      created_at: row.created_at, updated_at: row.updated_at })
    localizationOwners.set(row.id, { owner_type: 'content_block', owner_id: row.id })
  }
  data.resource_localizations = data.resource_localizations.filter(row => !Object.hasOwn(contentTypes, row.resource_type) && row.resource_type !== 'site_link_item')
  for (const row of data.resource_localizations) {
    assert(row.document_id === null, 'Non-document localized owner retains a body reference')
    delete row.document_id
  }
  assert(bodyOwners.size === bodies.length, 'Content body was not assigned to a canonical representation')
  for (const block of data.content_blocks) {
    if (bodyOwners.has(block.document_id)) block.document_id = bodyOwners.get(block.document_id)
    else assert(documents.some(doc => doc.id === block.document_id && doc.kind === 'page'), 'Block has no canonical content representation')
  }
  const translatedSources = new Set()
  for (const owner of documents.filter(document => document.kind === 'page' && document.row_role === 'representation')) {
    const translatedBlocks = data.content_blocks.filter(block => block.document_id === owner.id)
    const sourceBlocks = data.content_blocks.filter(block => block.document_id === owner.root_id)
    for (const block of translatedBlocks.filter(block => block.source_block_id === null)) {
      const field = json(block.data_json).field
      assert(typeof field === 'string' && field.trim().length > 0, 'Translated page block lacks an explicit source identity or authored field')
      const matches = sourceBlocks.filter(source => source.type === block.type && json(source.data_json).field === field)
      const translatedMatches = translatedBlocks.filter(translated => translated.type === block.type && json(translated.data_json).field === field)
      assert(matches.length === 1 && translatedMatches.length === 1, 'Translated page authored field identity is missing or ambiguous')
      change('content_blocks', block, 'source_block_id', matches[0].id, 'Resolve original authored field identity against the unique same-type English block in the same page; never infer by position')
    }
  }
  for (const block of data.content_blocks.filter(block => block.source_block_id !== null)) {
    const sourceBlock = data.content_blocks.find(source => source.id === block.source_block_id)
    const owner = documents.find(document => document.id === block.document_id)
    const sourceOwner = documents.find(document => document.id === sourceBlock?.document_id)
    assert(sourceBlock && sourceBlock.id !== block.id && sourceBlock.type === block.type && sourceOwner?.row_role === 'root'
      && owner?.row_role === 'representation' && owner.root_id === sourceOwner.id && owner.kind === sourceOwner.kind
      && owner.organization_id === sourceOwner.organization_id && owner.site_id === sourceOwner.site_id, 'Translated block source crosses its canonical owner or type')
    const identity = JSON.stringify([owner.id, sourceBlock.id])
    assert(!translatedSources.has(identity), 'Translated block source identity is duplicated')
    translatedSources.add(identity)
  }
  assert(new Set(documents.map(doc => doc.id)).size === documents.length, 'Editorial identities collide across source owners')
  data.content_documents = documents
  folded.media_placements = ['media_placements', 'tenant_compliance', 'tenant_pages', 'tenant_page_variants', 'content_documents', 'experiences']
  for (const row of data.media_placements) {
    if (['blog_post', 'platform_doc', 'post', 'tenant_page'].includes(row.owner_type)) {
      const id = row.owner_type === 'tenant_page' ? variantOwners.get(row.owner_id) ?? row.owner_id : row.owner_id
      assert(documents.some(doc => doc.id === id && doc.organization_id === row.organization_id && doc.site_id === row.site_id), 'Media has no canonical editorial owner')
      row.owner_type = 'content_document'; row.owner_id = id
    } else if (row.owner_type === 'experience') row.owner_type = 'product'
    else if (row.owner_type === 'tenant_compliance') {
      const compliance = sourceData.tenant_compliance.find(compliance => compliance.id === row.owner_id && compliance.organization_id === row.organization_id && compliance.site_id === row.site_id)
      assert(compliance && row.slot === 'document', 'Compliance media has no canonical site owner')
      row.owner_type = 'site'; row.owner_id = compliance.site_id; row.slot = 'compliance_document'
    }
  }
  folded.site_redirects = ['site_redirects', 'tenant_pages', 'tenant_page_variants', 'resource_localizations']
  for (const row of data.site_redirects) {
    if (['tenant_page', 'tenant_page_variant', 'platform_blog_post', 'tenant_blog_post', 'site_post', 'site_link_page'].includes(row.owner_type)) {
      row.owner_id = variantOwners.get(row.owner_id) ?? row.owner_id
      row.owner_type = 'content_document'
    } else if (row.owner_type === 'site_link_item') row.owner_type = 'content_block'
    else if (row.owner_type === 'experience') row.owner_type = 'product'
    else if (row.owner_type === 'resource_localization' && localizationOwners.has(row.owner_id)) Object.assign(row, localizationOwners.get(row.owner_id))
  }
  for (const row of data.analytics_events) {
    const payload = json(row.payload_json)
    if (row.kind === 'conversion') {
      const type = payload.entity_type
      if (['contact_submission', 'reservation_submission', 'experience_booking'].includes(type)) payload.entity_type = 'request'
      else if (type === 'site_link_item') payload.entity_type = 'content_block'
      else if (type === 'tenant_page') { payload.entity_type = 'content_document'; payload.entity_id = variantOwners.get(payload.entity_id) ?? payload.entity_id }
      assert(payload.entity_type === null || ['request', 'product', 'content_block', 'content_document'].includes(payload.entity_type), 'Unmapped conversion entity type')
    } else if (payload.page_id !== null) payload.page_id = variantOwners.get(payload.page_id) ?? payload.page_id
    row.payload_json = JSON.stringify(payload)
  }
  for (const table of ['tenant_pages', 'tenant_page_variants', 'blog_posts', 'platform_docs', 'posts', 'post_channel_jobs', 'location_qa', 'site_link_pages', 'site_link_items']) delete data[table]
  return { data, sourceData, changed, discarded, discardedRows, archived, unresolved, derived, folded }
}

function assertSchema(source, target, projection) {
  assert(JSON.stringify(Object.keys(projection.data).sort()) === JSON.stringify(tables(target)), 'Undeclared table change')
  for (const table of tables(target)) {
    if (projection.folded[table]) {
      const names = columns(target, table).sort()
      assert(projection.data[table].every(row => JSON.stringify(Object.keys(row).sort()) === JSON.stringify(names)), `${table}: projected columns differ from generated schema`)
      continue
    }
    const expected = [...columns(source, table).filter(name => !(REMOVED[table] ?? []).includes(name)), ...(ADDED[table] ?? [])].sort()
    assert(JSON.stringify(expected) === JSON.stringify(columns(target, table).sort()), `${table}: undeclared column change`)
  }
}

export function verifyDatabases(source, target, evidence = {}, archive) {
  const projection = project(source, evidence)
  assertSchema(source, target, projection)
  if (projection.archived.some(table => table.rows > 0)) verifyHistoricalArchive(source, archive)
  const checks = []
  for (const table of tables(target)) {
    const names = columns(target, table).sort(), actual = rows(target, table), expected = projection.data[table]
    const expectedHash = hashRows(expected, names), actualHash = hashRows(actual, names)
    assert(actual.length === expected.length && actualHash === expectedHash, `${table}: actual target differs from source projection`)
    if (projection.folded[table]) {
      checks.push({ table, source_tables: projection.folded[table].map(name => ({ table: name, rows: projection.sourceData[name].length })), target_count: actual.length,
        columns: names, projected_hash: expectedHash, actual_hash: actualHash })
      continue
    }
    const changedColumns = new Set(projection.changed.filter(change => change.table === table).map(change => change.key))
    const retained = names.filter(name => !(ADDED[table] ?? []).includes(name) && !changedColumns.has(name))
    const retainedSource = projection.sourceData[table].filter(row => !projection.discardedRows.some(discarded => discarded.table === table && discarded.id === row.id))
    const retainedSourceHash = hashRows(retainedSource, retained), retainedTargetHash = hashRows(actual, retained)
    assert(retainedSourceHash === retainedTargetHash, `${table}: unchanged source fields differ`)
    checks.push({ table, source_count: projection.sourceData[table].length, target_count: actual.length, columns: names, projected_hash: expectedHash, actual_hash: actualHash, unchanged_columns: retained, unchanged_source_hash: retainedSourceHash, unchanged_target_hash: retainedTargetHash })
  }
  assert(target.pragma('foreign_key_check').length === 0, 'Target has foreign key violations')
  assert(target.pragma('integrity_check', { simple: true }) === 'ok', 'Target SQLite integrity check failed')
  const invariants = auditTargetInvariants(target)
  assert(invariants.every(invariant => invariant.violations === 0), `Target invariant violations: ${invariants.filter(invariant => invariant.violations > 0).map(invariant => `${invariant.name}=${invariant.violations}`).join(', ')}`)
  return { epoch: 5, generated_at: new Date().toISOString(), source_schema_sha256: schemaHash(source), target_schema_sha256: schemaHash(target), tables: checks, invariants, removed_columns: REMOVED, added_columns: ADDED, changed_fields: projection.changed, discarded_fields: projection.discarded, discarded_rows: projection.discardedRows, archived_tables: projection.archived, unresolved_fields: projection.unresolved, derived_projections: projection.derived, evidence_sha256: hash(JSON.stringify(evidence)) }
}

function main() {
  const [command, sourcePath, targetPath, ...flags] = process.argv.slice(2)
  assert(['plan', 'transform', 'verify'].includes(command) && sourcePath && targetPath, 'Usage: epoch5-data.mjs <plan|transform|verify> <source.sql|sqlite> <target.sqlite|report.json> [--baseline directory] [--evidence private.json]')
  const options = {}
  for (let i = 0; i < flags.length; i += 2) { assert(['--baseline', '--evidence'].includes(flags[i]) && flags[i + 1], 'Unknown argument'); options[flags[i].slice(2)] = resolve(flags[i + 1]) }
  const evidence = options.evidence ? JSON.parse(readFileSync(options.evidence, 'utf8')) : {}
  const source = openDatabase(resolve(sourcePath))
  let target
  try {
    if (command === 'plan') {
      const projection = project(source, evidence)
      writeFileSync(resolve(targetPath), JSON.stringify({ changed_fields: projection.changed, discarded_fields: projection.discarded, discarded_rows: projection.discardedRows, archived_tables: projection.archived, unresolved_fields: projection.unresolved, derived_projections: projection.derived, projected_tables: Object.entries(projection.data).map(([table, values]) => ({ table, count: values.length, hash: hashRows(values, values.length ? Object.keys(values[0]).sort() : []) })) }, null, 2), { mode: 0o600, flag: 'wx' })
      console.log('Epoch 5 source projection is deterministic. Private disposition report written.')
      return
    }
    const directory = options.baseline ?? resolve(import.meta.dirname, '../migrations')
    const baseline = readdirSync(directory).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort().map(name => ({ name, sql: readFileSync(resolve(directory, name), 'utf8') }))
    assert(baseline.length > 0, 'No committed generated baseline found')
    if (command === 'transform') {
      assert(!existsSync(targetPath), 'Refusing to overwrite target database')
      const projection = project(source, evidence)
      const archive = historicalArchive(source)
      writeFileSync(`${resolve(targetPath)}.history.json`, JSON.stringify(archive, null, 2), { mode: 0o600, flag: 'wx' })
      verifyHistoricalArchive(source, JSON.parse(readFileSync(`${resolve(targetPath)}.history.json`, 'utf8')))
      target = new Database(resolve(targetPath)); target.pragma('foreign_keys = OFF')
      for (const entry of baseline) target.exec(entry.sql)
      assertSchema(source, target, projection)
      target.transaction(() => {
        for (const table of tables(target)) {
          const names = columns(target, table), insert = target.prepare(`INSERT INTO ${qi(table)} (${names.map(qi).join(',')}) VALUES (${names.map(() => '?').join(',')})`)
          for (const row of projection.data[table]) { assert(names.every(name => Object.hasOwn(row, name)), `${table}: missing projected column`); insert.run(names.map(name => row[name])) }
        }
      })()
      target.pragma('foreign_keys = ON')
    } else target = openDatabase(resolve(targetPath))
    const expectedSchema = new Database(':memory:')
    try {
      expectedSchema.pragma('foreign_keys = OFF')
      for (const entry of baseline) expectedSchema.exec(entry.sql)
      assert(schemaHash(target) === schemaHash(expectedSchema), 'Actual target schema differs from generated baseline')
    } finally { expectedSchema.close() }
    const manifest = verifyDatabases(source, target, evidence, JSON.parse(readFileSync(`${resolve(targetPath)}.history.json`, 'utf8')))
    manifest.baseline = baseline.map(entry => ({ name: entry.name, sha256: hash(entry.sql) }))
    writeFileSync(`${resolve(targetPath)}.${command === 'transform' ? 'manifest' : 'verification'}.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 })
    console.log(`Epoch 5 ${command} passed: ${manifest.tables.length} tables, exact projected content, foreign keys and integrity verified.`)
  } finally { source.close(); target?.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
