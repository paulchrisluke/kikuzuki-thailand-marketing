import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import Database from 'better-sqlite3'

function baselineDatabase() {
  const database = new Database(':memory:')
  database.pragma('foreign_keys = ON')
  database.exec(readFileSync('migrations/0000_epoch_5_baseline.sql', 'utf8'))
  return database
}

test('epoch-5 baseline creates the complete schema from zero', () => {
  const database = baselineDatabase()
  try {
    const tableCount = database.prepare(`
      SELECT count(*) count
      FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
    `).get() as { count: number }
    assert.equal(tableCount.count, 53)
    const ledgerCount = database.prepare("SELECT count(*) count FROM sqlite_schema WHERE name = 'd1_migrations'").get() as { count: number }
    assert.equal(ledgerCount.count, 0)
    const splitAvailabilityTables = database.prepare("SELECT count(*) count FROM sqlite_schema WHERE type = 'table' AND name IN ('experience_slot_overrides', 'reservation_slot_overrides')").get() as { count: number }
    assert.equal(splitAvailabilityTables.count, 0)
    assert.deepEqual(
      database.pragma('table_info(user_workspace_state)').filter(column => column.pk > 0).sort((a, b) => a.pk - b.pk).map(column => column.name),
      ['user_id'],
    )
    assert.equal(database.pragma('foreign_key_check').length, 0)
  } finally {
    database.close()
  }
})

test('epoch-5 baseline enforces canonical cross-scope and value constraints', () => {
  const database = baselineDatabase()
  try {
    database.prepare("INSERT INTO organization (id, name, slug) VALUES ('org', 'Org', 'org')").run()
    database.prepare("INSERT INTO sites (id, organization_id, slug, subdomain) VALUES ('site', 'org', 'site', 'site')").run()
    database.prepare("INSERT INTO business_locations (id, organization_id, site_id, slug, title) VALUES ('location', 'org', 'site', 'location', 'Location')").run()
    database.prepare("INSERT INTO business_locations (id, organization_id, site_id, slug, title) VALUES ('other-location', 'org', 'site', 'other-location', 'Other location')").run()
    database.prepare(`
      INSERT INTO product_categories (
        id, organization_id, site_id, location_id, name, slug, sort_order, created_by, updated_by
      ) VALUES ('category', 'org', 'site', 'location', 'Food', 'food', 0, 'user', 'user')
    `).run()
    database.prepare(`
      INSERT INTO products (
        id, organization_id, site_id, location_id, category_id, name, slug,
        sort_order, created_by, updated_by
      ) VALUES ('product', 'org', 'site', 'location', 'category', 'Product', 'product', 0, 'user', 'user')
    `).run()

    database.prepare(`
      INSERT INTO product_categories (
        id, organization_id, site_id, location_id, name, slug, sort_order, created_by, updated_by
      ) VALUES ('other-category', 'org', 'site', 'other-location', 'Food', 'food', 0, 'user', 'user')
    `).run()
    assert.throws(
      () => database.prepare(`
        INSERT INTO products (
          id, organization_id, site_id, location_id, category_id, name, slug,
          sort_order, created_by, updated_by
        ) VALUES ('cross-location', 'org', 'site', 'location', 'other-category', 'Cross', 'cross', 0, 'user', 'user')
      `).run(),
      /FOREIGN KEY constraint failed/,
    )
    database.prepare(`INSERT INTO prices (id, organization_id, site_id, location_id, product_id, amount_minor, currency, unit, tax_behavior, valid_from, provenance, created_by)
      VALUES ('price', 'org', 'site', 'location', 'product', 10000, 'THB', 'item', 'unspecified', '2026-01-01T00:00:00.000Z', 'test', 'user')`).run()
    database.prepare("INSERT INTO product_categories (id,organization_id,site_id,location_id,product_type,name,slug,sort_order,created_by,updated_by) VALUES ('experience-category','org','site','location','experience','Experiences','experiences',0,'user','user')").run()
    database.prepare("INSERT INTO products (id,organization_id,site_id,location_id,category_id,product_type,name,slug,experience_json,sort_order,created_by,updated_by) VALUES ('experience','org','site','location','experience-category','experience','Experience','experience','{}',0,'user','user')").run()
    database.prepare("UPDATE products SET experience_json = ? WHERE id = 'experience'").run(JSON.stringify({ recurring_slots: { saturday: ['14:00'] }, included_items: ['Equipment'] }))
    database.prepare("UPDATE business_locations SET booking_json = ? WHERE id = 'location'").run(JSON.stringify({ reservation: { policy: { reschedule_allowed: false } } }))
    for (const [query, constraint] of [
      ["UPDATE products SET experience_json = '{}' WHERE id = 'product'", /products_experience_check/],
      ["UPDATE products SET experience_json = NULL WHERE id = 'experience'", /products_experience_check/],
      ["UPDATE products SET experience_json = '[]' WHERE id = 'experience'", /products_experience_check/],
      ["UPDATE products SET experience_json = '{\"included_items\":{}}' WHERE id = 'experience'", /products_experience_fields_check/],
      ["UPDATE business_locations SET booking_json = '[]' WHERE id = 'location'", /business_locations_booking_check/],
    ] as const) assert.throws(() => database.prepare(query).run(), constraint)

    assert.throws(
      () => database.prepare("INSERT INTO organization (id, name, slug) VALUES ('blank', 'Blank', '   ')").run(),
      /organization_slug_required_check/,
    )
    assert.throws(
      () => database.prepare("INSERT INTO sites (id, organization_id, slug, default_currency) VALUES ('bad-currency', 'org', 'bad-currency', 'XYZ')").run(),
      /sites_default_currency_check/,
    )
    assert.throws(
      () => database.prepare("INSERT INTO media_assets (id, organization_id, site_id, kind, provider, source) VALUES ('video', 'org', 'site', 'video', 'cloudflare_r2', 'uploaded')").run(),
      /media_assets_video_thumbnail_check/,
    )
    database.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('source','org','site','en',1,'published')").run()
    database.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,summary,status,published_at,source,metadata_json) VALUES ('social','org','site','social_post','root','en','Body','published','2026-01-01T00:00:00.000Z','manual',?)").run(JSON.stringify({ post_type: 'alert', alert_type: 'covid_19', channels: {} }))
    assert.throws(
      () => database.prepare("UPDATE content_documents SET metadata_json = ? WHERE id = 'social'").run(JSON.stringify({ post_type: 'promotion', channels: {} })),
      /content_documents_social_post_type_check/,
    )
    assert.throws(
      () => database.prepare("UPDATE content_documents SET metadata_json = ? WHERE id = 'social'").run(JSON.stringify({ post_type: 'alert', channels: {} })),
      /content_documents_social_topic_shape_check/,
    )
    assert.throws(
      () => database.prepare("INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status) VALUES ('bad-en', 'org', 'site', 'en', 0, 'published')").run(),
      /site_locales_english_source_check/,
    )
    assert.throws(
      () => database.prepare("INSERT INTO reviews (id, organization_id, site_id, location_id, product_id, rating) VALUES ('bad-review', 'org', 'site', 'other-location', 'product', 5)").run(),
      /FOREIGN KEY constraint failed/,
    )
    database.prepare("INSERT INTO reviews (id, organization_id, site_id, location_id, product_id, rating) VALUES ('review', 'org', 'site', 'location', 'product', 5)").run()
    assert.equal(database.pragma('foreign_key_check').length, 0)
  } finally {
    database.close()
  }
})

