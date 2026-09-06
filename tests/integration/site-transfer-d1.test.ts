import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { executeBatch } from '../../server/db/index.ts'
import { buildSiteTransferMutationBatch } from '../../server/utils/site-transfer.ts'

test('site transfer keeps media identities and retained history in one deferred D1 batch', async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'site-transfer-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': {
      type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }',
    } } }, env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    for (const name of readdirSync('migrations').filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      for (const statement of readFileSync(`migrations/${name}`, 'utf8').split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) await db.prepare(statement).run()
    }
    for (const id of ['sender', 'recipient']) await db.prepare('INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)').bind(id, id, id).run()
    await db.prepare("INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('site', 'sender', 'site', 'site')").run()
    await db.prepare("INSERT INTO media_assets (id, organization_id, site_id, kind, provider, source, r2_key) VALUES ('asset', 'sender', 'site', 'image', 'cloudflare_r2', 'uploaded', 'retained-object')").run()
    await db.prepare("INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id) VALUES ('placement', 'sender', 'site', 'site', 'site', 'logo', 'asset')").run()
    await db.prepare("INSERT INTO blog_posts (id, organization_id, site_id, title, slug) VALUES ('blog', 'sender', 'site', 'Retained title', 'retained-title')").run()
    await db.prepare("INSERT INTO content_documents (id, site_id, owner_type, owner_id) VALUES ('document', 'site', 'tenant_blog', 'blog')").run()
    await db.prepare("INSERT INTO content_blocks (id, document_id, type, data_json) VALUES ('block', 'document', 'markdown', '{\"markdown\":\"Retained content\"}')").run()
    await db.prepare("INSERT INTO usage_events (id, organization_id, site_id, resource, source, quantity, unit, idempotency_key) VALUES ('usage', 'sender', 'site', 'credits', 'test', 1, 'credit', 'historical-usage')").run()
    const snapshot = async () => {
      const result: Record<string, unknown[]> = {}
      for (const table of ['sites', 'media_assets', 'media_placements', 'blog_posts', 'content_documents', 'content_blocks', 'usage_events']) result[table] = (await db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()).results
      return result
    }
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    const before = await snapshot()
    const batch = () => buildSiteTransferMutationBatch({ siteId: 'site', fromOrgId: 'sender', toOrgId: 'recipient', projection: { organizationId: 'recipient', organizationBilling: null }, now: '2026-09-06T00:00:00.000Z', transferId: 'transfer-test' })
    await assert.rejects(executeBatch(db, [...batch(), { query: "SELECT json('deliberate late failure')" }]))
    assert.equal(hash(await snapshot()), hash(before))
    await executeBatch(db, batch())
    const after = await snapshot()
    for (const table of ['media_assets', 'media_placements', 'blog_posts']) assert.deepEqual(after[table], before[table]!.map(row => ({ ...(row as Record<string, unknown>), organization_id: 'recipient' })))
    for (const table of ['content_documents', 'content_blocks', 'usage_events']) assert.equal(hash(after[table]), hash(before[table]))
    assert.equal((await db.prepare("SELECT organization_id FROM sites WHERE id='site'").first<{ organization_id: string }>())?.organization_id, 'recipient')
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
    await assert.rejects(db.prepare("UPDATE media_placements SET organization_id='sender' WHERE id='placement'").run())
    await assert.rejects(executeBatch(db, batch()))
    assert.equal(hash(await snapshot()), hash(after))
  } finally { await miniflare.dispose() }
})
