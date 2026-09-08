import assert from 'node:assert/strict'
import test from 'node:test'
import { writeFileSync } from 'node:fs'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import { Miniflare } from 'miniflare'
import * as schema from '../../server/db/schema.ts'
import { createPlatformBlogPost, updatePlatformBlogPost } from '../../server/utils/platform-content.ts'

test('canonical blog writes preserve editor mode and root-relative canonical URLs', { timeout: 120_000 }, async t => {
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'markdown-api-proof', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' } } },
    env: { DB: { type: 'd1' } },
  } }] })
  t.after(() => runtime.dispose())
  const db = await runtime.getD1Database('DB')
  const statements = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema))
  await db.batch(statements.map(statement => db.prepare(statement)))
  await db.prepare("INSERT INTO organization (id,name,slug) VALUES ('platform','Platform','platform')").run()
  await db.prepare("INSERT INTO sites (id,organization_id,slug) VALUES ('platform','platform','platform')").run()
  await db.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('en','platform','platform','en',1,'published')").run()
  await db.prepare('INSERT INTO user (id,name,email) VALUES (?,?,?)').bind('probe-author', 'Probe Author', 'probe-author@example.test').run()
  const results = []
  const cases = [
    ['rich prose', '**Visual prose**', 'rich', '/article/path', true],
    ['rich table', '| A | B |\n| - | - |', 'rich', '/article/path', false],
    ['rich HTML', '<div>HTML</div>', 'rich', '/article/path', false],
    ['source table', '| A | B |\n| - | - |', 'source', '/article/path', true],
    ['source HTML', '<div>HTML</div>', 'source', '/article/path', true],
    ['absolute canonical', 'Prose', 'rich', 'https://example.test/article/path', true],
    ['protocol-relative canonical', 'Prose', 'rich', '//evil.example/path', false],
    ['slash-backslash canonical', 'Prose', 'rich', '/\\evil.example/path', false],
  ]
  for (const [name, markdown, editor_mode, canonical_url, accepts] of cases) {
    const input = { title: name, category: 'Technology', canonical_url, content_blocks: [{ type: 'markdown', data: { markdown, editor_mode } }] }
    if (!accepts) {
      const before = await db.prepare('SELECT COUNT(*) AS count FROM content_documents').first('count')
      await assert.rejects(createPlatformBlogPost(db, 'probe-author', input), error => error.statusCode === 400)
      assert.equal(await db.prepare('SELECT COUNT(*) AS count FROM content_documents').first('count'), before)
    } else {
      const created = await createPlatformBlogPost(db, 'probe-author', input)
      assert.equal(created.success, true)
      assert.equal(await db.prepare('SELECT canonical_url FROM content_documents WHERE id=?').bind(created.id).first('canonical_url'), canonical_url)
      const stored = await db.prepare('SELECT data_json FROM content_blocks WHERE document_id=?').bind(created.id).first('data_json')
      assert.deepEqual(JSON.parse(stored), { markdown, editor_mode })
    }
    results.push({ operation: 'create', case: name, result: accepts ? 'persisted unchanged' : 'rejected 400 without write' })
  }
  const base = await createPlatformBlogPost(db, 'probe-author', { title: 'Update proof', category: 'Technology', content_blocks: [{ type: 'markdown', data: { markdown: 'Initial', editor_mode: 'rich' } }] })
  for (const [name, markdown, editor_mode, canonical_url, accepts] of cases) {
    const before = await db.prepare('SELECT canonical_url,updated_at FROM content_documents WHERE id=?').bind(base.id).first()
    const beforeBlocks = (await db.prepare('SELECT id,data_json FROM content_blocks WHERE document_id=?').bind(base.id).all()).results
    const input = { canonical_url, expected_updated_at: before.updated_at, content_blocks: [{ type: 'markdown', data: { markdown, editor_mode } }] }
    if (!accepts) {
      await assert.rejects(updatePlatformBlogPost(db, base.id, input), error => error.statusCode === 400)
      assert.deepEqual(await db.prepare('SELECT canonical_url,updated_at FROM content_documents WHERE id=?').bind(base.id).first(), before)
      assert.deepEqual((await db.prepare('SELECT id,data_json FROM content_blocks WHERE document_id=?').bind(base.id).all()).results, beforeBlocks)
    } else {
      assert.equal((await updatePlatformBlogPost(db, base.id, input)).success, true)
      assert.equal(await db.prepare('SELECT canonical_url FROM content_documents WHERE id=?').bind(base.id).first('canonical_url'), canonical_url)
      const stored = await db.prepare('SELECT data_json FROM content_blocks WHERE document_id=?').bind(base.id).first('data_json')
      assert.deepEqual(JSON.parse(stored), { markdown, editor_mode })
    }
    results.push({ operation: 'update', case: name, result: accepts ? 'persisted unchanged' : 'rejected 400 without write' })
  }
  assert.deepEqual((await db.prepare('PRAGMA foreign_key_check').all()).results, [])
  writeFileSync('.audit/pr864/markdown-api-probe.json', JSON.stringify({ node: process.version, boundary: 'real Miniflare D1, actual createPlatformBlogPost and updatePlatformBlogPost, platform scope', cases: results, foreign_keys: 'passed', production_writes: false }, null, 2))
})
