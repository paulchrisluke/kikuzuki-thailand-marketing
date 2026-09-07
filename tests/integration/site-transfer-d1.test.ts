import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import { Miniflare } from 'miniflare'
import * as schema from '../../server/db/schema.ts'
import { executeBatch } from '../../server/db/index.ts'
import { bookingPayloadForGuest, requestInsertQueries } from '../../server/domain/requests.ts'
import { buildCanonicalNotificationInsert } from '../../server/utils/notification-center.ts'
import { acknowledgeNotification } from '../../server/utils/notification-acknowledgement.ts'
import { buildSiteTransferMutationBatch, executeSiteTransfer } from '../../server/utils/site-transfer.ts'

const now = '2026-09-06T00:00:00.000Z'
test('site transfer atomically moves owned aggregates and revokes access while retaining historical facts', { timeout: 90_000 }, async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'site-transfer-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': {
      type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }',
    } } }, env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    await db.batch((await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema))).map(statement => db.prepare(statement)))
    await db.batch([
      "INSERT INTO organization (id,name,slug) VALUES ('sender','Sender','sender'),('recipient','Recipient','recipient')",
      "INSERT INTO user (id,name,email) VALUES ('owner','Owner','owner@proof.example'),('owner2','Other owner','other@proof.example')",
      "INSERT INTO sites (id,organization_id,slug,subdomain) VALUES ('site','sender','site','site')",
      "INSERT INTO business_locations (id,organization_id,site_id,slug,title,timezone,notification_phone) VALUES ('location','sender','site','location','Location','Asia/Bangkok','+66812345678')",
      "INSERT INTO customers (id,organization_id,site_id,source) VALUES ('customer','sender','site','manual')",
      "INSERT INTO site_locales (id,organization_id,site_id,locale,is_source,status) VALUES ('english','sender','site','en',1,'published'),('thai','sender','site','th',0,'published')",
      "INSERT INTO product_categories (id,organization_id,site_id,location_id,product_type,name,slug,sort_order,created_by,updated_by) VALUES ('category','sender','site','location','experience','Experiences','experiences',0,'owner','owner')",
      "INSERT INTO products (id,organization_id,site_id,location_id,product_type,category_id,name,slug,experience_json,sort_order,created_by,updated_by) VALUES ('product','sender','site','location','experience','category','Activity','activity','{}',0,'owner','owner')",
      "INSERT INTO media_assets (id,organization_id,site_id,kind,provider,source,r2_key) VALUES ('asset','sender','site','image','cloudflare_r2','uploaded','retained-object')",
      "INSERT INTO media_placements (id,organization_id,site_id,owner_type,owner_id,slot,asset_id) VALUES ('placement','sender','site','site','site','logo','asset')",
      "INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,locale,title,slug,status,visibility) VALUES ('document','sender','site','article','root','en','Retained title','retained-title','published','public')",
      "INSERT INTO content_documents (id,organization_id,site_id,kind,row_role,root_id,root_role,locale,title,slug) VALUES ('translation','sender','site','article','representation','document','root','th','Translated title','translated-title')",
      "INSERT INTO content_blocks (id,document_id,type,data_json) VALUES ('block','document','markdown','{\"markdown\":\"Retained content\"}')",
      "INSERT INTO resource_localizations (id,organization_id,site_id,resource_type,resource_id,locale,values_json,created_by_user_id,updated_by_user_id) VALUES ('product-th','sender','site','product','product','th','{\"name\":\"Translated activity\"}','owner','owner')",
      "INSERT INTO usage_events (id,organization_id,site_id,resource,source,quantity,unit,idempotency_key) VALUES ('usage','sender','site','credits','test',1,'credit','historical-usage')",
      "INSERT INTO analytics_events (id,kind,site_id,page_path,payload_json) VALUES ('pageview','pageview','site','/','{}')",
      "INSERT INTO analytics_events (id,kind,organization_id,site_id,session_id,visitor_id,payload_json) VALUES ('conversion','conversion','sender','site','session','visitor','{\"event_name\":\"reservation_submit\",\"stage\":\"submitted\",\"attribution\":{\"source\":\"direct\",\"medium\":\"none\"},\"attributed_at\":\"2026-09-06T00:00:00.000Z\"}')",
      "INSERT INTO analytics_summaries (id,kind,organization_id,site_id,date,key,payload_json) VALUES ('summary','page_day','sender','site','2026-09-06','/','{\"page_views\":1}')",
      "INSERT INTO user_workspace_state (user_id,organization_id,site_id,location_id,whatsapp_pending_confirmation) VALUES ('owner','sender','site','location','{\"siteId\":\"site\"}'),('owner2','sender',NULL,NULL,'{\"candidates\":[{\"siteId\":\"site\"}]}')",
      "INSERT INTO activity_entries (id,kind,scope_kind,site_id,actor_kind,event_name,payload_json,dedupe_key,occurred_at) VALUES ('audit','audit','site','site','system','site.created','{\"sourceOrganizationId\":\"sender\"}','audit','2026-09-06T00:00:00.000Z')",
      "INSERT INTO requests (id,kind,organization_id,site_id,status,priority,payload_json) VALUES ('work','work','sender','site','pending','normal','{\"type\":\"technical\",\"title\":\"Task\",\"source\":\"dashboard\"}')",
    ].map(statement => db.prepare(statement)))
    await db.prepare('UPDATE sites SET settings_json=?,integrations_json=? WHERE id=?').bind(
      JSON.stringify({ config: { default_timezone: 'Asia/Bangkok', whatsapp_phone: '+66812345678', owner_notification_channels: ['email'] }, booking: { experience: { minimum_guest_age: 18 } } }),
      JSON.stringify({ google: { kind: 'oauth', revision: 'initial', id: 'google-proof', provider_account_email: 'provider@proof.example', scopes: 'profile', status: 'active', created_at: now, updated_at: now, encrypted_access_token: 'opaque-access', encrypted_refresh_token: 'opaque-refresh' } }), 'site').run()
    await db.prepare("UPDATE business_locations SET booking_json=json_object('reservation',json_object('policy',json_object('minimum_guest_age',NULL,'reschedule_allowed',json('false')))) WHERE id='location'").run()
    await db.prepare("UPDATE products SET experience_json=json_object('duration_minutes',90,'policy',json_object('reschedule_allowed',json('false')),'overrides',json_object('2099-01-05',json_object('18:30',json_object('status','closed','capacity_override',NULL)))) WHERE id='product'").run()
    const requestWrites = requestInsertQueries({ id: 'booking', kind: 'experience_booking', organization_id: 'sender', site_id: 'site', location_id: 'location', product_id: 'product', customer_id: 'customer', review_id: null, status: 'confirmed', booking_date: '2099-01-05', time_slot: '18:30', party_size: 2, conversation_state: 'needs_attention', resolved_at: null, payload: bookingPayloadForGuest({ name: 'Guest', email: 'guest@proof.example' }), created_at: now, updated_at: now })
    await executeBatch(db, requestWrites)
    await db.prepare("INSERT INTO review_requests (id,organization_id,site_id,location_id,customer_id,booking_type,booking_id,token_hash,expires_at) VALUES ('review-request','sender','site','location','customer','experience_booking','booking','review-token','2099-01-01T00:00:00Z')").run()
    const notification = buildCanonicalNotificationInsert({ scope: 'site', organizationId: 'sender', siteId: 'site', locationId: 'location', title: 'Original owner alert', template: 'booking.created' }, 'notification', now)
    await db.prepare(notification.query).bind(...notification.params).run()
    await acknowledgeNotification(db, { userId: 'owner', whereSql: 'n.organization_id = ?', whereParams: ['sender'] }, notification.id)
    const tables = ['sites','business_locations','customers','requests','review_requests','media_assets','media_placements','products','content_documents','content_blocks','resource_localizations','usage_events','activity_entries','analytics_events','analytics_summaries','site_locales','user_workspace_state','site_transfer_requests']
    const snapshot = async () => {
      const result: Record<string, Record<string, unknown>[]> = {}
      const rows = await db.batch(tables.map(table => db.prepare(`SELECT * FROM ${table} ORDER BY ${table === 'user_workspace_state' ? 'user_id' : 'id'}`)))
      for (const [index, table] of tables.entries()) result[table] = rows[index]!.results
      return result
    }
    const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
    const batch = (fromOrgId = 'sender', toOrgId = 'recipient') => buildSiteTransferMutationBatch({ siteId: 'site', fromOrgId, toOrgId, projection: { organizationId: toOrgId, organizationBilling: null }, now, transferId: `transfer-${fromOrgId}`, teamGeneration: fromOrgId })
    const before = await snapshot()
    await assert.rejects(executeBatch(db, [...batch(), { query: "SELECT json('deliberate late failure')" }]))
    assert.equal(hash(await snapshot()), hash(before))
    await executeBatch(db, batch())
    const after = await snapshot()
    for (const table of ['customers','requests','review_requests','media_assets','media_placements','products','content_documents','resource_localizations','analytics_summaries']) assert.deepEqual(after[table], before[table]!.map(row => ({ ...row, organization_id: 'recipient' })), table)
    for (const table of ['content_blocks','usage_events','activity_entries']) assert.equal(hash(after[table]), hash(before[table]), table)
    assert.equal(after.analytics_events!.find(row => row.id === 'conversion')!.organization_id, 'recipient')
    assert.equal(hash(after.analytics_events!.find(row => row.id === 'pageview')), hash(before.analytics_events!.find(row => row.id === 'pageview')))
    const settings = JSON.parse(String(after.sites![0]!.settings_json))
    assert.equal(settings.config.default_timezone, 'Asia/Bangkok')
    assert.deepEqual(settings.booking, { experience: { minimum_guest_age: 18 } })
    assert.equal(settings.config.whatsapp_phone, undefined)
    assert.equal(settings.config.owner_notification_channels, undefined)
    assert.deepEqual(settings.config.resource_team_generation, { transfer_id: 'transfer-sender', generation: 'sender' })
    assert.equal(after.sites![0]!.integrations_json, '{}')
    assert.equal(after.business_locations![0]!.notification_phone, null)
    assert.equal(after.business_locations![0]!.booking_json, before.business_locations![0]!.booking_json)
    assert.equal(after.site_locales!.find(row => row.locale === 'en')!.status, 'published')
    assert.equal(after.site_locales!.find(row => row.locale === 'th')!.status, 'disabled')
    assert.equal(after.user_workspace_state![0]!.site_id, null)
    assert.equal(after.user_workspace_state![0]!.location_id, null)
    assert.ok(after.user_workspace_state!.every(row => row.whatsapp_pending_confirmation === null))
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
    await assert.rejects(db.prepare("UPDATE media_placements SET organization_id='sender' WHERE id='placement'").run())
    await assert.rejects(executeBatch(db, batch()))
    assert.equal(hash(await snapshot()), hash(after))
    await executeBatch(db, batch('recipient', 'sender'))
    const returned = await snapshot()
    for (const table of ['customers','requests','review_requests','media_assets','media_placements','products','content_documents','content_blocks','resource_localizations','analytics_events','analytics_summaries','usage_events','activity_entries']) assert.equal(hash(returned[table]), hash(before[table]), table)
    await db.prepare("INSERT INTO site_transfer_requests (id,site_id,from_organization_id,to_email,token,initiated_by_user_id) VALUES ('pending-transfer','site','sender','recipient@proof.example','transfer-token','owner')").run()
    const pending = await snapshot()
    await assert.rejects(executeSiteTransfer(db, 'site', 'sender', 'recipient', 'pending-transfer', 'owner', { expectedCheckoutSessionId: 'wrong-checkout' }))
    assert.equal(hash(await snapshot()), hash(pending))
    await executeSiteTransfer(db, 'site', 'sender', 'recipient', 'pending-transfer', 'owner')
    assert.equal(await db.prepare("SELECT status FROM site_transfer_requests WHERE id='pending-transfer'").first('status'), 'accepted')
    await db.prepare("DELETE FROM sites WHERE id='site'").run()
    assert.equal(await db.prepare("SELECT count(*) FROM activity_entries WHERE id='audit'").first('count(*)'), 0)
    assert.deepEqual(await db.prepare("SELECT organization_id,context_site_id FROM activity_entries WHERE id='notification'").first(), { organization_id: 'sender', context_site_id: null })
    assert.equal((await db.prepare('PRAGMA foreign_key_check').all()).results.length, 0)
  } finally { await miniflare.dispose() }
})
