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

  // Find organizations where this user is the SOLE owner
  const ownedOrgsResult = await db.prepare(`
    SELECT o.id FROM organization o
    JOIN member m ON o.id = m.organizationId
    WHERE m.userId = ? AND m.role = 'owner'
    GROUP BY o.id
    HAVING COUNT(*) = 1
  `).bind(userId).all() as { results?: Array<{ id: string }> } | null

  const soleOwnedOrgIds: string[] = (ownedOrgsResult?.results ?? []).map((r: any) => r.id)
  
  // Find all organizations where user is a member (for cleanup)
  const allMemberships = await db.prepare(`
    SELECT DISTINCT organizationId FROM member WHERE userId = ?
  `).bind(userId).all() as { results?: Array<{ organizationId: string }> } | null

  const allOrgIds: string[] = (allMemberships?.results ?? []).map((r: any) => r.organizationId)

  // Block deletion if any organization has an active Stripe subscription
  for (const orgId of allOrgIds) {
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

  // Delete in transaction: sole-owned orgs first, then member records, then user
  const statements = []
  
  // Delete sole-owned organizations (cascades to their data)
  for (const orgId of soleOwnedOrgIds) {
    statements.push(db.prepare(`DELETE FROM organization WHERE id = ?`).bind(orgId))
  }
  
  // Delete member records for all orgs (for co-owned orgs, removes user from org)
  for (const orgId of allOrgIds) {
    statements.push(db.prepare(`DELETE FROM member WHERE organizationId = ? AND userId = ?`).bind(orgId, userId))
  }
  
  // Delete the user — cascades to session, account, phone_number rows
  statements.push(db.prepare(`DELETE FROM user WHERE id = ?`).bind(userId))
  
  // Execute all statements in batch (atomic operation)
  if (statements.length > 0) {
    await db.batch(statements)
  }

  return jsonResponse({ success: true })
})
