import { instantDate } from '~/utils/timezone'

export const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export interface SubscriptionAccessInput {
  plan: string | null | undefined
  status: string | null | undefined
  paymentStatus: string | null | undefined
  trialEnd?: Date | string | null
  paidThrough?: Date | string | null
  pastDueSince?: Date | string | null
}

/** Canonical access and expiry derived from authoritative subscription/payment facts. */
export function getSubscriptionAccess(input: SubscriptionAccessInput, now = new Date()): {
  plan: string
  expiresAt: string | null
} {
  const free = { plan: 'free', expiresAt: null }
  const plan = input.plan?.trim()
  if (!plan) return free
  let expiry: Date
  if (input.status === 'trialing') {
    if (input.trialEnd == null) return free
    expiry = instantDate(input.trialEnd)
  } else if (input.status === 'active' && input.paymentStatus === 'paid') {
    if (input.paidThrough == null) return free
    expiry = instantDate(input.paidThrough)
  } else if (input.status === 'past_due') {
    if (input.pastDueSince == null) return free
    expiry = new Date(instantDate(input.pastDueSince).getTime() + PAST_DUE_GRACE_PERIOD_MS)
  } else {
    return free
  }
  return now.getTime() > expiry.getTime() ? free : { plan, expiresAt: expiry.toISOString() }
}
