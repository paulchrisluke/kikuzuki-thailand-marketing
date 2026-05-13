import { cloudflareEnv, jsonResponse } from '../../utils/api-response'
import { getAuthSession } from '~/server/utils/auth'

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due']

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB

  if (!db) {
    return jsonResponse({ error: 'Database not available' }, { status: 500 })
  }

  const session = await getAuthSession(event, env)
  if (!session?.user?.id) {
    return jsonResponse({ error: 'Authentication required' }, { status: 401 })
  }

  const userId = session.user.id

  // Find all organizations where this user is the sole owner
  const ownedOrgs = await db.prepare(`
    SELECT o.id FROM organization o
    JOIN member m ON o.id = m.organizationId
    WHERE m.userId = ? AND m.role = 'owner'
  `).bind(userId).all()

  const orgIds: string[] = (ownedOrgs.results ?? []).map((r: any) => r.id)

  // Block deletion if any owned org has an active Stripe subscription
  for (const orgId of orgIds) {
    const billing = await db.prepare(`
      SELECT status FROM organization_billing
      WHERE organization_id = ?
      LIMIT 1
    `).bind(orgId).first() as { status: string } | null

    if (billing && ACTIVE_STATUSES.includes(billing.status)) {
      return jsonResponse(
        { error: 'active_subscription', message: 'Please cancel your subscription before deleting your account.' },
        { status: 409 }
      )
    }
  }

  // Delete owned organizations (cascades to billing, entitlements, sites, etc.)
  for (const orgId of orgIds) {
    await db.prepare(`DELETE FROM organization WHERE id = ?`).bind(orgId).run()
  }

  // Delete the user — cascades to session, account, member, phone_number rows
  await db.prepare(`DELETE FROM user WHERE id = ?`).bind(userId).run()

  return jsonResponse({ success: true })
})
