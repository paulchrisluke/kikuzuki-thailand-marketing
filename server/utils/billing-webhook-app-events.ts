import type Stripe from 'stripe'
import type { CloudflareEnv } from '~/server/utils/auth'
import {
  invoiceSubscriptionId,
  markOrganizationPayment,
  projectOrganizationSubscription,
  resolveCanonicalSubscriptionPlan,
  type BetterAuthSubscriptionAdapter,
  type StripePlanLoader,
} from '~/server/utils/better-auth-stripe'
import {
  invoiceLineExactQuantity,
  invoiceLineIsProration,
  invoiceLineIsSubscription,
  invoiceLinePrice,
  invoiceLineSubscriptionId,
  invoiceLineSubscriptionItemId,
  loadStripeInvoiceLines,
} from '~/server/utils/stripe-invoice-lines'

async function markSubscriptionPayment(
  db: D1Database,
  subscriptionId: string,
  paymentStatus: 'paid' | 'processing' | 'failed',
  adapter: BetterAuthSubscriptionAdapter,
  event?: Stripe.Event,
  invoiceId?: string | null,
  basePlanPriceId?: string | null,
  invoicePeriodStart?: string | null,
  invoicePeriodEnd?: string | null,
  pastDueSince?: string | null,
  canonicalPaidEvidence = false,
): Promise<{
  organizationId: string
  customerId: string | null
}> {
  const local = await adapter.findOne<{ referenceId: string; stripeCustomerId: string | null }>({
    model: 'subscription',
    where: [{ field: 'stripeSubscriptionId', value: subscriptionId }],
  }).then(row => row
    ? { organizationId: row.referenceId, customerId: row.stripeCustomerId }
    : null)
  if (!local) throw new Error('Subscription has no Better Auth organization reference; retrying')
  const { organizationId, customerId } = local
  await markOrganizationPayment(db, {
    organizationId,
    subscriptionId,
    paymentStatus,
    eventCreated: event?.created ?? 0,
    eventId: event?.id ?? `payment:${subscriptionId}:${paymentStatus}`,
    invoiceId,
    basePlanPriceId,
    invoicePeriodStart,
    invoicePeriodEnd,
    pastDueSince,
    canonicalPaidEvidence,
  })
  return {
    organizationId,
    customerId,
  }
}

function priceId(value: string | Stripe.Price | null | undefined): string | null {
  return typeof value === 'string' ? value : value?.id ?? null
}

function periodIso(seconds: number | null | undefined): string | null {
  return typeof seconds === 'number' && Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null
}

/**
 * Handles the non-subscription application events that remain outside Better
 * Auth Stripe. Subscription events are intentionally excluded: Better Auth
 * Stripe owns those lifecycle events. Historical one-time checkout metadata
 * is acknowledged and ignored; it must not create new credits or add-ons.
 */
export async function handleApplicationStripeEvent(
  env: CloudflareEnv,
  db: D1Database,
  event: Stripe.Event,
  adapter: BetterAuthSubscriptionAdapter,
  stripe: Stripe,
  loadStripePlans: StripePlanLoader,
): Promise<void> {
  if (
    event.type === 'invoice.paid'
    || event.type === 'invoice.payment_failed'
    || event.type === 'invoice.voided'
    || event.type === 'invoice.marked_uncollectible'
  ) {
    const invoice = event.data.object as Stripe.Invoice & {
      subscription?: string | { id: string } | null
      parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null
      period_start?: number
      period_end?: number
    }
    const subscriptionId = invoiceSubscriptionId(invoice)
    if (!subscriptionId) return

    // Invoice lifecycle events are authoritative only when the complete
    // invoice contains the exact configured-or-historical base subscription
    // item for this subscription. Seat/add-on-only invoices are ignored so
    // they cannot grant or revoke plan coverage.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    })
    const resolved = await resolveCanonicalSubscriptionPlan(stripe, subscription, loadStripePlans)
    const lines = await loadStripeInvoiceLines(stripe, invoice)
    const baseLines = lines.filter((line) => {
      if (invoiceLineSubscriptionId(line) !== subscriptionId) return false
      if (invoiceLineSubscriptionItemId(line) !== resolved.item.id) return false
      if (!invoiceLineIsSubscription(line) || invoiceLineIsProration(line)) return false
      if (resolved.item.quantity !== 1 || invoiceLineExactQuantity(line) !== 1) return false
      return priceId(invoiceLinePrice(line)) === resolved.item.price.id
    })
    if (baseLines.length > 1) {
      throw new Error(`Stripe invoice ${invoice.id} has ambiguous canonical base plan lines; retrying`)
    }
    const baseLine = baseLines[0]
    if (!baseLine) return

    const canonicalPeriodStart = periodIso(baseLine.period?.start)
    const canonicalPeriodEnd = periodIso(baseLine.period?.end)
    if (
      !canonicalPeriodStart
      || !canonicalPeriodEnd
      || Date.parse(canonicalPeriodStart) >= Date.parse(canonicalPeriodEnd)
    ) {
      throw new Error(`Stripe invoice ${invoice.id} has malformed canonical base plan period; retrying`)
    }
    const periodStart = canonicalPeriodStart
    const periodEnd = canonicalPeriodEnd
    const payment = await markSubscriptionPayment(
      db,
      subscriptionId,
      event.type === 'invoice.paid' ? 'paid' : 'failed',
      adapter,
      event,
      invoice.id,
      resolved.item.price.id,
      periodStart,
      periodEnd,
      event.type === 'invoice.paid'
        ? null
        : typeof invoice.created === 'number' ? new Date(invoice.created * 1000).toISOString() : null,
      event.type === 'invoice.paid',
    )

    await projectOrganizationSubscription(db, {
      organizationId: payment.organizationId,
      plan: resolved.plan.name,
      status: subscription.status,
      trialEnd: subscription.trial_end == null ? null : new Date(subscription.trial_end * 1000),
    })
    return
  }
}
