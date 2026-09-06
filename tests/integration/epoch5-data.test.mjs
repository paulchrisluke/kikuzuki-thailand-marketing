import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
import { auditTargetInvariants, convertHours, historicalArchive, project, verifyDatabases, verifyHistoricalArchive, weeklyMinutes } from '../../scripts/epoch5-data.mjs'

const root = process.env.EPOCH5_TEST_REPOSITORY ? resolve(process.env.EPOCH5_TEST_REPOSITORY) : resolve(import.meta.dirname, '../..')

test('retired history preserves exact SQLite facts and rejects a missing or altered archive', () => {
  const source = new Database(':memory:')
  try {
    source.exec(readFileSync(resolve(root, 'migrations-archive/epoch-4/0000_epoch_4_baseline.sql'), 'utf8'))
    const details = JSON.stringify({ label: 'ประวัติ\nretained', result: null })
    source.prepare("INSERT INTO canary_runs (id, run_type, status, details_json) VALUES ('proof', 'auth', 'pass', ?)").run(details)
    const archive = JSON.parse(JSON.stringify(historicalArchive(source)))
    assert.equal(archive.tables.length, 96)
    assert.deepEqual(archive.tables.filter(table => ['canary_runs', 'chowbot_conversations', 'chowbot_messages'].includes(table.table)).map(table => [table.table, table.records.length]), [
      ['canary_runs', 1], ['chowbot_conversations', 0], ['chowbot_messages', 0],
    ])
    const canaries = archive.tables.find(table => table.table === 'canary_runs')
    const detailsIndex = canaries.columns.indexOf('details_json')
    assert.deepEqual(canaries.records[0][detailsIndex], ['text', details])
    assert.equal(verifyHistoricalArchive(source, archive).find(table => table.table === 'canary_runs').rows, 1)
    assert.throws(() => verifyHistoricalArchive(source, undefined), /archive differs/)
    canaries.records[0][detailsIndex] = ['text', 'altered']
    assert.throws(() => verifyHistoricalArchive(source, archive), /archive differs/)
    assert.equal(source.prepare("SELECT details_json FROM canary_runs WHERE id = 'proof'").get().details_json, details)
  } finally { source.close() }
})

test('obsolete synthetic placements are accounted for while their Markdown and assets remain exact', () => {
  const source = new Database(':memory:')
  try {
    source.pragma('foreign_keys = OFF')
    source.exec(readFileSync(resolve(root, 'migrations-archive/epoch-4/0000_epoch_4_baseline.sql'), 'utf8'))
    source.exec("INSERT INTO themes (id,name,slug) VALUES ('saya-theme-v1','Saya','saya')")
    source.exec("INSERT INTO organization (id,name,slug) VALUES ('org','Org','org')")
    source.exec("INSERT INTO sites (id,organization_id,slug) VALUES ('site','org','site')")
    source.exec("INSERT INTO blog_posts (id,organization_id,site_id,title,slug) VALUES ('blog','org','site','Title','title')")
    source.exec("INSERT INTO content_documents (id,owner_type,owner_id) VALUES ('doc','tenant_blog','blog')")
    source.prepare("INSERT INTO content_blocks (id,document_id,type,data_json) VALUES ('block','doc','markdown',?)").run(JSON.stringify({ markdown: '![Retained image](https://media.example.test/image)' }))
    source.exec("INSERT INTO media_assets (id,organization_id,site_id,kind,provider,source,public_url) VALUES ('asset','org','site','image','cloudflare_r2','uploaded','https://media.example.test/image')")
    source.exec("INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES ('obsolete','org','site','content_block','block:media:0','media','asset')")
    const projection = project(source)
    assert.equal(projection.discardedRows.length, 1)
    assert.equal(projection.discardedRows[0].id, 'obsolete')
    assert.equal(projection.discardedRows[0].parent_block_id, 'block')
    assert.equal(projection.data.media_placements.length, 0)
    assert.deepEqual(projection.data.media_assets, projection.sourceData.media_assets)
    assert.deepEqual(projection.data.content_blocks, projection.sourceData.content_blocks.map(block => ({ ...block, document_id: 'blog', source_block_id: null })))
    source.prepare("UPDATE content_blocks SET data_json=? WHERE id='block'").run(JSON.stringify({ markdown: 'Plain URL is not an image: https://media.example.test/image' }))
    assert.throws(() => project(source), /lacks exact retained Markdown and media evidence/)
  } finally { source.close() }
})

