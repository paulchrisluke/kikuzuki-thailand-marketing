// POST /api/billing/credits/add — dev-only credit top-up (Stripe will replace this)
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  if (process.env.NODE_ENV !== 'development') {
    return jsonResponse({ error: 'Only available in development mode' }, { status: 403 })
  }

  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.id) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  const body = await readBody(event).catch(() => ({}))
  const amount: number = Number(body.amount) || 500

  const member = await db.prepare(
    'SELECT organizationId FROM member WHERE userId = ? LIMIT 1'
  ).bind(session.user.id).first()
  if (!member) return jsonResponse({ error: 'No organisation found' }, { status: 404 })

  const orgId = member.organizationId as string
  const now = new Date().toISOString()

  // Upsert: add to existing balance or create a new row
  const existing = await db.prepare(
    'SELECT balance FROM ai_credits WHERE organization_id = ? LIMIT 1'
  ).bind(orgId).first()

  if (existing) {
    await db.prepare(
      'UPDATE ai_credits SET balance = balance + ?, last_topped_up_at = ?, updated_at = ? WHERE organization_id = ?'
    ).bind(amount, now, now, orgId).run()
  } else {
    await db.prepare(
      'INSERT INTO ai_credits (organization_id, balance, lifetime_used, last_topped_up_at, updated_at) VALUES (?, ?, 0, ?, ?)'
    ).bind(orgId, amount, now, now).run()
  }

  const updated = await db.prepare(
    'SELECT balance FROM ai_credits WHERE organization_id = ? LIMIT 1'
  ).bind(orgId).first()

  return jsonResponse({ success: true, balance: updated?.balance ?? amount, added: amount })
})
