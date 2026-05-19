import Stripe from 'stripe'
import { getStripe } from '~/server/utils/billing'
import type { BillingEnv } from '~/server/utils/billing'

const BUNDLE_AMOUNTS: Record<number, number> = {
  500: 900,
  2500: 2900,
  5000: 4900,
}

interface AutoTopupRow {
  auto_topup_enabled: number
  auto_topup_bundle: number
  auto_topup_threshold: number
  stripe_customer_id: string | null
}

/**
 * Fire-and-forget: if balance drops below the org's configured threshold and auto top-up
 * is enabled, charge the saved card and credit the account. Never throws — errors logged only.
 */
export async function triggerAutoTopupIfNeeded(
  db: D1Database,
  env: BillingEnv,
  organizationId: string,
  newBalance: number
): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) return

  try {
    const billing = await db.prepare(
      `SELECT auto_topup_enabled, auto_topup_bundle, auto_topup_threshold, stripe_customer_id
       FROM organization_billing WHERE organization_id = ? LIMIT 1`
    ).bind(organizationId).first<AutoTopupRow>()

    const threshold = billing?.auto_topup_threshold ?? 100
    if (newBalance >= threshold) return

    if (!billing?.auto_topup_enabled || !billing.stripe_customer_id) return

    const bundle = billing.auto_topup_bundle ?? 500
    const amount = BUNDLE_AMOUNTS[bundle]
    if (!amount) return

    const stripe = getStripe(env)
    const customer = await stripe.customers.retrieve(billing.stripe_customer_id, {
      expand: ['invoice_settings.default_payment_method'],
    }) as Stripe.Customer

    const pm = customer.invoice_settings?.default_payment_method
    const pmId = typeof pm === 'string' ? pm : pm?.id
    if (!pmId) return

    const intent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      customer: billing.stripe_customer_id,
      payment_method: pmId,
      confirm: true,
      off_session: true,
      metadata: { organization_id: organizationId, type: 'auto_topup', credits: String(bundle) },
    })

    if (intent.status !== 'succeeded') return

    const now = new Date().toISOString()
    await db.prepare(
      `INSERT INTO ai_credits (organization_id, balance, lifetime_used, last_topped_up_at, updated_at)
       VALUES (?, ?, 0, ?, ?)
       ON CONFLICT(organization_id) DO UPDATE SET
         balance = balance + excluded.balance,
         last_topped_up_at = excluded.last_topped_up_at,
         updated_at = excluded.updated_at`
    ).bind(organizationId, bundle, now, now).run()
  } catch (err) {
    console.error('auto_topup_failed', { organizationId, newBalance, error: err })
  }
}
