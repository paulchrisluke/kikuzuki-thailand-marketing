#!/usr/bin/env node
// One-time, offline data collapse for #873. Never imported by application runtime.
//
// An article's cover used to be a `media_placements` row on the document
// (`owner_type = 'content_document', slot = 'featured'`). It is now the
// article's leading `image` block, whose asset sits in the block's own `media`
// placement — one set of images, the cover is the lead one, the share card
// derives from it. This script turns every remaining featured placement into
// that leading block, in two phases so the change can straddle a deploy:
//
//   plan   <source.sql|source.sqlite> <out-dir>
//          Reads a private export, writes out-dir/insert-covers.sql (phase 1:
//          insert the leading image block and its placement, shift the other
//          top-level blocks down one), out-dir/delete-featured.sql (phase 2:
//          delete the featured placements) and out-dir/manifest.json. Proves
//          both phases against an in-memory copy with foreign keys enforced
//          before writing anything.
//   verify <target.sql|target.sqlite> <out-dir>/manifest.json
//          Checks a re-export after both phases have run.
//
// Phase 1 is safe under the previous release (it shows the cover twice, once
// as hero and once as the first body image) and phase 2 is safe under the new
// one, so run phase 1 before the deploy converges and phase 2 after it. A
// featured placement whose asset already leads the body is only deleted.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'

const [command, inputPath, outputPath] = process.argv.slice(2)
if (!['plan', 'verify'].includes(command) || !inputPath || !outputPath) {
  throw new Error('Usage: collapse-featured-covers.mjs <plan <source> <out-dir> | verify <target> <manifest.json>>')
}

const assert = (condition, message) => { if (!condition) throw new Error(message) }
const hash = value => createHash('sha256').update(value).digest('hex')
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const COVER_KINDS = new Set(['article', 'platform_doc'])

export function openDatabase(path) {
  if (!path.endsWith('.sql')) return new Database(path, { readonly: true, fileMustExist: true })
  const db = new Database(':memory:')
  db.pragma('foreign_keys = OFF')
  db.exec(readFileSync(path, 'utf8'))
  return db
}

/** A stable, UUID-shaped id derived from the document, so a re-run plans the same blocks. */
function derivedId(kind, documentId) {
  const hex = hash(`${kind}:${documentId}`).slice(0, 32)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

const tableNames = db => db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT IN ('d1_migrations') ORDER BY name").all().map(row => row.name)
const tableDigest = (db, table) => {
  const names = db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name)
  return hash(db.prepare(`SELECT * FROM "${table}"`).all().map(row => JSON.stringify(names.map(name => row[name]))).sort().join('\n'))
}

function featuredPlacements(db) {
  return db.prepare(`
    SELECT mp.id AS placement_id, mp.organization_id, mp.site_id, mp.owner_id AS document_id, mp.asset_id, mp.status, mp.sort_order, d.kind, d.row_role
      FROM media_placements mp JOIN content_documents d ON d.id = mp.owner_id
     WHERE mp.owner_type = 'content_document' AND mp.slot = 'featured'
     ORDER BY d.id, mp.sort_order`).all()
}

function leadingBlock(db, documentId) {
  const block = db.prepare(`SELECT id, type, position FROM content_blocks WHERE document_id = ? AND parent_block_id IS NULL ORDER BY position, created_at LIMIT 1`).get(documentId) ?? null
  if (!block || block.type !== 'image') return { block, assetId: null }
  const placement = db.prepare(`SELECT asset_id FROM media_placements WHERE owner_type = 'content_block' AND owner_id = ? AND slot = 'media' AND sort_order = 0 LIMIT 1`).get(block.id) ?? null
  return { block, assetId: placement?.asset_id ?? null }
}

function plan(db) {
  const rows = featuredPlacements(db)
  const documents = []
  for (const row of rows) {
    assert(COVER_KINDS.has(row.kind), `${row.document_id}: a ${row.kind} carries a featured placement; only articles and docs have covers`)
    assert(row.row_role === 'root', `${row.document_id}: featured placement on a ${row.row_role} row; translations own no cover`)
    assert(row.sort_order === 0 && row.status === 'active', `${row.document_id}: featured placement ${row.placement_id} is not the single active sort_order 0 row`)
    assert(!documents.some(item => item.document_id === row.document_id), `${row.document_id}: more than one featured placement`)
    const asset = db.prepare('SELECT id FROM media_assets WHERE id = ? AND organization_id = ? AND site_id = ?').get(row.asset_id, row.organization_id, row.site_id)
    assert(asset, `${row.document_id}: featured asset ${row.asset_id} is not in the document's site`)
    const lead = leadingBlock(db, row.document_id)
    const duplicate = lead.assetId === row.asset_id
    documents.push({
      document_id: row.document_id, kind: row.kind, organization_id: row.organization_id, site_id: row.site_id, asset_id: row.asset_id,
      featured_placement_id: row.placement_id,
      mode: duplicate ? 'already_leads' : 'insert_leading_block',
      cover_block_id: duplicate ? lead.block.id : derivedId('cover-block', row.document_id),
      cover_placement_id: duplicate ? null : derivedId('cover-placement', row.document_id),
      top_level_blocks_before: db.prepare('SELECT count(*) AS n FROM content_blocks WHERE document_id = ? AND parent_block_id IS NULL').get(row.document_id).n,
    })
  }
  const now = new Date().toISOString()
  const insertStatements = documents.filter(item => item.mode === 'insert_leading_block').flatMap(item => [
    `UPDATE content_blocks SET position = position + 1 WHERE document_id = ${quote(item.document_id)} AND parent_block_id IS NULL;`,
    `INSERT INTO content_blocks (id, document_id, parent_block_id, type, position, level, data_json, created_at, updated_at) VALUES (${quote(item.cover_block_id)}, ${quote(item.document_id)}, NULL, 'image', 0, NULL, '{"caption":""}', ${quote(now)}, ${quote(now)});`,
    `INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status, created_at, updated_at) VALUES (${quote(item.cover_placement_id)}, ${quote(item.organization_id)}, ${quote(item.site_id)}, 'content_block', ${quote(item.cover_block_id)}, 'media', ${quote(item.asset_id)}, 0, 'active', ${quote(now)}, ${quote(now)});`,
  ])
  const deleteStatements = documents.map(item =>
    `DELETE FROM media_placements WHERE id = ${quote(item.featured_placement_id)} AND owner_type = 'content_document' AND slot = 'featured';`)
  return { documents, insertSql: `${insertStatements.join('\n')}\n`, deleteSql: `${deleteStatements.join('\n')}\n` }
}

