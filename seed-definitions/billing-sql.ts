export interface SeedBillingState { status: string; plan: string }
type SqlValue = (_value: string | number | boolean | null) => string

function paid(billing: SeedBillingState): boolean {
  return billing.plan !== 'free' && billing.status !== 'free'
}

export function renderOrganizationBillingSql(
  organizationId: string,
  billing: SeedBillingState | null | undefined,
  sqlValue: SqlValue,
) {
  if (!billing) return ''
  const isPaid = paid(billing)
  const customerId = isPaid ? `cus-${organizationId}` : null
  const subscriptionId = isPaid ? `stripe-${organizationId}` : null
  const periodStart = `CAST(strftime('%s', 'now', '-1 day') AS INTEGER)`
  const periodEnd = `CAST(strftime('%s', 'now', '+30 days') AS INTEGER)`
  const periodStartIso = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`
  const periodEndIso = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '+30 days')`
  const now = `strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
  const statements = [
    `DELETE FROM subscription WHERE referenceId = ${sqlValue(organizationId)};`,
    `DELETE FROM stripe_invoice_payments WHERE organization_id = ${sqlValue(organizationId)};`,
    `UPDATE organization SET stripeCustomerId = ${sqlValue(customerId)} WHERE id = ${sqlValue(organizationId)};`,
  ]
  if (isPaid) {
    statements.push(`INSERT OR REPLACE INTO subscription
  (id, plan, referenceId, stripeCustomerId, stripeSubscriptionId, status,
   periodStart, periodEnd, cancelAtPeriodEnd, seats, billingInterval)
VALUES
  (${sqlValue(`sub-${organizationId}`)}, ${sqlValue(billing.plan)}, ${sqlValue(organizationId)},
   ${sqlValue(customerId)}, ${sqlValue(subscriptionId)}, ${sqlValue(billing.status)},
   ${periodStart}, ${periodEnd}, 0, 1, 'month');`)
  }
  statements.push(`INSERT OR REPLACE INTO organization_billing
  (organization_id, payment_status,
   paid_through, past_due_since, last_paid_invoice_id, last_payment_event_created,
   last_payment_event_id, access_plan, access_expires_at, updated_at)
VALUES
  (${sqlValue(organizationId)}, ${sqlValue(isPaid ? 'paid' : 'unknown')},
   ${isPaid ? periodEndIso : 'NULL'}, NULL, ${isPaid ? sqlValue(`in-${organizationId}`) : 'NULL'},
   ${isPaid ? `CAST(strftime('%s', 'now') AS INTEGER)` : 'NULL'}, ${isPaid ? sqlValue(`evt-${organizationId}`) : 'NULL'},
   ${sqlValue(isPaid ? billing.plan : 'free')}, ${isPaid ? periodEndIso : 'NULL'}, ${now});`)
  if (isPaid) {
    statements.push(`INSERT OR REPLACE INTO stripe_invoice_payments
  (stripe_invoice_id, organization_id, stripe_subscription_id, base_plan_price_id,
   status, period_start, period_end, past_due_since, last_event_created, last_event_id, updated_at)
VALUES
  (${sqlValue(`in-${organizationId}`)}, ${sqlValue(organizationId)}, ${sqlValue(subscriptionId)},
   ${sqlValue(`price_${billing.plan}_month`)}, 'paid', ${periodStartIso}, ${periodEndIso}, NULL,
   CAST(strftime('%s', 'now') AS INTEGER), ${sqlValue(`evt-${organizationId}`)}, ${now});`)
  }
  return statements.join('\n\n')
}
