import {
  platformDomain,
  type DomainEnv,
} from '~/server/utils/domains'
import { execute, executeBatch, queryAll, queryFirst, type BatchQuery } from '~/server/db'
import { notifySiteTransferReminder } from '~/server/utils/site-transfer-notifications'
import {
  validateOrganizationBillingProjection,
  type OrganizationBillingProjectionRow,
} from '~/server/utils/organization-billing'
import {
  RESOURCE_TEAM_GENERATION_CONFIG_KEY,
  SITE_TRANSFER_REPARENT_TABLES,
  serializeResourceTeamGeneration,
} from '~/shared/site-transfer-policy'

const DAY_MS = 24 * 60 * 60 * 1000
const REMINDER_THRESHOLDS_DAYS = [1, 3, 7] as const

type SiteTransferEnv = DomainEnv & {
  PLATFORM_OWNER_EMAILS?: string
  RESEND_API_KEY?: string
  STRIPE_SECRET_KEY?: string
}

export const TRANSFER_CLAIM_SENTINEL_PREFIX = 'claim:'

export type TransferClaimSentinel = `claim:${string}`

export function isTransferClaimSentinel(value: string | null | undefined): value is TransferClaimSentinel {
  return typeof value === 'string' && value.startsWith(TRANSFER_CLAIM_SENTINEL_PREFIX)
}

export function newTransferClaimSentinel(): TransferClaimSentinel {
  return `${TRANSFER_CLAIM_SENTINEL_PREFIX}${crypto.randomUUID()}`
}

export function isTransferCheckoutPending(row: {
  status?: string | null
  stripe_checkout_session_id?: string | null
  claiming_user_id?: string | null
  claiming_organization_id?: string | null
}): boolean {
  return row.status === 'pending'
    && Boolean(row.stripe_checkout_session_id)
    && !isTransferClaimSentinel(row.stripe_checkout_session_id)
    && Boolean(row.claiming_user_id)
    && Boolean(row.claiming_organization_id)
}

function isStripeResourceMissing(error: unknown): boolean {
  const candidate = error as { code?: unknown; statusCode?: unknown; type?: unknown } | null
  return candidate?.code === 'resource_missing'
    || (candidate?.statusCode === 404 && candidate?.type === 'StripeInvalidRequestError')
}

interface TransferCleanupRow {
  id: string
  site_id: string
  from_organization_id: string
  status: string
  requires_payment: number
  claiming_user_id: string | null
  claiming_organization_id: string | null
  stripe_checkout_session_id: string | null
}

interface TransferCompletionRow {
  id: string
  site_id: string
  from_organization_id: string
  status: string
  claiming_user_id: string | null
  claiming_organization_id: string | null
  stripe_checkout_session_id: string | null
  payment_completed_at: string | null
}

interface TransferReminderRow {
  id: string
  site_id: string
  from_organization_id: string
  to_email: string
  token: string
  created_at: string
  invited_plan: string | null
  invited_domain: string | null
  reminder_count: number | null
  requires_payment: number
  site_name: string | null
}

export interface SiteTransferBillingProjection {
  organizationId: string
  organizationBilling: OrganizationBillingProjectionRow | null
}

async function loadSiteTransferBillingProjection(
  db: D1Database,
  organizationId: string,
): Promise<SiteTransferBillingProjection> {
  const organizationBilling = await queryFirst<OrganizationBillingProjectionRow>(db, `
    SELECT organization_id,
           payment_status, paid_through, past_due_since,
           last_paid_invoice_id, last_payment_event_created, last_payment_event_id,
           access_plan, access_expires_at, updated_at
      FROM organization_billing
     WHERE organization_id = ?
     LIMIT 1
  `, [organizationId])

  const projection = validateOrganizationBillingProjection(organizationBilling, organizationId)

  return {
    organizationId: projection.organizationId,
    organizationBilling: organizationBilling ?? null,
  }
}

function transferAssertion(query: string, params: unknown[], message: string): BatchQuery {
  // SQLite's JSON function is deliberately used as a conditional assertion:
  // malformed JSON raises an error only when the invariant is false, which
  // aborts the surrounding D1 batch without creating schema objects.
  return {
    query: `SELECT CASE WHEN EXISTS (${query}) THEN json(?) ELSE NULL END`,
    params: [...params, message],
  }
}

