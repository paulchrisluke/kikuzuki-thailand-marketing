import { instantDate } from '~/utils/timezone'

export const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export interface SubscriptionAccessInput {
  plan: string | null | undefined
  status: string | null | undefined
  paymentStatus: string | null | undefined
  trialEnd?: Date | string | null
  periodEnd?: Date | string | null
  paidThrough?: Date | string | null
  pastDueSince?: Date | string | null
}

function periodEndMs(value: SubscriptionAccessInput['periodEnd']): number | null {
  return value == null ? null : instantDate(value).getTime()
}

/**
 * Returns the plan whose entitlements may be used at this moment. The
 * original Stripe/Better Auth plan remains stored separately for billing
 * history; access is derived from subscription state.
 */
export function getEffectiveAccessPlan(
  input: SubscriptionAccessInput,
  now = new Date(),
): string {
  const plan = input.plan?.trim()
  if (!plan) return 'free'
  if (input.status === 'trialing') {
    const trialEnd = periodEndMs(input.trialEnd)
    if (trialEnd === null || now.getTime() > trialEnd) return 'free'
    return plan
  }
  if (input.status === 'active' && input.paymentStatus === 'paid') {
    const paidThrough = periodEndMs(input.paidThrough)
    if (paidThrough === null || now.getTime() > paidThrough) return 'free'
    return plan
  }

  if (input.status === 'past_due') {
    const graceAnchor = periodEndMs(input.pastDueSince)
    if (graceAnchor !== null && now.getTime() <= graceAnchor + PAST_DUE_GRACE_PERIOD_MS) return plan
  }

  return 'free'
}
