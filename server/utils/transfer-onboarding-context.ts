import { HTTPError } from 'nitro';

import type { H3Event } from 'nitro'
import { queryAll, queryFirst } from '~/server/db'
import { cloudflareEnv } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { loadDashboardContext } from '~/server/utils/dashboard-context-service'
import { getNotificationsSettings } from '~/server/utils/mcp-workflows'

export interface TransferPaymentPendingContext {
  success: true
  state: 'payment_pending'
  transfer_id: string
}

export type TransferOnboardingContext = TransferPaymentPendingContext | {
  success: true
  state: 'accepted'
  organization: { id: string; slug: string } | null
  site: {
    id: string
    brand_name: string | null
    vertical?: string | null
    subdomain: string | null
    effective_plan: string
  }
  locations: Array<{
    id: string
    title: string
    slug: string
    notification_phone: string | null
  }>
  notifications: { whatsapp_phone: string | null; channels: string[] }
}

export async function loadTransferOnboardingContext(
  event: H3Event,
  scope: { orgSlug?: string | null; transferId: string },
) {
  const exactTransferId = scope.transferId
  if (!exactTransferId || exactTransferId !== exactTransferId.trim()) {
    throw new HTTPError({ statusCode: 400, statusMessage: 'The transfer query parameter is invalid.' })
  }
  let context = await loadDashboardContext(event, { orgSlug: scope.orgSlug })

  if (!context.organization) throw new HTTPError({ statusCode: 404, statusMessage: 'Organization not found' })
  {
    const env = cloudflareEnv(event)
    const db = env.DB
    const session = await getAuthSession(event, env)
    if (!db || !session?.user?.id) {
      throw new HTTPError({ statusCode: 503, statusMessage: 'Database unavailable' })
    }
    const paymentPending = await queryFirst<{ id: string }>(
      db,
      `
        SELECT t.id
          FROM site_transfer_requests t
         WHERE t.id = ?
           AND t.status = 'pending'
           AND t.stripe_checkout_session_id IS NOT NULL
           AND substr(t.stripe_checkout_session_id, 1, 6) != 'claim:'
           AND t.claiming_user_id = ?
           AND t.claiming_organization_id = ?
         LIMIT 1
      `,
      [exactTransferId, session.user.id, context.organization.id],
    )
    if (paymentPending?.id) {
      return {
        success: true as const,
        state: 'payment_pending' as const,
        transfer_id: paymentPending.id,
      }
    }

    const paymentPendingAccepted = await queryFirst<{ id: string }>(
      db,
      `
        SELECT t.id
          FROM site_transfer_requests t
          JOIN sites s ON s.id = t.site_id
         WHERE t.id = ?
           AND t.status = 'accepted'
           AND t.requires_payment = 1
           AND t.payment_completed_at IS NULL
           AND t.accepted_by_user_id = ?
           AND s.organization_id = ?
         LIMIT 1
      `,
      [exactTransferId, session.user.id, context.organization.id],
    )
    if (paymentPendingAccepted?.id) {
      return {
        success: true as const,
        state: 'payment_pending' as const,
        transfer_id: paymentPendingAccepted.id,
      }
    }

    const transferredSite = await queryFirst<{ id: string }>(
      db,
      `
        SELECT s.id
          FROM site_transfer_requests t
          JOIN sites s ON s.id = t.site_id
         WHERE t.id = ?
           AND t.status = 'accepted'
           AND t.accepted_by_user_id = ?
           AND s.organization_id = ?
         LIMIT 1
      `,
      [exactTransferId, session.user.id, context.organization.id],
    )
    if (!transferredSite?.id) {
      throw new HTTPError({ statusCode: 404, statusMessage: 'Transferred site not found' })
    }
    context = await loadDashboardContext(event, {
      orgSlug: scope.orgSlug,
      siteId: transferredSite.id,
    })
  }

  if (!context.site) {
    throw new HTTPError({ statusCode: 404, statusMessage: 'Transferred site not found' })
  }
  const db = cloudflareEnv(event).DB
  if (!db) throw new HTTPError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const [locations, notifications] = await Promise.all([
    queryAll<{
      id: string
      title: string
      slug: string
      notification_phone: string | null
    }>(db, `
      SELECT id, title, slug, notification_phone
        FROM business_locations
       WHERE organization_id = ? AND site_id = ? AND status = 'active'
       ORDER BY title ASC
    `, [context.site.organization_id, context.site.id]),
    getNotificationsSettings(db, context.site.organization_id, context.site.id),
  ])
  return {
    success: true as const,
    state: 'accepted' as const,
    organization: context.organization,
    site: context.site,
    locations,
    notifications,
  }
}
