import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import Database from 'better-sqlite3'

test('epoch transfer preserves retained records, removes duplicate dates and rejects unsafe replay', t => {
  const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-epoch6-proof-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sourcePath = join(directory, 'source.sqlite'), targetPath = join(directory, 'target.sqlite')
  const source = new Database(sourcePath)
  source.exec(readFileSync('migrations-archive/epoch-5/0000_epoch_5_baseline.sql', 'utf8'))
  source.prepare("INSERT INTO organization (id,name,slug) VALUES ('org','Proof','proof')").run()
  source.prepare("INSERT INTO sites (id,organization_id,slug,subdomain) VALUES ('site','org','proof','proof')").run()
  source.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('locale','org','site','en',1,'published')").run()
  source.prepare("INSERT INTO customers (id,organization_id,site_id,name,source,last_booking_at,last_review_at,created_at) VALUES ('customer','org','site','Retained name','manual','2026-07-25T12:30:00','2026-07-01T01:00:00.000Z','2026-07-01 00:00:00')").run()
  for (const kind of ['plan', 'reset', 'manual']) source.prepare("INSERT INTO usage_quota_grants (id,organization_id,resource,quantity,unit,period_key,period_start,period_end,grant_type,reason,idempotency_key) VALUES (?,'org','ai_inference',500,'credit','week:2026-07-20','2026-07-20 00:00:00','2026-07-27 00:00:00',?,'Proof',?)").run(kind, kind, kind)
  source.prepare("INSERT INTO usage_events (id,organization_id,site_id,resource,source,quantity,unit,idempotency_key,created_at) VALUES ('history','org','site','ai_inference','seed',25,'credit','history','2026-07-01 00:00:00')").run()
  const grantColumns = source.pragma('table_info(usage_quota_grants)').map(column => column.name)
  const grantHash = createHash('sha256').update(source.prepare('SELECT * FROM usage_quota_grants').all().map(row => JSON.stringify(grantColumns.map(name => row[name]))).sort().join('\n')).digest('hex')
  source.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,status,visibility,title,slug) VALUES ('document','org','site','article','root','en','published','public','Proof','proof')").run()
  source.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,summary,status,published_at,source,metadata_json) VALUES ('social','org','site','social_post','root','en','Proof post','published','2026-07-01T00:00:00.000Z','manual',?)").run(JSON.stringify({ post_type: 'standard', channels: {} }))
  const prose = String.raw`{ "nested": {"editor_mode":"source"}, "markdown": "**Prose** with \"quotes\" and Unicode ☃", "editor_mode" : "source", "extra": [1e3, {"keep":true}] }`
  const alts = ['article_inline_image', 'file.png', 'A person reading.', 'Portrait', '', null, 'two_words with prose']
  for (const [index, alt] of alts.entries()) source.prepare("INSERT INTO media_assets (id,organization_id,site_id,kind,provider,source,alt_text) VALUES (?,'org','site','image','cloudflare_images','uploaded',?)").run(`asset-${index}`, alt)
  const blocks = [
    ['prose', 'markdown', prose, prose.replace('"editor_mode" : "source"', '"editor_mode" : "rich"')],
    ['empty', 'markdown', '{"markdown":"","editor_mode":"source"}', '{"markdown":"","editor_mode":"rich"}'],
    ['escaped', 'markdown', String.raw`{"markdown":"A paragraph","editor_\u006dode":"\u0073ource"}`, String.raw`{"markdown":"A paragraph","editor_\u006dode":"rich"}`],
    ['table', 'markdown', '{"markdown":"| A | B |\\n| - | - |","editor_mode":"source"}'],
    ['html', 'markdown', '{"markdown":"<DIV>Keep HTML</DIV>","editor_mode":"source"}'],
    ['rich', 'markdown', '{ "editor_mode": "rich", "markdown": "Already visual" }'],
    ['missing-prose', 'markdown', '{ "markdown":"Prose", "nested":{"editor_mode":null}, "extra":1e3 }', '{ "markdown":"Prose", "nested":{"editor_mode":null}, "extra":1e3 ,"editor_mode":"rich"}'],
    ['missing-html', 'markdown', '{"markdown":"<div>HTML</div>"}', '{"markdown":"<div>HTML</div>","editor_mode":"source"}'],
    ['null-prose', 'markdown', '{ "editor_mode" : null, "markdown":"" }', '{ "editor_mode" : "rich", "markdown":"" }'],
    ['null-table', 'markdown', String.raw`{"markdown":"| A | B |","editor_\u006dode":null,"nested":[null,true,1e3]}`, String.raw`{"markdown":"| A | B |","editor_\u006dode":"source","nested":[null,true,1e3]}`],
    ['image-alt', 'image', '{ "field":"image", "alt":"Stale", "asset_id":"asset-0" }', '{ "field":"image", "asset_id":"asset-0" }'],
    ['image-alt-last', 'image', '{"field":"image","alt":"Stale"}', '{"field":"image"}'],
    ['legacy-grid', 'feature_grid', '{ "type":"team", "features":[], "people":[{"type":"keep","value":1e3}], "legacy_type":"team" }', '{  "features":[], "people":[{"type":"keep","value":1e3}] }'],
    ['heading', 'heading', '{"editor_mode":"source","text":"A heading"}'],
    ['heading-bold', 'heading', '{ "text" : "**Plain heading**", "level":2, "nested":{"text":"**Keep**"}, "unknown":1e3 }', '{ "text" : "Plain heading", "level":2, "nested":{"text":"**Keep**"}, "unknown":1e3 }'],
    ['heading-escaped', 'heading', String.raw`{"te\u0078t":"**1\\. Excessive Delays in Evaluations**","level":2}`, String.raw`{"te\u0078t":"1. Excessive Delays in Evaluations","level":2}`],
    ['heading-literal', 'heading', String.raw`{"text":"Literal_under_score and C:\\files","unknown":"**keep**"}`],
  ]
  for (const [id, type, data] of blocks) source.prepare("INSERT INTO content_blocks (id,document_id,type,data_json) VALUES (?,'document',?,?)").run(id, type, data)
  const guidanceId = 'migrated-tenant-page-block:migrated-tenant-page-variant:page_ncls_schedule:en:component:1'
  const guidanceData = JSON.stringify({ type: 'schedule_guidance', legacy_type: 'schedule_guidance',
    ...Object.fromEntries(['content', 'title', 'description', 'prepTitle', 'expectationsTitle', 'detailsTitle', 'detailsText', 'trustTitle', 'trustText', 'noticeTitle', 'notice', 'buttonText', 'buttonUrl'].map(key => [key, `Preserved ${key}`])),
    prepItems: ['Prepare'], expectationItems: ['Expect'], decoration: { preserved: 1000, content: 'Nested content remains' },
  }, null, 2).replace('1000', '1e3')
  source.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,status,title,slug,path,metadata_json) VALUES ('page_ncls_schedule','org','site','page','root','en','published','Schedule','schedule','/schedule',?)").run(JSON.stringify({ page_type: 'recipe' }))
  source.prepare("INSERT INTO content_blocks (id,document_id,type,data_json,created_at,updated_at) VALUES (?,'page_ncls_schedule','markdown',?,'2026-07-01T00:00:00.000Z','2026-07-01T00:00:00.000Z')").run(guidanceId, guidanceData)
  const guidanceSource = source.prepare('SELECT * FROM content_blocks WHERE id = ?').get(guidanceId)
  source.close()
  const run = (command, output = targetPath) => spawnSync(process.execPath, ['scripts/epoch6-data.mjs', command, sourcePath, output], { cwd: resolve('.'), encoding: 'utf8' })
  const transformed = run('transform')
  assert.equal(transformed.status, 0, transformed.stderr)
  const target = new Database(targetPath)
  assert.deepEqual(target.prepare('SELECT name,created_at FROM customers').get(), { name: 'Retained name', created_at: '2026-07-01T00:00:00.000Z' })
  assert.equal(target.pragma('table_info(customers)').some(column => ['last_booking_at','last_review_at'].includes(column.name)), false)
  assert.equal(target.pragma('table_info(usage_quota_grants)').length, 0)
  assert.deepEqual(target.prepare('SELECT id,quantity,unit,created_at FROM usage_events').get(), { id: 'history', quantity: 25, unit: 'credit', created_at: '2026-07-01T00:00:00.000Z' })
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.transform.json`, 'utf8')).retired_tables, [{ table: 'usage_quota_grants', rows: 3, source_sha256: grantHash }])
  const manifest = JSON.parse(readFileSync(`${targetPath}.transform.json`, 'utf8'))
  assert.deepEqual(manifest.markdown_editor_modes, { total_blocks: 11, source_blocks: 5, requires_source: 2, reclassified_blocks: 3,
    missing_blocks: 3, null_blocks: 2, backfilled_source: 2, backfilled_rich: 3 })
  assert.deepEqual(manifest.social_post_visibility, { source_nulls: 1, projected_public: 1 })
  assert.deepEqual(manifest.heading_text, { total_blocks: 4, normalized_blocks: 2, escaped_punctuation_blocks: 1 })
  const guidanceTarget = target.prepare('SELECT * FROM content_blocks WHERE id = ?').get(guidanceId)
  assert.equal(guidanceTarget.type, 'markdown')
  assert.deepEqual(JSON.parse(guidanceTarget.data_json), { markdown: 'Preserved content', decoration: { preserved: 1000, content: 'Nested content remains' }, editor_mode: 'rich' })
  assert(guidanceTarget.data_json.includes('1e3'))
  assert.deepEqual({ ...guidanceTarget, data_json: guidanceSource.data_json }, guidanceSource)
  assert.equal(manifest.residue_cleanup.changed_blocks, 4)
  assert.equal(manifest.residue_cleanup.legacy_type_blocks, 2)
  assert.equal(manifest.residue_cleanup.duplicate_type_blocks, 2)
  assert.equal(manifest.residue_cleanup.image_alt_blocks, 2)
  assert.equal(manifest.residue_cleanup.flattened_markdown_blocks, 1)
  assert.deepEqual(manifest.block_reconciliation, { changed_blocks: 13, overlapping_projections: 1 })
  assert.equal(manifest.media_alt_text.source_machine_keys, 2)
  assert.equal(manifest.media_alt_text.projected_nulls, 2)
  for (const [index, alt] of alts.entries()) assert.equal(target.prepare('SELECT alt_text FROM media_assets WHERE id=?').get(`asset-${index}`).alt_text, index < 2 ? null : alt)
  target.prepare("UPDATE media_assets SET alt_text=NULL WHERE id='asset-2'").run()
  assert.match(run('verify').stderr, /media_assets: target differs from exact projection/)
  target.prepare("UPDATE media_assets SET alt_text=? WHERE id='asset-2'").run(alts[2])
  assert.equal(manifest.tables.find(table => table.table === 'content_blocks').changed_columns.type, undefined)
  assert.equal(manifest.tables.find(table => table.table === 'content_blocks').changed_columns.data_json, 13)
  assert.equal(manifest.tables.find(table => table.table === 'content_documents').changed_columns.visibility, 1)
  assert.equal(target.prepare("SELECT visibility FROM content_documents WHERE id = 'social'").get().visibility, 'public')
  for (const [id, , original, projected = original] of blocks) assert.equal(target.prepare('SELECT data_json FROM content_blocks WHERE id = ?').get(id).data_json, projected)
  assert.equal(run('verify').status, 0)
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.verify.json`, 'utf8')).markdown_editor_modes, manifest.markdown_editor_modes)
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.verify.json`, 'utf8')).heading_text, manifest.heading_text)
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.verify.json`, 'utf8')).residue_cleanup, manifest.residue_cleanup)
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.verify.json`, 'utf8')).social_post_visibility, manifest.social_post_visibility)
  const originalProse = target.prepare("SELECT data_json FROM content_blocks WHERE id = 'prose'").get().data_json
  for (const corrupted of [
    originalProse.replace('**Prose**', '**Changed**'),
    originalProse.replace('1e3', '1000'),
    originalProse.replace('"keep":true', '"keep":false'),
    originalProse.replace('"editor_mode" : "rich"', '"editor_mode" : "source"'),
  ]) {
    target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'prose'").run(corrupted)
    const rejected = run('verify')
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /content_blocks: target differs from exact projection/)
  }
  target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'prose'").run(originalProse)
  const missingProse = target.prepare("SELECT data_json FROM content_blocks WHERE id = 'missing-prose'").get().data_json
  for (const corrupted of [
    missingProse.replace(',"editor_mode":"rich"', ''),
    missingProse.replace('"editor_mode":"rich"', '"editor_mode":"source"'),
    JSON.stringify(JSON.parse(missingProse)),
  ]) {
    target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'missing-prose'").run(corrupted)
    const rejected = run('verify')
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /content_blocks: target differs from exact projection/)
  }
  target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'missing-prose'").run(missingProse)
  const heading = target.prepare("SELECT data_json FROM content_blocks WHERE id = 'heading-bold'").get().data_json
  for (const corrupted of [
    heading.replace('"Plain heading"', '"**Plain heading**"'),
    heading.replace('"**Keep**"', '"Keep"'),
    heading.replace('1e3', '1000'),
  ]) {
    target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'heading-bold'").run(corrupted)
    const rejected = run('verify')
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /content_blocks: target differs from exact projection/)
  }
  target.prepare("UPDATE content_blocks SET data_json = ? WHERE id = 'heading-bold'").run(heading)
  for (const [type, data] of [['heading', guidanceTarget.data_json], ['markdown', guidanceTarget.data_json.replace('1e3', '1000')], ['markdown', guidanceData]]) {
    target.prepare('UPDATE content_blocks SET type = ?, data_json = ? WHERE id = ?').run(type, data, guidanceId)
    const rejected = run('verify')
    assert.notEqual(rejected.status, 0)
    assert.match(rejected.stderr, /content_blocks: target differs from exact projection/)
  }
  target.prepare('UPDATE content_blocks SET type = ?, data_json = ? WHERE id = ?').run('markdown', guidanceTarget.data_json, guidanceId)
  assert.notEqual(run('transform').status, 0)
  target.prepare("UPDATE customers SET name='Tampered'").run()
  target.close()
  assert.notEqual(run('verify').status, 0)
  const malformed = new Database(sourcePath)
  for (const [name, type, document, data, error] of [
    ['guidance-type', 'heading', 'page_ncls_schedule', guidanceData, /unexpected residue source key set/],
    ['guidance-document', 'markdown', 'document', guidanceData, /unexpected schedule guidance source payload/],
    ['guidance-payload', 'markdown', 'page_ncls_schedule', guidanceData.replace('"legacy_type": "schedule_guidance"', '"legacy_type": "other"'), /unexpected schedule guidance source payload/],
  ]) {
    malformed.prepare('UPDATE content_blocks SET type = ?, document_id = ?, data_json = ? WHERE id = ?').run(type, document, data, guidanceId)
    const rejectedGuidance = run('transform', join(directory, `${name}.sqlite`))
    assert.notEqual(rejectedGuidance.status, 0)
    assert.match(rejectedGuidance.stderr, error)
  }
  malformed.prepare('UPDATE content_blocks SET type = ?, document_id = ?, data_json = ? WHERE id = ?').run('markdown', 'page_ncls_schedule', guidanceData, guidanceId)
  for (const [name, type, data, error] of [
    ['missing-markdown', 'markdown', '{"title":"Keep this component"}', /markdown requiring editor_mode reconciliation must be a string/],
    ['residue-unknown-key', 'feature_grid', '{"type":"team","legacy_type":"team","features":[],"people":[],"unexpected":true}', /unexpected residue source key set/],
    ['residue-discriminator', 'feature_grid', '{"type":"other","legacy_type":"team","features":[],"people":[]}', /unexpected residue discriminator/],
    ['image-unknown-key', 'image', '{"field":"image","alt":"Stale","unexpected":true}', /unexpected residue source key set/],
    ['residue-duplicate-key', 'image', '{"field":"image","alt":"A","alt":"B"}', /ambiguous or missing alt/],
    ['null-markdown', 'markdown', '{"markdown":null,"editor_mode":null}', /markdown requiring editor_mode reconciliation must be a string/],
    ['rich-missing-markdown', 'markdown', '{"editor_mode":"rich"}', /markdown requiring editor_mode reconciliation must be a string/],
    ['unknown-mode', 'markdown', '{"markdown":"Prose","editor_mode":"visual"}', /unexpected editor_mode requires an explicit mapping/],
    ['nonstring-mode', 'markdown', '{"markdown":"Prose","editor_mode":false}', /unexpected editor_mode requires an explicit mapping/],
    ['rich-table', 'markdown', '{"markdown":"| A | B |","editor_mode":"rich"}', /rich markdown requires source mode/],
    ['rich-html', 'markdown', '{"markdown":"<div>HTML</div>","editor_mode":"rich"}', /rich markdown requires source mode/],
    ['duplicate-mode', 'markdown', '{"markdown":"Prose","editor_mode":null,"editor_mode":null}', /ambiguous editor_mode/],
    ['heading-extra-change', 'heading', '{"text":"**Keep  two spaces**"}', /heading normalization changes more than/],
    ['duplicate-heading-text', 'heading', '{"text":"First","text":"**Second**"}', /ambiguous text/],
  ]) {
    malformed.prepare("UPDATE content_blocks SET type = ?, data_json = ? WHERE id = 'prose'").run(type, data)
    const rejectedBlock = run('transform', join(directory, `${name}.sqlite`))
    assert.notEqual(rejectedBlock.status, 0)
    assert.match(rejectedBlock.stderr, error)
  }
  malformed.prepare("UPDATE content_blocks SET type = 'markdown', data_json = ? WHERE id = 'prose'").run(prose)
  malformed.prepare("UPDATE customers SET created_at='2026-07-01T00:00:00'").run()
  malformed.close()
  const rejected = run('transform', join(directory, 'invalid.sqlite'))
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /timestamp has no declared source zone/)
})

for (const [name, sql, error] of [
  ['absent schedule guidance row', '', null],
  ['unknown resource', "UPDATE usage_quota_grants SET resource='storage'", /unrecognized grant use/],
  ['unknown unit', "UPDATE usage_quota_grants SET unit='byte'", /unrecognized grant use/],
  ['unknown grant type', "PRAGMA ignore_check_constraints=ON; UPDATE usage_quota_grants SET grant_type='purchase'", /unrecognized grant use/],
  ['unexpected retired column', 'ALTER TABLE usage_quota_grants ADD COLUMN external_obligation TEXT', /undeclared column change/],
  ['unexpected retained column', 'ALTER TABLE usage_events ADD COLUMN external_obligation TEXT', /undeclared column change/],
  ['unexpected table', 'CREATE TABLE external_obligations (id TEXT)', /table inventory differs/],
  ['missing retired table', 'DROP TABLE usage_quota_grants', /table inventory differs/],
]) test(`epoch transfer ${error ? 'rejects' : 'accepts'} ${name}`, t => {
  const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-epoch6-retirement-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sourcePath = join(directory, 'source.sqlite')
  const source = new Database(sourcePath)
  source.exec(readFileSync('migrations-archive/epoch-5/0000_epoch_5_baseline.sql', 'utf8'))
  source.prepare("INSERT INTO organization (id,name,slug) VALUES ('org','Proof','proof')").run()
  source.prepare("INSERT INTO usage_quota_grants (id,organization_id,resource,quantity,unit,period_key,period_start,period_end,grant_type,reason,idempotency_key) VALUES ('grant','org','ai_inference',500,'credit','week:2026-07-20','2026-07-20 00:00:00','2026-07-27 00:00:00','plan','Proof','grant')").run()
  source.exec(sql)
  source.close()
  const result = spawnSync(process.execPath, ['scripts/epoch6-data.mjs', 'transform', sourcePath, join(directory, 'target.sqlite')], { cwd: resolve('.'), encoding: 'utf8' })
  if (error) {
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, error)
  } else {
    assert.equal(result.status, 0, result.stderr)
    const manifest = JSON.parse(readFileSync(join(directory, 'target.sqlite.transform.json'), 'utf8'))
    assert.equal(manifest.residue_cleanup.changed_blocks, 0)
    assert.deepEqual(manifest.block_reconciliation, { changed_blocks: 0, overlapping_projections: 0 })
  }
})