function buildSiteTransferAssertions(
  siteId: string,
  fromOrgId: string,
  toOrgId: string,
): BatchQuery[] {
  const assertions: BatchQuery[] = []
  for (const table of SITE_TRANSFER_REPARENT_TABLES) {
    const ownedRows = table === 'analytics_events' ? " AND kind = 'conversion'" : ''
    assertions.push(transferAssertion(
      `SELECT 1 FROM ${table} WHERE site_id = ? AND organization_id = ?${ownedRows} LIMIT 1`,
      [siteId, fromOrgId],
      `site transfer left source rows in ${table}`,
    ))
    assertions.push(transferAssertion(
      `SELECT 1 FROM ${table} WHERE site_id = ? AND (organization_id IS NULL OR organization_id != ?)${ownedRows} LIMIT 1`,
      [siteId, toOrgId],
      `site transfer left a scope mismatch in ${table}`,
    ))
  }
  assertions.push(transferAssertion(
    `SELECT 1 FROM user_workspace_state
      WHERE site_id = ? OR location_id IN (SELECT id FROM business_locations WHERE site_id = ?)` ,
    [siteId, siteId],
    'mcp workspace selection still references transferred site',
  ))
  assertions.push(transferAssertion(
    `SELECT 1 FROM sites WHERE id = ? AND organization_id = ?
       AND (json_type(settings_json, '$.config.whatsapp_phone') IS NOT NULL
         OR json_type(settings_json, '$.config.owner_notification_channels') IS NOT NULL
         OR integrations_json != '{}') LIMIT 1`,
    [siteId, toOrgId],
    'sensitive site configuration survived transfer',
  ))
  assertions.push(transferAssertion(
    `SELECT 1 FROM business_locations WHERE site_id = ? AND (notification_phone IS NOT NULL OR team_id IS NOT NULL) LIMIT 1`,
    [siteId],
    'location notification or team state survived transfer',
  ))
  assertions.push(transferAssertion(
    `SELECT 1 FROM sites WHERE id = ? AND (organization_id != ? OR team_id IS NOT NULL) LIMIT 1`,
    [siteId, toOrgId],
    'site organization or team scope is invalid after transfer',
  ))
  return assertions
}

/**
 * Shared ownership/projection batch used by both real transfers and the
 * development fixture reassigner. Callers must resolve the recipient
 * projection before invoking this builder so malformed state cannot result in
 * a partially-mutated transfer.
 */
