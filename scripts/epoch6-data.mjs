#!/usr/bin/env node
// One-time, offline Epoch 5 -> 6 transfer. Never imported by application runtime.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Database from 'better-sqlite3'
import { editorModeFor } from '../shared/markdown-editor-mode.ts'
import { CONTENT_DOCUMENT_SCOPE_QUERY, MEDIA_PLACEMENT_OWNER_AUDIT_QUERY } from './audit-orphaned-media-placements.mjs'

export function openDatabase(path) {
  if (!path.endsWith('.sql')) return new Database(path, { readonly: true, fileMustExist: true })
  const db = new Database(':memory:')
  db.pragma('foreign_keys = OFF')
  db.exec(readFileSync(path, 'utf8'))
  return db
}

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

const [command, sourcePath, targetPath] = process.argv.slice(2)
if (!['transform', 'verify'].includes(command) || !sourcePath || !targetPath) throw new Error('Usage: epoch6-data.mjs <transform|verify> <private-source.sql> <private-target.sqlite>')
const assert = (condition, message) => { if (!condition) throw new Error(message) }
const hash = value => createHash('sha256').update(value).digest('hex')
const qi = value => `"${value.replaceAll('"', '""')}"`
const tableNames = db => db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations','__drizzle_migrations') ORDER BY name").all().map(row => row.name)
const columns = (db, table) => db.prepare(`PRAGMA table_info(${qi(table)})`).all().map(row => row.name)
const digest = (rows, names) => hash(rows.map(row => JSON.stringify(names.map(name => row[name]))).sort().join('\n'))
const reclassifyMarkdown = value => {
  const data = JSON.parse(value)
  if (data.editor_mode !== 'source') return value
  assert(typeof data.markdown === 'string', 'content_blocks.data_json: source markdown must be a string')
  if (editorModeFor(data.markdown) === 'source') return value
  const tokens = [...value.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\]:,]/g)]
  let depth = 0
  const modes = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index][0]
    if (token === '{' || token === '[') depth++
    else if (token === '}' || token === ']') depth--
    else if (depth === 1 && token.startsWith('"') && tokens[index + 1]?.[0] === ':' && JSON.parse(token) === 'editor_mode') modes.push(tokens[index + 2])
  }
  assert(modes.length === 1 && JSON.parse(modes[0][0]) === 'source', 'content_blocks.data_json: ambiguous editor_mode')
  const mode = modes[0]
  const projected = `${value.slice(0, mode.index)}"rich"${value.slice(mode.index + mode[0].length)}`
  assert(JSON.stringify(JSON.parse(projected)) === JSON.stringify({ ...data, editor_mode: 'rich' }), 'content_blocks.data_json: another key changed')
  return projected
}
const removed = { customers: ['last_booking_at', 'last_review_at'] }
const retired = {
  usage_quota_grants: ['id', 'organization_id', 'resource', 'quantity', 'unit', 'period_key', 'period_start', 'period_end', 'grant_type', 'reason', 'created_by', 'idempotency_key', 'applied_at', 'created_at'],
}
const extraInstants = new Set(['paid_through', 'past_due_since', 'period_start', 'period_end', 'valid_from', 'valid_until'])
const source = openDatabase(resolve(sourcePath))
const baseline = readFileSync('migrations/0000_epoch_6_baseline.sql', 'utf8')
const target = command === 'transform'
  ? (assert(!existsSync(targetPath), 'Refusing to overwrite an existing target'), new Database(targetPath))
  : new Database(targetPath, { readonly: true, fileMustExist: true })
