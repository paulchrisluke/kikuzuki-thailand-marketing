import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import test from 'node:test'
import { Miniflare } from 'miniflare'
import { projectOrganizationSubscription } from '../../server/utils/better-auth-stripe.ts'
import type { DbClient } from '../../server/db/index.ts'

test('billing projection persists the actual trial, paid and grace expiry sources', async () => {
  const miniflare = new Miniflare({ workers: [{ config: {
    name: 'billing-dates-test', type: 'worker', compatibilityDate: '2024-11-01',
    manifest: { mainModule: 'index.mjs', modules: {
      'index.mjs': { type: 'esm', contents: 'export default { fetch() { return new Response("ok") } }' },
    } },
    env: { DB: { type: 'd1' } },
  } }] })
  try {
    const db = await miniflare.getD1Database('DB')
    for (const file of readdirSync('migrations').filter(name => /^\d+.*\.sql$/.test(name)).sort()) {
      for (const sql of readFileSync(`migrations/${file}`, 'utf8').split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean)) {
        await db.prepare(sql).run()
      }
    }
    await db.prepare("INSERT INTO organization (id, name, slug) VALUES ('org', 'Org', 'org')").run()
    const trialEnd = new Date(Date.now() + 2 * 86_400_000)
    const project = (status: string, trial: Date | null) => projectOrganizationSubscription(db as unknown as DbClient, {
      organizationId: 'org', plan: 'growth', status, trialEnd: trial,
    })
    const read = () => db.prepare('SELECT access_plan, access_expires_at FROM organization_billing WHERE organization_id = ?').bind('org').first()
    await project('trialing', trialEnd)
    assert.deepEqual(await read(), { access_plan: 'growth', access_expires_at: trialEnd.toISOString() })
    await project('trialing', null)
    assert.deepEqual(await read(), { access_plan: 'free', access_expires_at: null })

    const paidThrough = new Date(Date.now() + 5 * 86_400_000).toISOString()
    const pastDueSince = new Date(Date.now() - 86_400_000).toISOString()
    await db.prepare("UPDATE organization_billing SET payment_status = 'paid', paid_through = ?, past_due_since = ? WHERE organization_id = 'org'").bind(paidThrough, pastDueSince).run()
    await project('active', null)
    assert.deepEqual(await read(), { access_plan: 'growth', access_expires_at: paidThrough })
    await project('past_due', null)
    assert.deepEqual(await read(), {
      access_plan: 'growth', access_expires_at: new Date(Date.parse(pastDueSince) + 7 * 86_400_000).toISOString(),
    })
    await db.prepare("UPDATE organization_billing SET past_due_since = NULL WHERE organization_id = 'org'").run()
    await project('past_due', null)
    assert.deepEqual(await read(), { access_plan: 'free', access_expires_at: null })
  } finally {
    await miniflare.dispose()
  }
})
