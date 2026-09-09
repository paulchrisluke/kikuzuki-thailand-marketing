import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { rebaseline, TRANSFORMS } from '../../scripts/rebaseline-data.mjs'

// The source fixture is shaped like the retired epoch-6 database: the platform
// split, featured placements and inline FAQ items all present.
function sourceFixture(directory) {
  const path = join(directory, 'source.sqlite')
  const db = new Database(path)
  db.exec(readFileSync('migrations-archive/epoch-6/0000_epoch_6_baseline.sql', 'utf8'))
  db.pragma('foreign_keys = ON')
  const now = '2026-09-01T00:00:00.000Z'
  db.exec(`
    INSERT INTO organization (id, name, slug) VALUES ('platform', 'KrabiClaw Platform', 'platform'), ('org', 'Org', 'org');
    INSERT INTO sites (id, organization_id, slug, subdomain, brand_name, theme_id, vertical, status, onboarding_status)
      VALUES ('platform', 'platform', 'platform', 'krabiclaw', 'KrabiClaw', 'saya-theme-v1', 'restaurant', 'active', 'active'),
             ('site', 'org', 'site', 'site', 'Site', 'blawby-theme-v1', 'service', 'active', 'active');
    INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status)
      VALUES ('l1', 'platform', 'platform', 'en', 1, 'published'), ('l2', 'org', 'site', 'en', 1, 'published');
    INSERT INTO site_domains (id, organization_id, site_id, domain, type, role, status)
      VALUES ('domain-platform-subdomain', 'platform', 'platform', 'krabiclaw.krabiclaw.com', 'subdomain', 'canonical', 'active');
    INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, title, slug, status, metadata_json)
      VALUES ('doc-index', 'platform', 'platform', 'platform_doc', 'root', 'en', 'Getting started', 'getting-started', 'published', '{"category":"Getting Started","difficulty_level":"beginner"}'),
             ('doc-leaf', 'platform', 'platform', 'platform_doc', 'root', 'en', 'Connect a domain', 'connect-a-domain', 'published', '{"category":"Advanced"}');
    INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, title, slug, status, visibility, published_at, metadata_json)
      VALUES ('post', 'org', 'site', 'article', 'root', 'en', 'Post', 'post', 'published', 'public', '${now}', '{"category":"News","nav_section":"Top","featured_order":1,"tags":["a"]}'),
             ('post-with-lead', 'org', 'site', 'article', 'root', 'en', 'Lead', 'lead', 'published', 'public', '${now}', '{}');
    INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, title, path, metadata_json)
      VALUES ('page', 'org', 'site', 'page', 'root', 'en', 'Schedule', '/schedule', '{"page_type":"custom"}');
    INSERT INTO content_documents (id, organization_id, site_id, kind, row_role, locale, scope_path, title, summary, status, source, metadata_json)
      VALUES ('qa-existing', 'org', 'site', 'qa', 'root', 'en', '/schedule', 'Existing question', 'Existing answer', 'published', 'manual', '{"is_owner_answer":1,"upvote_count":0}');
    INSERT INTO media_assets (id, organization_id, site_id, kind, provider, source) VALUES ('asset', 'org', 'site', 'image', 'cloudflare_r2', 'uploaded');
    INSERT INTO content_blocks (id, document_id, type, position, data_json)
      VALUES ('b0', 'post', 'markdown', 0, '{"markdown":"Body"}'),
             ('faq', 'post', 'faq', 1, '{"title":"Questions","items":[{"question":"Q1","answer":"A1"},{"question":"","answer":"skip"}]}'),
             ('lead', 'post-with-lead', 'image', 0, '{"caption":""}'),
             ('page-faq', 'page', 'faq', 0, '{"source":"page_qa","items":[{"question":"Existing question","answer":"Existing answer"},{"question":"New question","answer":"New answer"}]}'),
             ('cta', 'page', 'contact_cta', 1, '{}');
    INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status)
      VALUES ('featured-post', 'org', 'site', 'content_document', 'post', 'featured', 'asset', 0, 'active'),
             ('featured-lead', 'org', 'site', 'content_document', 'post-with-lead', 'featured', 'asset', 0, 'active'),
             ('lead-media', 'org', 'site', 'content_block', 'lead', 'media', 'asset', 0, 'active'),
             ('cta-featured', 'org', 'site', 'content_block', 'cta', 'featured', 'asset', 0, 'active');
    INSERT INTO requests (id, organization_id, site_id, kind, status, conversation_state, payload_json, created_at, updated_at)
      VALUES ('contact', 'org', 'site', 'contact', NULL, 'needs_attention', '{"guest":{"name":"Guest","email":"guest@example.com","phone":null},"message":"Hello"}', '${now}', '${now}'),
             ('pc', NULL, NULL, 'platform_contact', NULL, NULL, '{"guest":{"name":"Visitor","email":"visitor@example.com","phone":null},"message":"Hello"}', '${now}', '${now}');
    INSERT INTO activity_entries (id, kind, scope_kind, actor_kind, dedupe_key, event_name, occurred_at, created_at)
      VALUES ('signup', 'notification', 'platform', 'system', 'signup', 'platform.user_signup', '${now}', '${now}');
    INSERT INTO mcp_tool_call_events (id, mcp_surface, tool_name, method, status, is_mutating, created_at)
      VALUES ('e1', 'platform', 'x', 'tools/call', 'success', 0, '${now}'), ('e2', 'client', 'y', 'tools/call', 'success', 0, '${now}');
  `)
  db.close()
  return path
}