try {
  if (command === 'transform') { target.pragma('foreign_keys = OFF'); target.exec(baseline) }
  const expectedSchema = new Database(':memory:')
  expectedSchema.exec(baseline)
  const schemaObjects = db => db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND tbl_name NOT IN ('d1_migrations','__drizzle_migrations') ORDER BY type,name").all()
  assert(JSON.stringify(schemaObjects(target)) === JSON.stringify(schemaObjects(expectedSchema)), 'Target schema differs from the generated baseline')
  expectedSchema.close()
  const names = tableNames(target)
  assert(JSON.stringify(tableNames(source)) === JSON.stringify([...names, ...Object.keys(retired)].sort()), 'Source/target table inventory differs')
  const sourceMarkdown = source.prepare("SELECT data_json FROM content_blocks WHERE type = 'markdown'").all().map(row => JSON.parse(row.data_json)).filter(data => data.editor_mode === 'source')
  const requiresSource = sourceMarkdown.filter(data => {
    assert(typeof data.markdown === 'string', 'content_blocks.data_json: source markdown must be a string')
    return editorModeFor(data.markdown) === 'source'
  }).length
  const markdownEditorModes = { source_blocks: sourceMarkdown.length, requires_source: requiresSource, reclassified_blocks: sourceMarkdown.length - requiresSource }
  const sourceSocialPostVisibility = source.prepare("SELECT visibility FROM content_documents WHERE kind = 'social_post' AND row_role = 'root'").all()
  assert(sourceSocialPostVisibility.every(row => row.visibility === null), 'content_documents.visibility: social post source value requires an explicit mapping')
  const socialPostVisibility = { source_nulls: sourceSocialPostVisibility.length, projected_public: sourceSocialPostVisibility.length }
  const manifest = { epoch: 6, baseline_sha256: hash(baseline), source_sha256: hash(readFileSync(sourcePath)), removed_columns: removed, retired_tables: [], markdown_editor_modes: markdownEditorModes, social_post_visibility: socialPostVisibility, tables: [], invariants: [] }
  for (const [table, expectedColumns] of Object.entries(retired)) {
    assert(JSON.stringify(columns(source, table).sort()) === JSON.stringify([...expectedColumns].sort()), `${table}: undeclared column change`)
    const records = source.prepare(`SELECT * FROM ${qi(table)}`).all()
    assert(records.every(row => row.resource === 'ai_inference' && row.unit === 'credit'
      && ['plan', 'reset', 'manual'].includes(row.grant_type)), `${table}: unrecognized grant use requires an explicit mapping`)
    manifest.retired_tables.push({ table, rows: records.length, source_sha256: digest(records, expectedColumns) })
  }
  const normalize = source.prepare("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', ?, '+0 days') AS value")
  const transfer = () => {
    for (const table of names) {
      const sourceColumns = columns(source, table), targetColumns = columns(target, table)
      const expectedColumns = sourceColumns.filter(name => !(removed[table] ?? []).includes(name))
      assert(JSON.stringify(expectedColumns.sort()) === JSON.stringify([...targetColumns].sort()), `${table}: undeclared column change`)
      const records = source.prepare(`SELECT * FROM ${qi(table)}`).all()
      const changed = new Set(), changes = {}
      const projected = records.map(record => Object.fromEntries(targetColumns.map(name => {
        let value = record[name]
        if (table === 'content_documents' && name === 'visibility' && record.kind === 'social_post' && record.row_role === 'root') {
          assert(value === null, 'content_documents.visibility: social post source value requires an explicit mapping')
          value = 'public'
          changed.add(name)
          changes[name] = (changes[name] ?? 0) + 1
        }
        if (typeof value === 'string' && (name.endsWith('_at') || name === 'scheduled_for' || extraInstants.has(name))) {
          // Legacy SQL CURRENT_TIMESTAMP writers are UTC. Explicit-offset inputs
          // identify their instant. Offsetless local ISO timestamps are rejected.
          assert(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
            || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value), `${table}.${name}: timestamp has no declared source zone`)
          assert(normalize.get(`${value.slice(0, 10)}T00:00:00Z`).value?.slice(0, 10) === value.slice(0, 10), `${table}.${name}: invalid calendar date`)
          const canonical = normalize.get(value).value
          assert(canonical !== null, `${table}.${name}: invalid timestamp`)
          if (canonical !== value) { changed.add(name); changes[name] = (changes[name] ?? 0) + 1 }
          value = canonical
        }
        if (table === 'content_blocks' && name === 'data_json' && record.type === 'markdown') {
          value = reclassifyMarkdown(value)
          if (value !== record[name]) { changed.add(name); changes[name] = (changes[name] ?? 0) + 1 }
        }
        return [name, value]
      })))
      if (table === 'content_blocks') assert((changes.data_json ?? 0) === markdownEditorModes.reclassified_blocks, 'Markdown reclassification count differs from source census')
      if (table === 'content_documents') assert((changes.visibility ?? 0) === socialPostVisibility.projected_public, 'Social post visibility projection differs from source census')
      if (command === 'transform') {
        const insert = target.prepare(`INSERT INTO ${qi(table)} (${targetColumns.map(qi).join(',')}) VALUES (${targetColumns.map(() => '?').join(',')})`)
        for (const record of projected) insert.run(...targetColumns.map(name => record[name]))
      }
      const actual = target.prepare(`SELECT * FROM ${qi(table)}`).all()
      const retained = targetColumns.filter(name => !changed.has(name))
      assert(records.length === actual.length && digest(projected, targetColumns) === digest(actual, targetColumns), `${table}: target differs from exact projection`)
      assert(digest(records, retained) === digest(actual, retained), `${table}: retained data changed`)
      manifest.tables.push({ table, rows: actual.length, changed_columns: changes, retained_sha256: digest(actual, retained), projected_sha256: digest(actual, targetColumns) })
    }
  }
  if (command === 'transform') target.transaction(transfer)()
  else transfer()
  assert(target.pragma('foreign_key_check').length === 0, 'Foreign key violations')
  assert(target.pragma('integrity_check', { simple: true }) === 'ok', 'Integrity check failed')
  manifest.invariants = auditTargetInvariants(target)
  assert(manifest.invariants.every(result => result.violations === 0), 'Domain invariant violations')
  writeFileSync(`${targetPath}.${command}.json`, JSON.stringify(manifest, null, 2), { mode: 0o600 })
  console.log(`Epoch 6 ${command} passed: ${manifest.tables.length} tables, ${manifest.tables.reduce((n, t) => n + t.rows, 0)} rows, exact retained values and domain invariants verified.`)
} finally { source.close(); target.close() }
