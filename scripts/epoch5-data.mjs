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
const ARCHIVED_TABLES = ['canary_runs', 'chowbot_conversations', 'chowbot_messages']
const RETIRED_TABLES = ['dashboard_preferences', 'themes', ...ARCHIVED_TABLES]
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const THAI_DAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์']
const TIME_COLUMNS = { platform_locale_catalogs: ['available_at', 'created_at', 'updated_at'], platform_locale_messages: ['updated_at'], resource_localizations: ['created_at', 'updated_at'] }
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
    tables: ARCHIVED_TABLES.map(table => {
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
  experience: 'experiences', offering: 'offerings', site_post: 'posts', tenant_blog_post: 'blog_posts',
  location_qa: 'location_qa', media_asset: 'media_assets', booking_policy: 'booking_policies',
  site_link_page: 'site_link_pages', site_link_item: 'site_link_items', tenant_compliance: 'tenant_compliance',
  site_consultation_settings: 'site_consultation_settings',
}
export const TARGET_INVARIANT_QUERIES = {
  media_owner_scope: MEDIA_PLACEMENT_OWNER_AUDIT_QUERY,
  document_owner_scope: `WITH scope AS (${CONTENT_DOCUMENT_SCOPE_QUERY}) SELECT d.id FROM content_documents d WHERE (SELECT count(*) FROM scope s WHERE s.id = d.id) <> 1`,
  english_source_page: SOURCE_PAGE_QUERY,
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
  localized_document_link: `SELECT r.id FROM resource_localizations r WHERE r.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM content_documents d WHERE r.resource_type = 'tenant_blog_post' AND d.id = r.document_id AND d.owner_type = 'resource_localization' AND d.owner_id = r.id AND d.site_id = r.site_id
  )`,
  publication_document_completeness: `SELECT p.id FROM blog_posts p WHERE NOT EXISTS (
    SELECT 1 FROM content_documents d WHERE d.owner_id = p.id AND d.site_id = p.site_id
      AND d.owner_type = CASE WHEN p.site_id = 'platform' THEN 'platform_blog' ELSE 'tenant_blog' END
  ) UNION ALL SELECT p.id FROM platform_docs p WHERE NOT EXISTS (
    SELECT 1 FROM content_documents d WHERE d.owner_id = p.id AND d.site_id = 'platform' AND d.owner_type = 'platform_doc'
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
    else throw new Error('Unknown document owner')
    assert(data.sites.some(site => site.id === siteId), 'Document site missing'); row.site_id = siteId
  }
  for (const [table, fields] of Object.entries(TIME_COLUMNS)) for (const row of data[table]) for (const field of fields) change(table, row, field, iso(row[field]), 'Exact Unix seconds to ISO UTC')
  for (const row of data.canary_runs) {
    if (row.details_json === null) continue
    try { json(row.details_json) } catch { const recovered = row.details_json.replaceAll('\\\\', '\\'); json(recovered); change('canary_runs', row, 'details_json', recovered, 'Reverse proven double-backslash SQL escaping') }
  }
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
  return { data, sourceData, changed, discarded, discardedRows, archived, unresolved, derived }
}

function assertSchema(source, target) {
  assert(JSON.stringify(tables(source).filter(table => !RETIRED_TABLES.includes(table))) === JSON.stringify(tables(target)), 'Undeclared table change')
  for (const table of tables(target)) {
    const expected = [...columns(source, table).filter(name => !(REMOVED[table] ?? []).includes(name)), ...(ADDED[table] ?? [])].sort()
    assert(JSON.stringify(expected) === JSON.stringify(columns(target, table).sort()), `${table}: undeclared column change`)
  }
}

export function verifyDatabases(source, target, evidence = {}, archive) {
  assertSchema(source, target)
  const projection = project(source, evidence)
  if (projection.archived.some(table => table.rows > 0)) verifyHistoricalArchive(source, archive)
  const checks = []
  for (const table of tables(target)) {
    const names = columns(target, table).sort(), actual = rows(target, table), expected = projection.data[table]
    const expectedHash = hashRows(expected, names), actualHash = hashRows(actual, names)
    assert(actual.length === expected.length && actualHash === expectedHash, `${table}: actual target differs from source projection`)
    const changedColumns = new Set(projection.changed.filter(change => change.table === table).map(change => change.key))
    const retained = names.filter(name => !(ADDED[table] ?? []).includes(name) && !changedColumns.has(name))
    const retainedActual = table === 'site_config' ? actual.filter(row => projection.sourceData.site_config.some(before => before.site_id === row.site_id && before.key === row.key)) : actual
    const retainedSource = projection.sourceData[table].filter(row => !projection.discardedRows.some(discarded => discarded.table === table && discarded.id === row.id))
    const retainedSourceHash = hashRows(retainedSource, retained), retainedTargetHash = hashRows(retainedActual, retained)
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
      assertSchema(source, target)
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
