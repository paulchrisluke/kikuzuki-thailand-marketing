import assert from 'node:assert/strict'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import * as schema from '../../server/db/schema.ts'
import { executeBatch } from '../../server/db/index.ts'
import {
  createContentDocumentWithBlocks, getContentDocumentById, listBlocksForDocument,
  prepareContentDocumentUpdate, prepareContentDocumentDeletion, updateContentDocument,
} from '../../server/utils/content-documents.ts'

test('document scopes, translations, block ownership and concurrent edits persist through real D1', async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'content-document-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': {
      type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }',
    } } }, env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    const empty = await generateSQLiteDrizzleJson({})
    const currentSchema = await generateSQLiteDrizzleJson(schema)
    for (const statement of await generateSQLiteMigration(empty, currentSchema)) await db.prepare(statement).run()
    for (const id of ['one', 'two']) {
      await db.prepare('INSERT INTO organization (id, name, slug) VALUES (?, ?, ?)').bind(id, id, id).run()
      await db.prepare('INSERT INTO sites (id, organization_id, slug, subdomain) VALUES (?, ?, ?, ?)').bind(id, id, id, id).run()
      for (const locale of ['en', 'th']) await db.prepare('INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id + locale, id, id, locale, Number(locale === 'en'), 'published').run()
    }
    const { document } = await createContentDocumentWithBlocks(db, {
      id: 'article', organizationId: 'one', siteId: 'one', kind: 'article', rowRole: 'root', locale: 'en',
      title: 'Original', slug: 'article', status: 'published', visibility: 'public',
    }, [{ id: 'body', type: 'markdown', data: { markdown: 'Original' } }])
    const prepare = (label: string) => prepareContentDocumentUpdate(document, { expected_updated_at: document.updated_at,
      changes: { title: label, summary: label }, blocks: [{ id: 'body', type: 'markdown', data: { markdown: label } }],
    })
    await executeBatch(db, prepare('Winner').queries)
    await assert.rejects(executeBatch(db, prepare('Stale').queries))
    assert.deepEqual(await db.prepare("SELECT title, summary FROM content_documents WHERE id = 'article'").first(), { title: 'Winner', summary: 'Winner' })
    assert.equal(JSON.parse((await listBlocksForDocument(db, document.id))[0]!.data_json).markdown, 'Winner')
    const translated = await createContentDocumentWithBlocks(db, { id: 'translation', organizationId: 'one', siteId: 'one',
      kind: 'article', rowRole: 'representation', rootId: document.id, locale: 'th', title: 'Translated', slug: 'translated' },
    [{ id: 'translated-body', type: 'markdown', data: { markdown: 'Translated' } }])
    await assert.rejects(createContentDocumentWithBlocks(db, { organizationId: 'two', siteId: 'two', kind: 'article',
      rowRole: 'representation', rootId: document.id, locale: 'th' }, []))
    await assert.rejects(createContentDocumentWithBlocks(db, { organizationId: 'one', siteId: 'one', kind: 'qa',
      rowRole: 'representation', rootId: document.id, locale: 'th' }, []))
    await assert.rejects(createContentDocumentWithBlocks(db, { organizationId: 'one', siteId: 'one', kind: 'article',
      rowRole: 'representation', rootId: translated.document.id, locale: 'th' }, []))
    await assert.rejects(updateContentDocument(db, translated.document.id, { expected_updated_at: translated.document.updated_at,
      blocks: [{ id: 'body', type: 'markdown', data: { markdown: 'Cross-document overwrite' } }] }))
    const sourceLinks = await createContentDocumentWithBlocks(db, { id: 'links', organizationId: 'one', siteId: 'one',
      kind: 'page', rowRole: 'root', locale: 'en', title: 'Links', path: '/links', metadata: { recipe: 'links', page_type: 'custom' } },
    [{ id: 'link-a', type: 'cta', data: { label: 'A', url: '/a', status: 'active' } }, { id: 'link-b', type: 'cta', data: { label: 'B', url: '/b', status: 'active' } }])
    const translatedLinks = await createContentDocumentWithBlocks(db, { id: 'links-th', organizationId: 'one', siteId: 'one',
      kind: 'page', rowRole: 'representation', rootId: sourceLinks.document.id, locale: 'th', title: 'Translated links', path: '/links' },
    [{ id: 'link-a-th', source_block_id: 'link-a', type: 'cta', data: { label: 'Translated A' } }])
    await assert.rejects(updateContentDocument(db, translatedLinks.document.id, { expected_updated_at: translatedLinks.document.updated_at,
      blocks: [{ id: 'link-a-th', source_block_id: 'body', type: 'cta', data: { label: 'Wrong root' } }] }))
    await updateContentDocument(db, sourceLinks.document.id, { expected_updated_at: sourceLinks.document.updated_at,
      blocks: [{ id: 'link-b', type: 'cta', data: { label: 'B', url: '/b', status: 'active' } }, { id: 'link-a', type: 'cta', data: { label: 'A', url: '/new-a', status: 'active' } }] })
    assert.equal((await listBlocksForDocument(db, translatedLinks.document.id))[0]?.id, 'link-a-th')
    const reordered = await getContentDocumentById(db, sourceLinks.document.id)
    assert.ok(reordered)
    await updateContentDocument(db, reordered.id, { expected_updated_at: reordered.updated_at,
      blocks: [{ id: 'link-b', type: 'cta', data: { label: 'B', url: '/b', status: 'active' } }] })
    assert.deepEqual(await listBlocksForDocument(db, translatedLinks.document.id), [])
    await assert.rejects(db.prepare("INSERT INTO content_documents(id,organization_id,site_id,kind,row_role,locale,summary,status,published_at,source,metadata_json) VALUES ('invalid-social','one','one','social_post','root','en','Body','published','2026-09-06T00:00:00.000Z','manual','{}')").run())
    await executeBatch(db, prepareContentDocumentDeletion({ documentId: document.id, organizationId: 'one', siteId: 'one' }))
    assert.equal(await getContentDocumentById(db, translated.document.id), undefined)
    assert.deepEqual(await listBlocksForDocument(db, translated.document.id), [])
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  } finally {
    await miniflare.dispose()
  }
})