test('actual SQLite ownership audits reject cross-site media, document scope, cycles and missing source locales', () => {
  const target = new Database(':memory:')
  try {
    target.pragma('foreign_keys = OFF')
    for (const name of readdirSync(resolve(root, 'migrations')).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) target.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'))
    target.exec("INSERT INTO organization (id,name,slug) VALUES ('org','Org','org')")
    for (const id of ['site-a', 'site-b']) {
      target.prepare('INSERT INTO sites (id,organization_id,slug) VALUES (?, ?, ?)').run(id, 'org', id)
      target.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES (?, 'org', ?, 'en', 1, 'published')").run(id, id)
    }
    target.exec("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,title,slug,status,visibility) VALUES ('doc','org','site-a','article','root','en','Title','title','published','public')")
    target.exec("INSERT INTO content_blocks (id,document_id,type,data_json) VALUES ('b1','doc','markdown','{}'),('b2','doc','markdown','{}')")
    target.exec("INSERT INTO media_assets (id,organization_id,site_id,kind,provider,source) VALUES ('asset','org','site-a','image','cloudflare_r2','uploaded')")
    target.exec("INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES ('placement','org','site-a','site','site-a','logo','asset')")
    const counts = () => Object.fromEntries(auditTargetInvariants(target).map(invariant => [invariant.name, invariant.violations]))
    assert(Object.values(counts()).every(count => count === 0))
    target.exec("UPDATE media_placements SET owner_id='site-b'")
    assert.equal(counts().media_owner_scope, 1)
    target.exec("UPDATE media_placements SET owner_id='site-a'")
    target.exec("UPDATE content_documents SET organization_id='missing'")
    assert.equal(counts().document_owner_scope, 1)
    target.exec("UPDATE content_documents SET organization_id='org'")
    target.exec("UPDATE content_blocks SET parent_block_id=CASE id WHEN 'b1' THEN 'b2' ELSE 'b1' END")
    assert.equal(counts().block_cycles, 2)
    target.exec('UPDATE content_blocks SET parent_block_id=NULL')
    target.exec("DELETE FROM site_locales WHERE site_id='site-a'")
    assert.equal(counts().english_source_locale, 1)
  } finally { target.close() }
})

test('Epoch 5 verifier detects changed actual identity and scope rows', () => {
  const source = new Database(':memory:'), target = new Database(':memory:')
  try {
    source.pragma('foreign_keys = OFF')
    source.exec(readFileSync(resolve(root, 'migrations-archive/epoch-4/0000_epoch_4_baseline.sql'), 'utf8'))
    source.prepare('INSERT INTO user (id, name, email) VALUES (?, ?, ?)').run('epoch5-test-user', 'Epoch test', 'epoch5@example.test')
    source.prepare('INSERT INTO oauthClient (id, clientId, name, redirectUris, createdAt, updatedAt, scopes, scopesJson, requirePkce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('epoch5-test-client', 'epoch5-client', 'Epoch client', '["https://example.test/callback"]', 1000, 1000, '["legacy"]', '["openid","tenant"]', 1)
    target.pragma('foreign_keys = OFF')
    for (const name of readdirSync(resolve(root, 'migrations')).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) target.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'))
    const projection = project(source)
    for (const [table, records] of Object.entries(projection.data)) {
      if (!records.length) continue
      const names = Object.keys(records[0])
      const insert = target.prepare(`INSERT INTO "${table}" (${names.map(name => `"${name}"`).join(',')}) VALUES (${names.map(() => '?').join(',')})`)
      for (const record of records) insert.run(names.map(name => record[name]))
    }
    const archive = historicalArchive(source)
    assert.doesNotThrow(() => verifyDatabases(source, target, {}, archive))
    assert.deepEqual(target.prepare('SELECT scopes, requirePKCE FROM oauthClient').get(), { scopes: '["openid","tenant"]', requirePKCE: 1 })
    target.prepare('UPDATE user SET email = ?').run('tampered@example.test')
    assert.throws(() => verifyDatabases(source, target, {}, archive), /user: actual target differs/)
    target.prepare('UPDATE user SET email = ?').run('epoch5@example.test')
    target.prepare('UPDATE oauthClient SET scopes = ?').run('["openid","tenant","admin"]')
    assert.throws(() => verifyDatabases(source, target, {}, archive), /oauthClient: actual target differs/)
    target.prepare('UPDATE oauthClient SET scopes = ?').run('["openid","tenant"]')
    target.prepare('DELETE FROM oauthClient').run()
    assert.throws(() => verifyDatabases(source, target, {}, archive), /oauthClient: actual target differs/)
  } finally { source.close(); target.close() }
})

test('hours conversion retains Sunday rollover and the exact 23:59 endpoint', () => {
  const converted = convertHours('[{"openDay":"SATURDAY","openTime":"23:00","closeTime":"01:30"},{"openDay":"FRIDAY","openTime":"15:00","closeTime":"23:59"}]')
  const minutes = weeklyMinutes(converted)
  assert.equal(minutes.length, 150 + 539)
  assert(minutes.includes(0))
  assert(minutes.includes(89))
  assert(!minutes.includes(90))
  assert(!minutes.includes(6 * 1440 - 1))
  assert.equal(convertHours(null), null)
  assert.deepEqual(convertHours('[]'), { periods: [] })
})

test('ambiguous English hours require matching same-owner Thai evidence', () => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const english = JSON.stringify({ weekdayDescriptions: days.map(day => `${day}: ${day === 'Monday' ? 'Closed' : '2:00 – 11:00 PM'}`) })
  assert.throws(() => convertHours(english), /Ambiguous AM\/PM/)
  const thai = ['วันจันทร์ ปิด', 'วันอังคาร 14:00–23:00 น.', 'วันพุธ 14:00–23:00 น.', 'วันพฤหัสบดี 14:00–23:00 น.', 'วันศุกร์ 14:00–23:00 น.', 'วันเสาร์ 14:00–23:00 น.', 'วันอาทิตย์ 14:00–23:00 น.']
  assert.equal(weeklyMinutes(convertHours(english, [{ locale: 'th', hours: thai }])).length, 6 * 9 * 60)
  assert.throws(() => convertHours(english, [{ locale: 'th', hours: thai.map(line => line.replace('14:00', '13:00')) }]), /endpoint evidence disagrees/)
})