export function buildSiteTransferMutationBatch(input: {
  siteId: string
  fromOrgId: string
  toOrgId: string
  projection: SiteTransferBillingProjection
  now?: string
  transferId?: string
  teamGeneration?: string | number
  requirePendingTransferId?: string
}): BatchQuery[] {
  if (input.projection.organizationId !== input.toOrgId) {
    throw new Error('Site transfer billing projection organization does not match recipient organization')
  }
  const now = input.now ?? new Date().toISOString()
  const transferId = input.transferId ?? `reassign-${input.siteId}-${now}`
  const resourceTeamGeneration = serializeResourceTeamGeneration({
    transfer_id: transferId,
    generation: String(input.teamGeneration ?? now),
  })
  const batch: BatchQuery[] = [{ query: 'PRAGMA defer_foreign_keys = ON' }]

  // The site scope is the root invariant for every transfer mutation. Check
  // the exact source owner before any child row can be reparented; an absent or
  // already-reassigned site must abort the whole D1 batch rather than relying
  // on a later mismatch assertion that cannot distinguish a missing root.
  batch.push(transferAssertion(
    `SELECT 1 WHERE NOT EXISTS (
      SELECT 1 FROM sites WHERE id = ? AND organization_id = ? LIMIT 1
    )`,
    [input.siteId, input.fromOrgId],
    'site transfer source site is missing or no longer owned by the source organization',
  ))

  const billing = input.projection.organizationBilling
  const billingSnapshotQuery = billing
    ? `SELECT 1 WHERE NOT EXISTS (
         SELECT 1 FROM organization_billing
          WHERE organization_id = ?
            AND payment_status IS ?
            AND paid_through IS ?
            AND past_due_since IS ?
            AND last_paid_invoice_id IS ?
            AND last_payment_event_created IS ?
            AND last_payment_event_id IS ?
            AND access_plan IS ?
            AND access_expires_at IS ?
            AND updated_at IS ?
          LIMIT 1
       )`
    : 'SELECT 1 FROM organization_billing WHERE organization_id = ? LIMIT 1'
  const billingSnapshotParams = billing
    ? [
        input.toOrgId,
        billing.payment_status,
        billing.paid_through,
        billing.past_due_since,
        billing.last_paid_invoice_id,
        billing.last_payment_event_created,
        billing.last_payment_event_id,
        billing.access_plan,
        billing.access_expires_at,
        billing.updated_at,
      ]
    : [input.toOrgId]
  batch.push(transferAssertion(
    billingSnapshotQuery,
    billingSnapshotParams,
    billing ? 'recipient billing projection changed during transfer' : 'recipient billing row appeared during transfer',
  ))

  if (input.requirePendingTransferId) {
    batch.push(transferAssertion(
      `SELECT 1 WHERE NOT EXISTS (
        SELECT 1 FROM site_transfer_requests
          WHERE id = ?
            AND site_id = ?
            AND from_organization_id = ?
            AND status = 'pending'
          LIMIT 1
      )`,
      [input.requirePendingTransferId, input.siteId, input.fromOrgId],
      'site transfer is no longer pending for this site and source organization',
    ))
  }
  // Site access is inherited from its organization. Transfers only reparent
  // domain state and never materialize site billing or entitlement mirrors.
  batch.push({
    query: `UPDATE sites SET organization_id = ?, team_id = NULL, updated_at = ?, integrations_json = '{}',
      settings_json = json_set(json_remove(settings_json, '$.config.whatsapp_phone', '$.config.owner_notification_channels'), ?, json(?))
      WHERE id = ? AND organization_id = ?`,
    params: [input.toOrgId, now, '$.config.' + RESOURCE_TEAM_GENERATION_CONFIG_KEY, resourceTeamGeneration, input.siteId, input.fromOrgId],
  })

  batch.push(
    { query: `UPDATE site_locales SET status = 'disabled', disabled_at = COALESCE(disabled_at, ?), updated_at = ? WHERE site_id = ? AND is_source = 0`, params: [now, now, input.siteId] },
    {
      query: `UPDATE user_workspace_state
                 SET site_id = NULL, location_id = NULL, updated_at = ?
               WHERE site_id = ? OR location_id IN (SELECT id FROM business_locations WHERE site_id = ?)`,
      params: [now, input.siteId, input.siteId],
    },
    {
      query: `UPDATE user_workspace_state SET whatsapp_pending_confirmation = NULL, whatsapp_updated_at = ?
               WHERE json_extract(whatsapp_pending_confirmation, '$.siteId') = ?
                  OR EXISTS (SELECT 1 FROM json_each(whatsapp_pending_confirmation, '$.candidates') candidate
                             WHERE json_extract(candidate.value, '$.siteId') = ?)`,
      params: [now, input.siteId, input.siteId],
    },
  )

  batch.push({
    query: `UPDATE business_locations SET notification_phone = NULL, team_id = NULL WHERE site_id = ? AND organization_id = ?`,
    params: [input.siteId, input.fromOrgId],
  })

  for (const table of SITE_TRANSFER_REPARENT_TABLES) {
    batch.push({
      query: `UPDATE ${table} SET organization_id = ?${table === 'site_domains' ? ', reconciliation_token = NULL, reconciliation_expires_at = NULL' : ''}
        WHERE site_id = ? AND organization_id = ?${table === 'analytics_events' ? " AND kind = 'conversion'" : ''}`,
      params: [input.toOrgId, input.siteId, input.fromOrgId],
    })
  }

  batch.push(...buildSiteTransferAssertions(input.siteId, input.fromOrgId, input.toOrgId))

  return batch
}

