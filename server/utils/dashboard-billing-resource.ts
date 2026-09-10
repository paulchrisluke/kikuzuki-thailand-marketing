import { HTTPError } from 'nitro';

import type { H3Event } from 'nitro'
import type Stripe from 'stripe'
import { getOrganizationBillingStatus, getStripe, requireBillingAccess } from '~/server/utils/billing'
import { loadOrganizationSiteSummaries } from '~/server/utils/billing-site-resource'
import { getDashboardContext } from '~/server/utils/dashboard-context'

export async function loadDashboardBillingResource(event: H3Event, organizationSlug: string) {
  if (!organizationSlug) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'Organization slug is required for billing' })
  }
  const { env, db, userId, organization } = await getDashboardContext(event, {
    requireSite: false,
    organizationSlug,
  })
  await requireBillingAccess(env, db, organization.id, userId)
  const billingStatus = await getOrganizationBillingStatus(env, db, organization.id)

  let card: { brand: string; last4: string; exp_month: number; exp_year: number } | null = null
  if (billingStatus.stripeCustomerId) {
    const stripe = getStripe(env)
    const customer = await stripe.customers.retrieve(billingStatus.stripeCustomerId, {
      expand: ['invoice_settings.default_payment_method'],
    }) as Stripe.Customer
    const paymentMethod = customer.invoice_settings?.default_payment_method
    if (paymentMethod && typeof paymentMethod !== 'string' && paymentMethod.type === 'card' && paymentMethod.card) {
      card = {
        brand: paymentMethod.card.brand,
        last4: paymentMethod.card.last4,
        exp_month: paymentMethod.card.exp_month,
        exp_year: paymentMethod.card.exp_year,
      }
    }
  }

  return {
    billing: {
      success: true as const,
      billing: { ...billingStatus, organizationId: organization.id },
      userRole: organization.role,
    },
    paymentMethod: { card },
    sites: {
      success: true as const,
      sites: await loadOrganizationSiteSummaries(db, organization.id, billingStatus),
    },
  }
}
