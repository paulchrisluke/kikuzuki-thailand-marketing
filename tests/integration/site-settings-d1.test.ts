import assert from 'node:assert/strict'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api'
import * as schema from '../../server/db/schema.ts'
import { deleteConfig, getConfig, setConfig } from '../../server/utils/site-config.ts'
import { storeGoogleAnalyticsConnection, getGoogleAnalyticsConnection } from '../../server/utils/google-analytics.ts'
import { getWhatsAppWorkspaceState, patchWhatsAppWorkspaceState, getMcpWorkspacePreference, upsertMcpWorkspacePreference } from '../../server/utils/mcp-context.ts'

test('site settings and workspace patches preserve independent owners and exclude provider secrets', async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'owner-settings-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: { 'index.mjs': {
      type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }',
    } } }, env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    const statements = await generateSQLiteMigration(await generateSQLiteDrizzleJson({}), await generateSQLiteDrizzleJson(schema))
    await db.batch(statements.map(statement => db.prepare(statement)))
    await db.prepare("INSERT INTO organization(id,name,slug) VALUES('org','Org','org')").run()
    await db.prepare("INSERT INTO sites(id,organization_id,slug) VALUES('site','org','site')").run()
    await db.prepare("INSERT INTO user(id,name,email) VALUES('user','User','user@example.test')").run()
    await Promise.all([setConfig(db, 'org', 'site', 'brand_color', '#123456'), setConfig(db, 'org', 'site', 'default_timezone', 'Asia/Bangkok')])
    assert.equal((await getConfig(db, 'org', 'site')).brand_color, '#123456')
    assert.equal((await getConfig(db, 'org', 'site')).default_timezone, 'Asia/Bangkok')
    await setConfig(db, 'org', 'site', 'social_facebook', 'https://facebook.com/example')
    assert.equal((await getConfig(db, 'org', 'site')).social_facebook, 'https://facebook.com/example')
    assert.equal((await db.prepare("SELECT settings_json FROM sites WHERE id='site'").first<{ settings_json: string }>())?.settings_json.includes('social_facebook'), false)
    await deleteConfig(db, 'org', 'site', 'social_facebook')
    assert.equal((await getConfig(db, 'org', 'site')).social_facebook, undefined)
    await setConfig(db, 'org', 'site', 'google_analytics_measurement_id', 'G-TEST')
    assert.equal((await getConfig(db, 'org', 'site')).google_analytics_measurement_id, 'G-TEST')
    await db.prepare("UPDATE sites SET integrations_json=json_set(integrations_json,'$.google',json(?)) WHERE id='site'").bind(JSON.stringify({ kind: 'oauth', status: 'active', revision: 'v1', encrypted_access_token: 'private-canary', encrypted_refresh_token: 'private-canary-refresh', ga4_measurement_id: 'G-OAUTH' })).run()
    assert.equal(JSON.stringify(await getConfig(db, 'org', 'site')).includes('private-canary'), false)
    await assert.rejects(setConfig(db, 'org', 'site', 'google_analytics_measurement_id', 'G-OTHER'))
    await setConfig(db, 'org', 'site', 'google_analytics_measurement_id', 'G-OAUTH')
    await assert.rejects(db.prepare("UPDATE sites SET integrations_json=json_set(integrations_json,'$.google',json('{}')) WHERE id='site'").run())
    await assert.rejects(db.prepare("UPDATE sites SET settings_json=json_set(settings_json,'$.consultation',json('{}')) WHERE id='site'").run())
    await assert.rejects(setConfig(db, 'other', 'site', 'brand_color', '#000000'))
    await db.prepare("UPDATE sites SET integrations_json='{}' WHERE id='site'").run()
    const providerEnv = { DB: db, CONNECTOR_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }
    const connection = { organization_id: 'org', site_id: 'site', connected_by_user_id: 'user', provider_account_email: 'owner@example.test', encrypted_access_token: 'access-token', encrypted_refresh_token: 'refresh-token', scopes: 'analytics.readonly', status: 'active' as const }
    const attempts = await Promise.allSettled([storeGoogleAnalyticsConnection(providerEnv, connection, { revision: null, transfer_generation: null }), storeGoogleAnalyticsConnection(providerEnv, connection, { revision: null, transfer_generation: null })])
    assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1)
    const connected = await getGoogleAnalyticsConnection(providerEnv, 'org', 'site')
    assert.ok(connected)
    assert.equal(connected.encrypted_access_token, 'access-token')
    await setConfig(db, 'org', 'site', 'brand_color', '#abcdef')
    await storeGoogleAnalyticsConnection(providerEnv, connection, connected)
    const currentConnection = await getGoogleAnalyticsConnection(providerEnv, 'org', 'site')
    assert.ok(currentConnection)
    await db.prepare("UPDATE sites SET settings_json=json_set(settings_json,'$.config.resource_team_generation',json(?)) WHERE id='site'").bind(JSON.stringify({ transfer_id: 'transfer', generation: 'new-generation' })).run()
    await assert.rejects(storeGoogleAnalyticsConnection(providerEnv, connection, currentConnection))

    await patchWhatsAppWorkspaceState(db, { userId: 'user', pendingConfirmation: { intent: 'one' } })
    await Promise.all([patchWhatsAppWorkspaceState(db, { userId: 'user', lastInboundId: 'inbound' }), upsertMcpWorkspacePreference(db, { userId: 'user', organizationId: 'org', siteId: 'site', locationId: null })])
    assert.equal((await getWhatsAppWorkspaceState(db, 'user'))?.pending_confirmation, '{"intent":"one"}')
    assert.equal((await getWhatsAppWorkspaceState(db, 'user'))?.last_inbound_id, 'inbound')
    assert.equal((await getMcpWorkspacePreference(db, 'user'))?.site_id, 'site')
    await patchWhatsAppWorkspaceState(db, { userId: 'user', pendingConfirmation: null })
    assert.equal((await getMcpWorkspacePreference(db, 'user'))?.site_id, 'site')
  } finally { await miniflare.dispose() }
})