test('epoch-5 rejects unknown content, localization, and media owners at the SQLite boundary', () => {
  const database = baselineDatabase()
  try {
    database.prepare("INSERT INTO organization (id, name, slug) VALUES ('org', 'Org', 'org')").run()
    database.prepare("INSERT INTO sites (id, organization_id, slug) VALUES ('site', 'org', 'site')").run()
    database.prepare("INSERT INTO site_locales (id, organization_id, site_id, locale, is_source, status) VALUES ('locale', 'org', 'site', 'th', 0, 'published')").run()
    database.prepare("INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('source','org','site','en',1,'published')").run()
    database.prepare("INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,title,path,metadata_json) VALUES ('document','org','site','page','root','en','Page','/page','{\"page_type\":\"custom\"}')").run()
    database.prepare("INSERT INTO content_blocks (id, document_id, type, position, data_json) VALUES ('block', 'document', 'markdown', 0, '{}')").run()
    database.prepare("INSERT INTO resource_localizations (id, organization_id, site_id, resource_type, resource_id, locale, values_json, created_by_user_id, updated_by_user_id) VALUES ('localization', 'org', 'site', 'site', 'site', 'th', '{}', 'actor', 'actor')").run()
    database.prepare("INSERT INTO media_assets (id, organization_id, site_id, kind, provider, source) VALUES ('image', 'org', 'site', 'image', 'cloudflare_r2', 'uploaded')").run()
    database.prepare("INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id) VALUES ('placement', 'org', 'site', 'site', 'site', 'logo', 'image')").run()

    for (const [query, constraint] of [
      ["UPDATE content_documents SET kind = 'retired_kind' WHERE id = 'document'", /content_documents_kind_check/],
      ["UPDATE content_blocks SET type = 'retired_block' WHERE id = 'block'", /content_blocks_type_check/],
      ["UPDATE content_blocks SET data_json = '[]' WHERE id = 'block'", /content_blocks_data_json_check/],
      ["UPDATE resource_localizations SET resource_type = 'retired_resource' WHERE id = 'localization'", /resource_localizations_resource_type_check/],
      ["UPDATE media_assets SET kind = 'retired_media' WHERE id = 'image'", /media_assets_kind_check/],
      ["UPDATE media_placements SET owner_type = 'retired_owner' WHERE id = 'placement'", /media_placements_owner_type_check/],
    ] as const) {
      assert.throws(() => database.prepare(query).run(), constraint)
    }
    assert.equal(database.pragma('foreign_key_check').length, 0)
  } finally {
    database.close()
  }
})
