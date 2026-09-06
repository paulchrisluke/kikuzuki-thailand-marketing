import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { publishDuePosts } from '../../server/utils/post-management.ts'

test('scheduled posts compare instants across timezone offsets and publish once', async () => {
  const runtime = new Miniflare({ workers: [{ config: {
    name: 'post-scheduling-proof', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' } } },
    env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await runtime.getD1Database('DB')
    for (const statement of readFileSync('migrations/0000_epoch_5_baseline.sql', 'utf8').split('--> statement-breakpoint').map(sql => sql.trim()).filter(Boolean)) {
      await db.prepare(statement).run()
    }
    for (const statement of [
      "INSERT INTO organization (id, name, slug) VALUES ('org-proof', 'Proof', 'proof')",
      "INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('site-proof', 'org-proof', 'proof', 'proof')",
      "INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status) VALUES ('source-proof', 'org-proof', 'site-proof', 'en', 1, 'published')",
      "INSERT INTO user (id, name, email) VALUES ('user-proof', 'Proof Owner', 'owner@proof.example')",
    ]) await db.prepare(statement).run()
    for (const [id, scheduledFor] of [
      ['negative-offset', '2099-01-01T09:00:00-05:00'],
      ['positive-offset', '2099-01-01T11:00:00+02:00'],
    ]) {
      await db.prepare(`
        INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, summary, status, source, metadata_json, scheduled_for, created_by, updated_at)
        VALUES (?, 'org-proof', 'site-proof', 'social_post', 'root', 'en', 'Scheduled proof', 'scheduled', 'manual', '{"post_type":"standard","channels":{}}', ?, 'user-proof', '2098-12-31T00:00:00.000Z')
      `).bind(id, scheduledFor).run()
    }
    const cutoff = new Date('2099-01-01T10:00:00.000Z')
    assert.deepEqual(await publishDuePosts(db, cutoff), { published: 1 })
    const rows = await db.prepare("SELECT id, status, scheduled_for, published_at FROM content_documents WHERE kind = 'social_post' ORDER BY id").all()
    assert.deepEqual(rows.results, [
      { id: 'negative-offset', status: 'scheduled', scheduled_for: '2099-01-01T09:00:00-05:00', published_at: null },
      { id: 'positive-offset', status: 'published', scheduled_for: null, published_at: '2099-01-01T11:00:00+02:00' },
    ])
    assert.deepEqual(await publishDuePosts(db, cutoff), { published: 0 })
    const finalCutoff = new Date('2099-01-01T14:00:00.000Z')
    const concurrent = await Promise.all([publishDuePosts(db, finalCutoff), publishDuePosts(db, finalCutoff)])
    assert.equal(concurrent.reduce((sum, result) => sum + result.published, 0), 1)
    assert.deepEqual(await publishDuePosts(db, finalCutoff), { published: 0 })
    assert.equal(await db.prepare("SELECT count(*) FROM activity_entries WHERE kind = 'audit'").first('count(*)'), 2)
    assert.equal(await db.prepare("SELECT count(*) FROM content_documents, json_each(metadata_json, '$.channels') WHERE kind = 'social_post'").first('count(*)'), 0)
  } finally {
    await runtime.dispose()
  }
})