test('rebaseline transfers an epoch-6 export into the baseline and applies every data transform', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-rebaseline-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sourcePath = sourceFixture(directory)
  const targetPath = join(directory, 'target.sqlite')
  const payloadPath = join(directory, 'payload.sql')
  const manifest = rebaseline(sourcePath, targetPath, { payloadPath, withoutJwks: true })
  assert.equal(manifest.transforms.length, TRANSFORMS.length)
  assert.ok(manifest.invariants.every(result => result.violations === 0))

  const db = new Database(targetPath, { readonly: true })
  try {
    assert.deepEqual(db.prepare("SELECT id, kind, path, slug, metadata_json FROM content_documents WHERE id LIKE 'doc-%' ORDER BY id").all(), [
      { id: 'doc-index', kind: 'page', path: '/docs/getting-started', slug: null, metadata_json: '{"page_type":"system"}' },
      { id: 'doc-leaf', kind: 'page', path: '/docs/advanced/connect-a-domain', slug: null, metadata_json: '{"page_type":"system"}' },
    ])
    assert.equal(db.prepare("SELECT metadata_json FROM content_documents WHERE id = 'post'").get().metadata_json, '{"category":"News","tags":["a"]}')
    // Featured placement -> leading image block; a post that already leads with the image only loses the placement.
    assert.deepEqual(db.prepare("SELECT id, type, position FROM content_blocks WHERE document_id = 'post' ORDER BY position").all(),
      [{ id: 'cover-post', type: 'image', position: 0 }, { id: 'b0', type: 'markdown', position: 1 }, { id: 'faq', type: 'faq', position: 2 }])
    assert.deepEqual(db.prepare("SELECT owner_id, slot FROM media_placements WHERE asset_id = 'asset' ORDER BY owner_id").all(),
      [{ owner_id: 'cover-post', slot: 'media' }, { owner_id: 'cta', slot: 'featured' }, { owner_id: 'lead', slot: 'media' }])
    assert.deepEqual(db.prepare("SELECT id, type FROM content_blocks WHERE document_id = 'post-with-lead'").all(), [{ id: 'lead', type: 'image' }])
    // FAQ items become Q&A records once; blocks keep only their title.
    assert.deepEqual(db.prepare("SELECT scope_path, title, summary FROM content_documents WHERE kind = 'qa' ORDER BY scope_path, title").all(), [
      { scope_path: '/article/post', title: 'Q1', summary: 'A1' },
      { scope_path: '/schedule', title: 'Existing question', summary: 'Existing answer' },
      { scope_path: '/schedule', title: 'New question', summary: 'New answer' },
    ])
    assert.deepEqual(db.prepare("SELECT id, data_json FROM content_blocks WHERE type = 'faq' ORDER BY id").all(),
      [{ id: 'faq', data_json: '{"title":"Questions","source":"page_qa"}' }, { id: 'page-faq', data_json: '{"source":"page_qa"}' }])
    // The platform split is gone from the data.
    assert.deepEqual(db.prepare('SELECT id FROM requests ORDER BY id').all(), [{ id: 'contact' }])
    assert.equal(db.prepare("SELECT scope_kind FROM activity_entries WHERE id = 'signup'").get().scope_kind, 'global')
    assert.deepEqual(db.prepare('SELECT id FROM mcp_tool_call_events').all(), [{ id: 'e2' }])
    assert.deepEqual(db.prepare("SELECT theme_id, vertical FROM sites WHERE id = 'platform'").get(), { theme_id: 'krabiclaw-theme-v1', vertical: 'service' })
    assert.deepEqual(db.prepare("SELECT domain, type, role FROM site_domains WHERE site_id = 'platform' ORDER BY domain").all(),
      [{ domain: 'krabiclaw.com', type: 'custom', role: 'canonical' }, { domain: 'krabiclaw.krabiclaw.com', type: 'subdomain', role: 'secondary' }])
  } finally {
    db.close()
  }
  const payload = readFileSync(payloadPath, 'utf8')
  assert.ok(!payload.includes('INSERT INTO "jwks"') && !payload.includes('d1_migrations'))
  assert.ok(payload.includes(`INSERT INTO "site_domains"`))
})

test('rebaseline refuses a populated target and a source whose tables differ from the baseline', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-rebaseline-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sourcePath = sourceFixture(directory)
  const targetPath = join(directory, 'target.sqlite')
  rebaseline(sourcePath, targetPath)
  assert.throws(() => rebaseline(sourcePath, targetPath), /Target already exists/)
  const odd = new Database(sourcePath)
  odd.exec('CREATE TABLE stray (id TEXT PRIMARY KEY)')
  odd.close()
  assert.throws(() => rebaseline(sourcePath, join(directory, 'other.sqlite')), /table sets differ/)
})