function assertCollapsed(db, manifest, { afterPhase }) {
  const remaining = featuredPlacements(db)
  if (afterPhase === 2) assert(remaining.length === 0, `${remaining.length} featured placements remain`)
  for (const item of manifest.documents) {
    const lead = leadingBlock(db, item.document_id)
    assert(lead.block?.id === item.cover_block_id && lead.block.position === 0 && lead.block.type === 'image', `${item.document_id}: leading block is not the planned cover block`)
    assert(lead.assetId === item.asset_id, `${item.document_id}: leading image block does not carry the cover asset`)
    const positions = db.prepare('SELECT position FROM content_blocks WHERE document_id = ? AND parent_block_id IS NULL ORDER BY position').all(item.document_id).map(row => row.position)
    const expectedCount = item.top_level_blocks_before + (item.mode === 'insert_leading_block' ? 1 : 0)
    assert(positions.length === expectedCount && positions.every((position, index) => position === index), `${item.document_id}: top-level block positions are not 0..${expectedCount - 1}`)
    const featured = db.prepare("SELECT count(*) AS n FROM media_placements WHERE id = ? AND owner_type = 'content_document' AND slot = 'featured'").get(item.featured_placement_id).n
    assert(featured === (afterPhase === 2 ? 0 : 1), `${item.document_id}: featured placement ${afterPhase === 2 ? 'still present' : 'missing before phase 2'}`)
  }
  assert(db.pragma('integrity_check')[0].integrity_check === 'ok', 'integrity_check failed')
  assert(db.pragma('foreign_key_check').length === 0, 'foreign_key_check failed')
}

if (command === 'plan') {
  const source = openDatabase(resolve(inputPath))
  const outDir = resolve(outputPath)
  const { documents, insertSql, deleteSql } = plan(source)
  const manifest = {
    generated_at: new Date().toISOString(),
    source: { path: resolve(inputPath), sha256: hash(readFileSync(resolve(inputPath))) },
    counts: {
      documents: documents.length,
      inserted_blocks: documents.filter(item => item.mode === 'insert_leading_block').length,
      already_leading: documents.filter(item => item.mode === 'already_leads').length,
      by_kind: Object.fromEntries([...COVER_KINDS].map(kind => [kind, documents.filter(item => item.kind === kind).length])),
    },
    phases: { insert_covers_sha256: hash(insertSql), delete_featured_sha256: hash(deleteSql) },
    documents,
  }

  // Prove both phases offline before writing anything, with foreign keys on
  // and every table other than the two we touch required to come out identical.
  const replay = new Database(source.serialize())
  replay.pragma('foreign_keys = ON')
  const untouched = Object.fromEntries(tableNames(replay).filter(table => !['content_blocks', 'media_placements'].includes(table)).map(table => [table, tableDigest(replay, table)]))
  replay.exec(`BEGIN;\n${insertSql}COMMIT;`)
  assertCollapsed(replay, manifest, { afterPhase: 1 })
  replay.exec(`BEGIN;\n${deleteSql}COMMIT;`)
  assertCollapsed(replay, manifest, { afterPhase: 2 })
  for (const [table, digest] of Object.entries(untouched)) assert(tableDigest(replay, table) === digest, `${table} changed during the collapse`)
  replay.close()

  mkdirSync(outDir, { recursive: true })
  writeFileSync(join(outDir, 'insert-covers.sql'), insertSql, { mode: 0o600 })
  writeFileSync(join(outDir, 'delete-featured.sql'), deleteSql, { mode: 0o600 })
  writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  console.log(JSON.stringify({ ...manifest.counts, replay: 'exact', out_dir: outDir }))
} else {
  const manifestPath = resolve(outputPath)
  assert(existsSync(manifestPath), `manifest not found: ${manifestPath}`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const target = openDatabase(resolve(inputPath))
  assertCollapsed(target, manifest, { afterPhase: 2 })
  console.log(JSON.stringify({ documents: manifest.documents.length, featured_remaining: 0, verified: true }))
}
