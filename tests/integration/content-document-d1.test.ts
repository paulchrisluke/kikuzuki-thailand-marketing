import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { Miniflare } from 'miniflare'

import { executeBatch } from '../../server/db/index.ts'
import { resourceLocalizationDeletionQueries } from '../../server/utils/localization.ts'
import { buildMediaPlacementInsertQuery } from '../../server/utils/media-asset-manager.ts'
import {
  createContentDocumentWithBlocks,
  getContentDocumentById,
  listBlocksForDocument,
  prepareContentDocumentBlocksReplacement,
} from '../../server/utils/content-documents.ts'

test('a stale document replacement rolls back owner writes and preserves the winning blocks', async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'content-document-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': {
      type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }',
    } } },
    env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    for (const name of readdirSync('migrations').filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      for (const statement of readFileSync(`migrations/${name}`, 'utf8').split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) {
        await db.prepare(statement).run()
      }
    }
    await db.prepare("INSERT INTO organization (id, name, slug) VALUES ('platform', 'Platform', 'platform')").run()
    await db.prepare("INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('platform', 'platform', 'platform', 'platform')").run()
    await db.prepare("INSERT INTO platform_docs (id, title, slug) VALUES ('owner', 'Original', 'owner')").run()
    const created = await createContentDocumentWithBlocks(db, 'platform_doc', 'owner', [], { siteId: 'platform' })
    const document = await getContentDocumentById(db, created.document.id)
    assert.ok(document)
    const prepare = (label: string) => prepareContentDocumentBlocksReplacement(document, [{
      id: label, type: 'markdown', data: { markdown: label },
    }], {
      expected_document_updated_at: document.updated_at,
      additionalQueriesBefore: [{ query: 'UPDATE platform_docs SET title = ? WHERE id = ?', params: [label, 'owner'] }],
      additionalQueriesAfter: [{ query: 'UPDATE platform_docs SET excerpt = ? WHERE id = ?', params: [label, 'owner'] }],
    })
    const winner = prepare('Winner')
    const stale = prepare('Stale')
    await executeBatch(db, winner.queries)
    await assert.rejects(executeBatch(db, stale.queries))
    assert.deepEqual(await db.prepare("SELECT title, excerpt FROM platform_docs WHERE id = 'owner'").first(), { title: 'Winner', excerpt: 'Winner' })
    assert.deepEqual((await listBlocksForDocument(db, document.id)).map(block => block.id), ['Winner'])

    const current = await getContentDocumentById(db, document.id)
    assert.ok(current)
    const replace = (blocks: Parameters<typeof prepareContentDocumentBlocksReplacement>[1]) => prepareContentDocumentBlocksReplacement(current, blocks, { expected_document_updated_at: current.updated_at })
    assert.throws(() => replace([{ id: 'a', parent_block_id: 'missing', type: 'markdown', data: {} }]), /same document/)
    assert.throws(() => replace([
      { id: 'a', parent_block_id: 'b', type: 'markdown', data: {} },
      { id: 'b', parent_block_id: 'a', type: 'markdown', data: {} },
    ]), /cycle/)
    const hierarchy = replace([
      { id: 'child', parent_block_id: 'parent', type: 'markdown', data: {} },
      { id: 'parent', type: 'markdown', data: {} },
    ])
    await executeBatch(db, hierarchy.queries)
    assert.deepEqual((await listBlocksForDocument(db, document.id)).map(block => [block.id, block.parent_block_id]), [['child', 'parent'], ['parent', null]])
    await assert.rejects(createContentDocumentWithBlocks(db, 'platform_doc', 'missing-owner', [], { siteId: 'platform' }));
    assert.equal(await db.prepare("SELECT id FROM content_documents WHERE owner_id = 'missing-owner'").first(), null)

    await db.prepare("INSERT INTO organization (id, name, slug) VALUES ('org', 'Org', 'org')").run()
    await db.prepare("INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('site', 'org', 'site', 'site')").run()
    await db.prepare("INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status) VALUES ('th', 'org', 'site', 'th', 0, 'published')").run()
    await db.prepare("INSERT INTO blog_posts (id, organization_id, site_id, title, slug) VALUES ('blog', 'org', 'site', 'Blog', 'blog')").run()
    const translated = await createContentDocumentWithBlocks(db, 'resource_localization', 'translation', [{
      id: 'translated-block', type: 'markdown', data: { markdown: 'Translated' },
    }], {
      siteId: 'site',
      documentId: 'translated-document',
      additionalQueriesBefore: [{
        query: "INSERT INTO resource_localizations (id, organization_id, site_id, resource_type, resource_id, locale, values_json, document_id, created_by_user_id, updated_by_user_id) VALUES ('translation', 'org', 'site', 'tenant_blog_post', 'blog', 'th', '{}', 'translated-document', 'actor', 'actor')",
      }],
    })
    assert.equal(translated.document.owner_type, 'resource_localization')
    await executeBatch(db, [
      ...resourceLocalizationDeletionQueries('tenant_blog_post', { query: "SELECT id FROM blog_posts WHERE id = 'blog'" }),
      { query: "DELETE FROM blog_posts WHERE id = 'blog'" },
    ])
    assert.equal(await getContentDocumentById(db, 'translated-document'), undefined)
    assert.equal(await db.prepare("SELECT id FROM resource_localizations WHERE id = 'translation'").first(), null)
    assert.equal(await db.prepare("SELECT id FROM content_blocks WHERE id = 'translated-block'").first(), null)
    await db.prepare("INSERT INTO media_assets (id, organization_id, site_id, kind, provider, source, status) VALUES ('media', 'org', 'site', 'image', 'cloudflare_r2', 'uploaded', 'active')").run()
    const placement = buildMediaPlacementInsertQuery({ organizationId: 'org', siteId: 'site', ownerType: 'blog_post', ownerId: 'blog', slot: 'featured', assetId: 'media', sortOrder: 0 })
    await assert.rejects(executeBatch(db, [placement]))
    await db.prepare("INSERT INTO blog_posts (id, organization_id, site_id, title, slug) VALUES ('blog', 'org', 'site', 'Blog', 'blog')").run()
    await db.prepare("UPDATE media_assets SET status = 'deleted' WHERE id = 'media'").run()
    await assert.rejects(executeBatch(db, [placement]))
    await db.prepare("UPDATE media_assets SET status = 'active' WHERE id = 'media'").run()
    await executeBatch(db, [placement])
    assert.equal(await db.prepare("SELECT COUNT(*) FROM media_placements WHERE asset_id = 'media'").first('COUNT(*)'), 1)
    await db.prepare("DELETE FROM organization WHERE id = 'org'").run()
    assert.equal(await db.prepare("SELECT COUNT(*) FROM content_documents WHERE site_id = 'site'").first('COUNT(*)'), 0)
    assert.equal(await db.prepare("SELECT COUNT(*) FROM media_placements WHERE asset_id = 'media'").first('COUNT(*)'), 0)
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  } finally {
    await miniflare.dispose()
  }
})
