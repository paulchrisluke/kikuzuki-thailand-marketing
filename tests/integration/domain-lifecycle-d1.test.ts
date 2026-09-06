import assert from 'node:assert/strict'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import * as schema from '../../server/db/schema.ts'
import { createSystemSubdomain, isSystemSubdomainSpent, ensureDomainAvailable, reconcileDueDomains, syncDomainWithCloudflare, deleteCustomDomain } from '../../server/utils/domains.ts'
import { fireOrganizationEvent } from '../../server/utils/organization-events.ts'
import { listDashboardEvents } from '../../server/utils/dashboard-events.ts'

test('domain claims fence stale results and permanent subdomain reservations survive site deletion', async (t) => {
  const miniflare = new Miniflare({ workers: [{ config: { name: 'owner-domain-test', type: 'worker', compatibilityDate: '2024-11-01', manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' } } }, env: { DB: { type: 'd1' } } } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    const statements = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema))
    await db.batch(statements.map(statement => db.prepare(statement)))
    await db.prepare("INSERT INTO organization(id,name,slug) VALUES('org','Org','org'),('other','Other','other')").run()
    await db.prepare("INSERT INTO sites(id,organization_id,slug) VALUES('site','org','site'),('audit-site','org','audit-site')").run()
    const env = { NUXT_PUBLIC_FREE_SITE_DOMAIN: 'example.test', CF_ZONE_ID: 'zone', CF_CUSTOM_HOSTNAMES_API_TOKEN: 'test', CF_SAAS_CNAME_TARGET: 'target.example.test' }
    await createSystemSubdomain(env, db, 'site', 'org', 'first')
    await createSystemSubdomain(env, db, 'site', 'org', 'second')
    assert.equal(await isSystemSubdomainSpent(env, db, 'first'), true)
    await db.prepare("DELETE FROM sites WHERE id='site'").run()
    assert.equal(await isSystemSubdomainSpent(env, db, 'first'), true)
    await assert.rejects(ensureDomainAvailable(db, ['first.example.test'], 'audit-site'))
    await assert.rejects(db.prepare("INSERT INTO site_domains(id,domain,type,status) VALUES('bad','bad.example.test','custom','pending')").run())
    await db.prepare("INSERT INTO site_domains(id,organization_id,site_id,domain,type,status) VALUES('custom','org','audit-site','custom.example.test','custom','pending')").run()
    let requestsMade = 0
    let providerMode: 'pending' | 'stale' | 'delete-failed' | 'delete-success' = 'pending'
    t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.ok(String(url).startsWith('https://api.cloudflare.com/'))
      requestsMade += 1
      if (providerMode === 'stale') await db.prepare("UPDATE site_domains SET status='disabled', reconciliation_token=NULL, reconciliation_expires_at=NULL WHERE id='custom'").run()
      if (providerMode === 'delete-failed') return Response.json({ success: false, errors: [{ message: 'provider unavailable' }] }, { status: 503 })
      if (providerMode === 'delete-success') { assert.equal(init?.method, 'DELETE'); return Response.json({ success: true, result: {} }) }
      return Response.json({ success: true, result: { id: 'provider-id', hostname: 'custom.example.test', status: 'pending', ssl: { status: 'pending_validation' } } })
    })
    const results = await Promise.all([reconcileDueDomains(env, db), reconcileDueDomains(env, db)])
    assert.equal(results.reduce((total, result) => total + result.checked, 0), 1)
    assert.equal(requestsMade, 1)
    assert.equal((await db.prepare("SELECT status FROM site_domains WHERE id='custom'").first())?.status, 'verifying')
    providerMode = 'stale'
    await db.prepare("UPDATE site_domains SET cloudflare_hostname_id=NULL WHERE id='custom'").run()
    await assert.rejects(syncDomainWithCloudflare(env, db, 'custom'))
    assert.equal((await db.prepare("SELECT status FROM site_domains WHERE id='custom'").first())?.status, 'disabled')
    await db.prepare("UPDATE site_domains SET status='verifying',cloudflare_hostname_id='provider-id' WHERE id='custom'").run()
    providerMode = 'delete-failed'
    await assert.rejects(deleteCustomDomain(env, db, 'custom', 'system'))
    const failedDelete = await db.prepare("SELECT desired_state,next_check_at,reconciliation_token FROM site_domains WHERE id='custom'").first()
    assert.equal(failedDelete?.desired_state, 'deleted')
    assert.equal(failedDelete?.reconciliation_token, null)
    assert.ok(failedDelete?.next_check_at)
    providerMode = 'delete-success'
    await db.prepare("UPDATE site_domains SET next_check_at=NULL WHERE id='custom'").run()
    assert.equal((await reconcileDueDomains(env, db)).checked, 1)
    assert.equal((await db.prepare("SELECT status FROM site_domains WHERE id='custom'").first())?.status, 'deleted')
    await fireOrganizationEvent({ db, organizationId: 'org', siteId: 'audit-site', eventType: 'content.updated', entityType: 'site', entityId: 'audit-site' })
    await db.batch([db.prepare("DELETE FROM site_domains WHERE site_id='audit-site'"), db.prepare("UPDATE sites SET organization_id='other' WHERE id='audit-site'")])
    assert.equal((await listDashboardEvents(db, 'org', { siteId: 'audit-site' })).events.length, 0)
    assert.ok((await listDashboardEvents(db, 'other', { siteId: 'audit-site' })).events.some(event => event.event_type === 'content.updated'))
    await db.prepare("DELETE FROM organization WHERE id='org'").run()
    assert.ok((await listDashboardEvents(db, 'other', { siteId: 'audit-site' })).events.some(event => event.event_type === 'content.updated'))
    const audit = await db.prepare("SELECT organization_id, payload_json ->> '$.sourceOrganizationId' AS source_org FROM activity_entries WHERE event_name='content.updated'").first()
    assert.equal(audit?.organization_id, null)
    assert.equal(audit?.source_org, 'org')
  } finally { await miniflare.dispose() }
})
