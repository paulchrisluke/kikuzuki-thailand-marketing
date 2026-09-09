import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import Database from 'better-sqlite3'

const script = resolve('scripts/collapse-featured-covers.mjs')
const run = (...args) => {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
  return { ...result, output: `${result.stdout}${result.stderr}` }
}

test('the cover collapse turns each featured placement into the leading image block and nothing else', t => {
  const directory = mkdtempSync(join(tmpdir(), 'krabiclaw-cover-collapse-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const sourcePath = join(directory, 'source.sqlite')
  const source = new Database(sourcePath)
  source.pragma('foreign_keys = ON')
  source.exec(readFileSync('migrations/0000_epoch_6_baseline.sql', 'utf8'))
  source.prepare("INSERT INTO organization (id,name,slug) VALUES ('org','Proof','proof')").run()
  source.prepare("INSERT INTO sites (id,organization_id,slug,subdomain) VALUES ('site','org','proof','proof')").run()
  source.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('locale','org','site','en',1,'published')").run()
  for (const asset of ['hero', 'body', 'lead']) {
    source.prepare("INSERT INTO media_assets (id,organization_id,site_id,kind,provider,source,public_url) VALUES (?,'org','site','image','cloudflare_images','uploaded',?)").run(asset, `https://img.example/${asset}.png`)
  }
  const documents = {
    // Opens with a heading: the featured placement must become a new leading block, not the body image.
    text: [['heading', '{"text":"Heading"}'], ['markdown', '{"markdown":"Prose","editor_mode":"rich"}'], ['image', '{"caption":""}', 'body']],
    // Already leads with the featured asset: only the duplicate placement goes.
    duplicate: [['image', '{"caption":"Lead"}', 'lead'], ['markdown', '{"markdown":"Prose","editor_mode":"rich"}']],
    // No featured placement at all: untouched.
    plain: [['markdown', '{"markdown":"Prose","editor_mode":"rich"}']],
  }
  for (const [document, blocks] of Object.entries(documents)) {
    source.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,status,visibility,title,slug) VALUES (?,'org','site','article','root','en','published','public',?,?)").run(document, document, document)
    blocks.forEach(([type, data, asset], index) => {
      const id = `${document}-${index}`
      source.prepare('INSERT INTO content_blocks (id,document_id,type,position,data_json) VALUES (?,?,?,?,?)').run(id, document, type, index, data)
      if (asset) source.prepare("INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES (?,'org','site','content_block',?,'media',?)").run(`${id}-media`, id, asset)
    })
  }
  source.prepare("INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES ('text-featured','org','site','content_document','text','featured','hero')").run()
  source.prepare("INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES ('duplicate-featured','org','site','content_document','duplicate','featured','lead')").run()
  const untouchedBefore = source.prepare('SELECT id, position FROM content_blocks WHERE document_id = ? ORDER BY position').all('plain')
  source.close()

  const planned = run('plan', sourcePath, join(directory, 'out'))
  assert.equal(planned.status, 0, planned.output)
  const manifest = JSON.parse(readFileSync(join(directory, 'out', 'manifest.json'), 'utf8'))
  assert.deepEqual(manifest.counts, { documents: 2, inserted_blocks: 1, already_leading: 1, by_kind: { article: 2, platform_doc: 0 } })
  const text = manifest.documents.find(item => item.document_id === 'text')
  const duplicate = manifest.documents.find(item => item.document_id === 'duplicate')
  assert.equal(text.mode, 'insert_leading_block')
  assert.equal(duplicate.mode, 'already_leads')
  assert.equal(duplicate.cover_block_id, 'duplicate-0')

  // Phase 1 under the previous release: the featured placement is still there, and so is the new leading block.
  const target = new Database(sourcePath)
  target.pragma('foreign_keys = ON')
  target.exec(readFileSync(join(directory, 'out', 'insert-covers.sql'), 'utf8'))
  assert.deepEqual(
    target.prepare('SELECT id, type, position FROM content_blocks WHERE document_id = ? AND parent_block_id IS NULL ORDER BY position').all('text'),
    [{ id: text.cover_block_id, type: 'image', position: 0 }, { id: 'text-0', type: 'heading', position: 1 }, { id: 'text-1', type: 'markdown', position: 2 }, { id: 'text-2', type: 'image', position: 3 }],
  )
  assert.equal(target.prepare("SELECT asset_id FROM media_placements WHERE owner_type = 'content_block' AND owner_id = ? AND slot = 'media'").get(text.cover_block_id).asset_id, 'hero')
  assert.equal(target.prepare("SELECT count(*) AS n FROM media_placements WHERE owner_type = 'content_document' AND slot = 'featured'").get().n, 2)
  // The verify command refuses a target that has only had phase 1.
  target.close()
  assert.notEqual(run('verify', sourcePath, join(directory, 'out', 'manifest.json')).status, 0)

  // Phase 2 under the new release: the featured placements are gone and nothing else moved.
  const finished = new Database(sourcePath)
  finished.pragma('foreign_keys = ON')
  finished.exec(readFileSync(join(directory, 'out', 'delete-featured.sql'), 'utf8'))
  assert.equal(finished.prepare("SELECT count(*) AS n FROM media_placements WHERE owner_type = 'content_document' AND slot = 'featured'").get().n, 0)
  assert.deepEqual(finished.prepare('SELECT id, position FROM content_blocks WHERE document_id = ? ORDER BY position').all('duplicate'), [{ id: 'duplicate-0', position: 0 }, { id: 'duplicate-1', position: 1 }])
  assert.deepEqual(finished.prepare('SELECT id, position FROM content_blocks WHERE document_id = ? ORDER BY position').all('plain'), untouchedBefore)
  assert.equal(finished.prepare("SELECT count(*) AS n FROM media_placements WHERE owner_type = 'content_block' AND owner_id = 'duplicate-0'").get().n, 1)
  assert.deepEqual(finished.pragma('foreign_key_check'), [])
  finished.close()
  const verified = run('verify', sourcePath, join(directory, 'out', 'manifest.json'))
  assert.equal(verified.status, 0, verified.output)
  assert.match(verified.stdout, /"verified":true/)

  // Planning again against the finished database finds nothing left to do.
  const replanned = run('plan', sourcePath, join(directory, 'again'))
  assert.equal(replanned.status, 0, replanned.output)
  assert.match(replanned.stdout, /"documents":0/)
})