export async function reassignSiteOwnership(
  db: D1Database,
  siteId: string,
  fromOrgId: string,
  toOrgId: string,
): Promise<void> {
  const projection = await loadSiteTransferBillingProjection(db, toOrgId)
  await executeBatch(db, buildSiteTransferMutationBatch({
    siteId,
    fromOrgId,
    toOrgId,
    projection,
    transferId: `reassign-${siteId}`,
  }))
}

export async function executeSiteTransfer(
  db: D1Database,
  siteId: string,
  fromOrgId: string,
  toOrgId: string,
  transferId: string,
  acceptedByUserId: string,
  options: {
    paymentCompletedAt?: string | null
    expectedCheckoutSessionId?: string | null
    expectedClaimingUserId?: string | null
    expectedClaimingOrganizationId?: string | null
  } = {},
): Promise<void> {
  const now = new Date().toISOString()
  const projection = await loadSiteTransferBillingProjection(db, toOrgId)
  const batch = buildSiteTransferMutationBatch({
    siteId,
    fromOrgId,
    toOrgId,
    projection,
    now,
    transferId,
    requirePendingTransferId: transferId,
  })

  // mark the transfer request complete
  const transferConditions = [
    `id = ?`,
    `status = 'pending'`,
  ]
  const transferParams: unknown[] = [transferId]
  if (options.expectedCheckoutSessionId !== undefined) {
    transferConditions.push('stripe_checkout_session_id = ?')
    transferParams.push(options.expectedCheckoutSessionId)
  }
  if (options.expectedClaimingUserId !== undefined) {
    transferConditions.push('claiming_user_id = ?')
    transferParams.push(options.expectedClaimingUserId)
  }
  if (options.expectedClaimingOrganizationId !== undefined) {
    transferConditions.push('claiming_organization_id = ?')
    transferParams.push(options.expectedClaimingOrganizationId)
  }

  batch.push({
    query: `UPDATE site_transfer_requests
         SET status = 'accepted',
             accepted_by_user_id = ?,
             claiming_user_id = ?,
             claiming_organization_id = ?,
             completed_at = ?,
             payment_completed_at = ?
         WHERE ${transferConditions.join(' AND ')}`,
    params: [
      acceptedByUserId,
      acceptedByUserId,
      toOrgId,
      now,
      options.paymentCompletedAt ?? null,
      ...transferParams,
    ],
  })
  batch.push(transferAssertion(
    `SELECT 1 WHERE changes() = 0`,
    [],
    'site transfer completion lost its pending-state compare-and-set',
  ))

  await executeBatch(db, batch)
}

