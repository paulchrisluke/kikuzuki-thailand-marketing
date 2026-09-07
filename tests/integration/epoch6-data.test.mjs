import assert from 'node:assert/strict'
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
  source.close()
  const run = (command, output = targetPath) => spawnSync(process.execPath, ['scripts/epoch6-data.mjs', command, sourcePath, output], { cwd: resolve('.'), encoding: 'utf8' })
  const transformed = run('transform')
  assert.equal(transformed.status, 0, transformed.stderr)
  const target = new Database(targetPath)
  assert.deepEqual(target.prepare('SELECT name,created_at FROM customers').get(), { name: 'Retained name', created_at: '2026-07-01T00:00:00.000Z' })
  assert.equal(target.pragma('table_info(customers)').some(column => ['last_booking_at','last_review_at'].includes(column.name)), false)
  assert.equal(run('verify').status, 0)
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
