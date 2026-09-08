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
  const blocks = [
    ['prose', 'markdown', prose, prose.replace('"editor_mode" : "source"', '"editor_mode" : "rich"')],
    ['empty', 'markdown', '{"markdown":"","editor_mode":"source"}', '{"markdown":"","editor_mode":"rich"}'],
    ['escaped', 'markdown', String.raw`{"markdown":"A paragraph","editor_\u006dode":"\u0073ource"}`, String.raw`{"markdown":"A paragraph","editor_\u006dode":"rich"}`],
    ['table', 'markdown', '{"markdown":"| A | B |\\n| - | - |","editor_mode":"source"}'],
    ['html', 'markdown', '{"markdown":"<DIV>Keep HTML</DIV>","editor_mode":"source"}'],
    ['rich', 'markdown', '{ "editor_mode": "rich", "markdown": "Already visual" }'],
    ['heading', 'heading', '{"editor_mode":"source","text":"A heading"}'],
  ]
  for (const [id, type, data] of blocks) source.prepare("INSERT INTO content_blocks (id,document_id,type,data_json) VALUES (?,'document',?,?)").run(id, type, data)
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
  assert.deepEqual(manifest.markdown_editor_modes, { source_blocks: 5, requires_source: 2, reclassified_blocks: 3 })
  assert.deepEqual(manifest.social_post_visibility, { source_nulls: 1, projected_public: 1 })
  assert.equal(manifest.tables.find(table => table.table === 'content_blocks').changed_columns.data_json, 3)
  assert.equal(manifest.tables.find(table => table.table === 'content_documents').changed_columns.visibility, 1)
  assert.equal(target.prepare("SELECT visibility FROM content_documents WHERE id = 'social'").get().visibility, 'public')
  for (const [id, , original, projected = original] of blocks) assert.equal(target.prepare('SELECT data_json FROM content_blocks WHERE id = ?').get(id).data_json, projected)
  assert.equal(run('verify').status, 0)
  assert.deepEqual(JSON.parse(readFileSync(`${targetPath}.verify.json`, 'utf8')).markdown_editor_modes, manifest.markdown_editor_modes)
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
  assert.notEqual(run('transform').status, 0)
  target.prepare("UPDATE customers SET name='Tampered'").run()
  target.close()
  assert.notEqual(run('verify').status, 0)
  const malformed = new Database(sourcePath)
  malformed.prepare("UPDATE customers SET created_at='2026-07-01T00:00:00'").run()
  malformed.close()
  const rejected = run('transform', join(directory, 'invalid.sqlite'))
  assert.notEqual(rejected.status, 0)
  assert.match(rejected.stderr, /timestamp has no declared source zone/)
})

for (const [name, sql, error] of [
  ['unknown resource', "UPDATE usage_quota_grants SET resource='storage'", /unrecognized grant use/],
  ['unknown unit', "UPDATE usage_quota_grants SET unit='byte'", /unrecognized grant use/],
  ['unknown grant type', "PRAGMA ignore_check_constraints=ON; UPDATE usage_quota_grants SET grant_type='purchase'", /unrecognized grant use/],
  ['unexpected retired column', 'ALTER TABLE usage_quota_grants ADD COLUMN external_obligation TEXT', /undeclared column change/],
  ['unexpected retained column', 'ALTER TABLE usage_events ADD COLUMN external_obligation TEXT', /undeclared column change/],
  ['unexpected table', 'CREATE TABLE external_obligations (id TEXT)', /table inventory differs/],
  ['missing retired table', 'DROP TABLE usage_quota_grants', /table inventory differs/],
]) test(`epoch transfer rejects ${name}`, t => {
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
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, error)
})