export async function cancelPendingSiteTransfer(
  env: SiteTransferEnv,
  db: D1Database,
  transferId: string,
): Promise<{ cancelled: boolean; reason?: 'payment_completed' }> {
  const transfer = await queryFirst<TransferCleanupRow>(db, `
    SELECT id, site_id, from_organization_id, status, requires_payment,
           claiming_user_id, claiming_organization_id, stripe_checkout_session_id
    FROM site_transfer_requests
    WHERE id = ?
    LIMIT 1
  `, [transferId])

  if (!transfer || transfer.status !== 'pending') return { cancelled: false }

  const checkoutSessionId = transfer.stripe_checkout_session_id
  const isClaiming = isTransferClaimSentinel(checkoutSessionId)
  const isCheckoutPending = isTransferCheckoutPending(transfer)

  // A claim sentinel can be inside the provider-create interval: Stripe may
  // already have accepted an idempotent Checkout create even though the real
  // session ID is not durable yet. Cancellation must not win that interval or
  // the newly-created Checkout could remain payable without a row that its
  // webhook is allowed to complete. The acceptance request must first bind,
  // expire, or quarantine the exact provider resource; cancellation can then
  // retry through the real-session branch below.
  if (transfer.status === 'pending' && isClaiming) {
    return { cancelled: false }
  }

  // A real open Checkout must be expired before the durable cancellation CAS.
  // Never report a completed or ambiguous provider state as cancellation: the
  // webhook owns a completed Checkout and can still finish the handoff.
  if (transfer.status === 'pending' && isCheckoutPending && checkoutSessionId) {
    if (!env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe secret key not configured; transfer cancellation is retryable')
    }
    const { getStripe } = await import('~/server/utils/billing')
    const stripe = getStripe(env)
    let checkoutSession: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>
    try {
      checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId)
    } catch (error) {
      if (!isStripeResourceMissing(error)) throw error
      // A missing exact session cannot still be open. Proceed to the fenced
      // cancellation CAS; webhook completion cannot target a missing resource.
      checkoutSession = { id: checkoutSessionId, status: 'expired' } as typeof checkoutSession
    }

    if (checkoutSession.status === 'complete') {
      return { cancelled: false, reason: 'payment_completed' }
    }
    if (checkoutSession.status !== 'expired') {
      if (checkoutSession.status !== 'open') {
        throw new Error(`Stripe Checkout ${checkoutSessionId} is in an ambiguous ${String(checkoutSession.status)} state`)
      }
      try {
        const expired = await stripe.checkout.sessions.expire(checkoutSessionId)
        if (expired.status !== 'expired') {
          const latest = await stripe.checkout.sessions.retrieve(checkoutSessionId)
          if (latest.status === 'complete') {
            return { cancelled: false, reason: 'payment_completed' }
          }
          if (latest.status !== 'expired') {
            throw new Error(`Stripe Checkout ${checkoutSessionId} expiration was not proven`)
          }
        }
      } catch (error) {
        // Stripe reports a completed session as a conflict if its webhook won
        // after the retrieve. Re-read once and keep the transfer pending for
        // webhook completion; all other failures remain retryable.
        try {
          const latest = await stripe.checkout.sessions.retrieve(checkoutSessionId)
          if (latest.status === 'complete') {
            return { cancelled: false, reason: 'payment_completed' }
          }
        } catch {
          throw error
        }
        throw error
      }
    }

    const cancelResult = await execute(db, `
      UPDATE site_transfer_requests
      SET status = 'cancelled'
      WHERE id = ? AND status = 'pending'
        AND stripe_checkout_session_id = ?
        AND claiming_user_id = ?
        AND claiming_organization_id = ?
    `, [
      transferId,
      checkoutSessionId,
      transfer.claiming_user_id,
      transfer.claiming_organization_id,
    ])
    if ((cancelResult.meta?.changes ?? 0) === 0) {
      return { cancelled: false }
    }
  }

  if (transfer.status === 'pending' && !isClaiming && !isCheckoutPending && checkoutSessionId) {
    throw new Error('Transfer has an unowned Checkout session; cancellation is retryable')
  }

  if (transfer.status === 'pending' && !isClaiming && !isCheckoutPending) {
    const cancelResult = await execute(db, `
      UPDATE site_transfer_requests
      SET status = 'cancelled'
      WHERE id = ? AND status = 'pending'
        AND stripe_checkout_session_id IS NULL
    `, [transferId])

    if ((cancelResult.meta?.changes ?? 0) === 0) {
      return { cancelled: false }
    }
  }

  return { cancelled: true }
}

