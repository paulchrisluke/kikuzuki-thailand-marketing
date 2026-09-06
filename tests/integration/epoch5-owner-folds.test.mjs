import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import test from 'node:test'
import Database from 'better-sqlite3'

const root = process.env.EPOCH5_TEST_REPOSITORY ? resolve(process.env.EPOCH5_TEST_REPOSITORY) : resolve(import.meta.dirname, '../..')
const { project } = await import(pathToFileURL(resolve(root, 'scripts/epoch5-data.mjs')).href)

test('owner folds retain both availability scopes, native translated experience fields and linked CTA identity', () => {
  const source = new Database(':memory:'), target = new Database(':memory:')
  try {
    source.exec(readFileSync(resolve(root, 'migrations-archive/epoch-4/0000_epoch_4_baseline.sql'), 'utf8'))
    source.exec(`
      INSERT INTO themes (id,name,slug) VALUES ('saya-theme-v1','Saya','saya');
      INSERT INTO organization (id,name,slug) VALUES ('org','Org','org');
      INSERT INTO sites (id,organization_id,slug) VALUES ('site','org','site');
      INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('en','org','site','en',1,'published'),('th','org','site','th',0,'published');
      INSERT INTO user (id,name,email) VALUES ('owner','Owner','owner@example.test');
      INSERT INTO business_locations (id,organization_id,site_id,title,slug,timezone) VALUES ('location','org','site','Location','location','Asia/Bangkok');
      INSERT INTO product_categories (id,organization_id,site_id,location_id,name,slug,sort_order,created_by,updated_by,product_type)
        VALUES ('category','org','site','location','Category','category',0,'owner','owner','experience');
      INSERT INTO products (id,organization_id,site_id,location_id,category_id,name,slug,sort_order,created_by,updated_by,product_type)
        VALUES ('experience','org','site','location','category','Experience','experience',0,'owner','owner','experience');
      INSERT INTO experiences (id,organization_id,site_id,location_id,recurring_slots,included_items)
        VALUES ('experience','org','site','location','{"monday":["10:15"]}','["Equipment"]');
      INSERT INTO availability_overrides (id,organization_id,site_id,owner_type,location_id,experience_id,override_date,time_slot,status,capacity_override,note,created_by)
        VALUES ('location-override','org','site','location','location',NULL,'2026-10-05','10:15','closed',NULL,'Closed by owner','owner'),
          ('experience-override','org','site','experience',NULL,'experience','2026-10-05','10:15','open',0,'Zero capacity','owner');
      INSERT INTO booking_policies (id,organization_id,site_id,policy_type,scope_type,location_id,reschedule_allowed,deposit_required,accessibility_contact_required)
        VALUES ('policy','org','site','reservation','location','location',0,NULL,1);
      INSERT INTO site_link_pages (id,organization_id,site_id,title,path) VALUES ('links','org','site','Links','/links');
      INSERT INTO site_link_items (id,organization_id,site_id,link_page_id,label,destination,sort_order,updated_by)
        VALUES ('button','org','site','links','Book','https://example.test/book',3,'owner');
    `)
    const insertLocalization = source.prepare(`INSERT INTO resource_localizations
      (id,organization_id,site_id,resource_type,resource_id,locale,values_json,route_path,created_by_user_id,updated_by_user_id)
      VALUES (?,'org','site',?,?,'th',?,?,'owner','owner')`)
    insertLocalization.run('translated-experience', 'experience', 'experience', JSON.stringify({ title: 'Translated experience', included_items_json: ['Translated equipment'] }), '/th/experiences/translated')
    insertLocalization.run('translated-links', 'site_link_page', 'links', JSON.stringify({ title: 'Translated links' }), '/th/links')
    insertLocalization.run('translated-button', 'site_link_item', 'button', JSON.stringify({ label: 'Translated booking' }), null)
    assert.deepEqual(source.pragma('foreign_key_check'), [])
    const projection = project(source)
    for (const name of readdirSync(resolve(root, 'migrations')).filter(name => /^\d{4}_.+\.sql$/.test(name)).sort()) target.exec(readFileSync(resolve(root, 'migrations', name), 'utf8'))
    target.pragma('foreign_keys = OFF')
    target.transaction(() => {
      for (const [table, rows] of Object.entries(projection.data)) for (const row of rows) {
        const columns = Object.keys(row)
        target.prepare(`INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...columns.map(column => row[column]))
      }
    })()
    target.pragma('foreign_keys = ON')
    assert.deepEqual(target.pragma('foreign_key_check'), [])
    const reservation = JSON.parse(target.prepare("SELECT booking_json FROM business_locations WHERE id='location'").get().booking_json).reservation
    const experience = JSON.parse(target.prepare("SELECT experience_json FROM products WHERE id='experience'").get().experience_json)
    for (const [id, actual] of [['location-override', reservation.overrides['2026-10-05']['10:15']], ['experience-override', experience.overrides['2026-10-05']['10:15']]]) {
      const retained = source.prepare('SELECT status,capacity_override,note,created_at,updated_at,created_by FROM availability_overrides WHERE id=?').get(id)
      assert.deepEqual(actual, retained)
    }
    assert.equal(reservation.policy.reschedule_allowed, false)
    assert.equal(reservation.policy.deposit_required, null)
    assert.equal(reservation.policy.accessibility_contact_required, true)
    const localized = JSON.parse(target.prepare("SELECT values_json FROM resource_localizations WHERE resource_type='product' AND resource_id='experience'").get().values_json)
    assert.deepEqual(localized, { name: 'Translated experience', experience: { included_items: ['Translated equipment'] } })
    const button = target.prepare("SELECT * FROM content_blocks WHERE id='button'").get()
    assert.equal(button.document_id, 'links')
    assert.equal(button.level, null)
    assert.equal(button.position, 3)
    assert.deepEqual(JSON.parse(button.data_json), { label: 'Book', url: 'https://example.test/book', status: 'active', updated_by: 'owner' })
    const translated = target.prepare("SELECT * FROM content_blocks WHERE id='translated-button'").get()
    assert.equal(translated.source_block_id, 'button')
    assert.equal(translated.level, null)
    assert.deepEqual(JSON.parse(translated.data_json), { label: 'Translated booking' })
    target.prepare("UPDATE content_blocks SET data_json=json_set(data_json, '$.url', ?) WHERE id='button'").run('https://example.test/updated')
    assert.equal(target.prepare("SELECT source_block_id FROM content_blocks WHERE id='translated-button'").get().source_block_id, 'button')
  } finally { source.close(); target.close() }
})
