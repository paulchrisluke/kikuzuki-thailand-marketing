// POST /api/dashboard/legal/engagement-contracts/[contractId]/accept
//
// Staff engagement-contract acceptance (LegalOperation 'engagement',
// BlawbyRouteKey 'engagementAcceptance' — U2's own placeholder route
// '/legal/engagements/accept', reused verbatim rather than adding a
// duplicate route key). A mutation: Origin is validated FIRST, before
// resolveLegalStaffAccess. R5: engagement acceptance is the one route
// family that may additionally forward the trusted client IP, derived from
// Cloudflare's own request context (getClientIp), never a browser header.

import { apiErrorResponse, cloudflareEnv, rethrowHttpError } from '~/server/utils/api-response'
import { callBlawbyRoute } from '~/server/utils/blawby-client'
import { getClientIp } from '~/server/utils/hourly-rate-limit'
import { assertLegalStaffMutationOrigin, legalJsonResponse, legalRequestCorrelationId, resolveLegalStaffAccess } from '~/server/utils/legal-access'

interface EngagementAcceptResult {
  id: string
  status: string
}

function parseEngagementAcceptResult(body: unknown): EngagementAcceptResult | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.status === 'string'
    ? { id: record.id, status: record.status }
    : undefined
}

export default defineHandler(async (event) => {
  const correlationId = legalRequestCorrelationId(event)
  const env = cloudflareEnv(event)
  assertLegalStaffMutationOrigin(event, env)

  const contractId = String(getRouterParam(event, 'contractId') || '').trim()
  if (!contractId) return apiErrorResponse(event, 400, 'LEGAL_ENGAGEMENT_CONTRACT_ID_REQUIRED', 'Engagement contract id is required')

  try {
    const access = await resolveLegalStaffAccess(event, 'engagement', { pathname: '/api/dashboard/legal/engagement-contracts/[contractId]/accept' })

    const result = await callBlawbyRoute(access.env, {
      routeKey: 'engagementAcceptance',
      scope: 'legal:engagement:write',
      method: 'POST',
      identity: { organizationId: access.organizationId, actorId: access.userId, actorKind: 'staff' },
      correlationId,
      clientIp: getClientIp(event),
      body: { contractId },
      parseResponse: parseEngagementAcceptResult,
    })

    return legalJsonResponse({ contract: result })
  } catch (error) {
    rethrowHttpError(error)
    return apiErrorResponse(event, 500, 'LEGAL_ENGAGEMENT_ACCEPT_FAILED', 'Failed to accept the engagement contract')
  }
})

import { defineHandler } from 'nitro';
import { getRouterParam } from 'nitro/h3';