export async function completePaidSiteTransfer(
  db: D1Database,
  transferId: string,
): Promise<{ completed: boolean }> {
  const transfer = await queryFirst<TransferCompletionRow>(db, `
    SELECT id, site_id, from_organization_id, status,
           claiming_user_id, claiming_organization_id,
           stripe_checkout_session_id,
           payment_completed_at
    FROM site_transfer_requests
    WHERE id = ?
    LIMIT 1
  `, [transferId])

  if (!transfer) {
    return { completed: false }
  }

  if (transfer.status !== 'pending' && transfer.status !== 'accepted') {
    return { completed: false }
  }
  if (transfer.status === 'accepted' && transfer.payment_completed_at) {
    return { completed: false }
  }

  if (!transfer.claiming_user_id || !transfer.claiming_organization_id) {
    throw new Error('Transfer is missing claiming user or organization')
  }
  if (transfer.status === 'pending' && (
    !transfer.stripe_checkout_session_id
    || (!isTransferClaimSentinel(transfer.stripe_checkout_session_id) && !isTransferCheckoutPending(transfer))
  )) {
    throw new Error('Transfer is missing an explicit claim session')
  }

  if (transfer.status === 'pending') {
    try {
      await executeSiteTransfer(
        db,
        transfer.site_id,
        transfer.from_organization_id,
        transfer.claiming_organization_id,
        transfer.id,
        transfer.claiming_user_id,
        {
          expectedCheckoutSessionId: transfer.stripe_checkout_session_id,
          expectedClaimingUserId: transfer.claiming_user_id,
          expectedClaimingOrganizationId: transfer.claiming_organization_id,
        },
      )
    } catch (error) {
      // A cancellation or another fulfillment may win the pending-state CAS
      // while this webhook was waiting on its projection read. Re-read the
      // row and treat that terminal race as an idempotent no-op; real
      // invariant failures (for example a media-prefix collision) remain
      // retryable errors.
      const latest = await queryFirst<Pick<TransferCompletionRow, 'status' | 'payment_completed_at'>>(
        db,
        `SELECT status, payment_completed_at FROM site_transfer_requests WHERE id = ? LIMIT 1`,
        [transfer.id],
      )
      if (!latest || latest.status !== 'pending') {
        return { completed: false }
      }
      throw error
    }
  }

  const paymentClaim = await execute(db, `
    UPDATE site_transfer_requests
    SET payment_completed_at = ?
    WHERE id = ? AND status = 'accepted' AND payment_completed_at IS NULL
  `, [new Date().toISOString(), transfer.id])

  if ((paymentClaim.meta?.changes ?? 0) === 0) {
    return { completed: false }
  }

  return { completed: true }
}

function reminderThresholdForCount(reminderCount: number): number {
  if (reminderCount < REMINDER_THRESHOLDS_DAYS.length) {
    const threshold = REMINDER_THRESHOLDS_DAYS[reminderCount]
    if (typeof threshold === 'number') return threshold
    return REMINDER_THRESHOLDS_DAYS[REMINDER_THRESHOLDS_DAYS.length - 1] as number
  }
  return 7 + (reminderCount - 2) * 7
}

export async function processSiteTransferReminders(
  env: SiteTransferEnv,
  db: D1Database,
  opts: { force?: boolean; now?: Date } = {},
): Promise<{ reminded: number; checked: number }> {
  const now = opts.now ?? new Date()
  const nowIso = now.toISOString()
  const transfers = await queryAll<TransferReminderRow>(db, `
    SELECT r.id, r.site_id, r.from_organization_id, r.to_email, r.token, r.created_at,
           r.invited_plan, r.invited_domain, r.reminder_count, r.requires_payment,
           s.brand_name AS site_name
    FROM site_transfer_requests r
    JOIN sites s ON s.id = r.site_id
    WHERE r.status = 'pending'
    ORDER BY r.created_at ASC
  `)

  let checked = 0
  let reminded = 0
  for (const transfer of transfers || []) {
    checked += 1
    const createdAt = new Date(transfer.created_at)
    const daysPending = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / DAY_MS))
    const reminderCount = Math.max(0, Number(transfer.reminder_count || 0))

    const threshold = reminderThresholdForCount(reminderCount)
    if (!opts.force && daysPending < threshold) continue

    await notifySiteTransferReminder(env, db, {
      organizationId: transfer.from_organization_id,
      siteId: transfer.site_id,
      toEmail: transfer.to_email,
      siteName: transfer.site_name || transfer.site_id,
      transferUrl: `https://${platformDomain(env)}/transfer/${transfer.token}`,
      invitedPlan: transfer.invited_plan,
      invitedDomain: transfer.invited_domain,
      daysPending,
    })

    const reminderResult = await execute(db, `
      UPDATE site_transfer_requests
      SET last_reminder_at = ?, reminder_count = COALESCE(reminder_count, 0) + 1
      WHERE id = ? AND status = 'pending'
    `, [nowIso, transfer.id])
    if ((reminderResult.meta?.changes ?? 0) > 0) reminded += 1
  }

  return { reminded, checked }
}
