// POST /api/dashboard/legal/intakes/[intakeId]/accept
//
// Staff acceptance of a payment-required intake (LegalOperation
// 'intake_payment', BlawbyRouteKey 'intakeAccept' — PLACEHOLDER path
// '/legal/intakes/accept', see blawby-client.ts; not a verified U8
// contract). A mutation: Origin is validated FIRST, before
// resolveLegalStaffAccess (see assertLegalStaffMutationOrigin).

import { apiErrorResponse, cloudflareEnv, rethrowHttpError } from '~/server/utils/api-response'
import { callBlawbyRoute } from '~/server/utils/blawby-client'
import { assertLegalStaffMutationOrigin, legalJsonResponse, legalRequestCorrelationId, resolveLegalStaffAccess } from '~/server/utils/legal-access'

interface IntakeAcceptResult {
  id: string
  status: string
}

function parseIntakeAcceptResult(body: unknown): IntakeAcceptResult | undefined {
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

  const intakeId = String(getRouterParam(event, 'intakeId') || '').trim()
  if (!intakeId) return apiErrorResponse(event, 400, 'LEGAL_INTAKE_ID_REQUIRED', 'Intake id is required')

  try {
    // The route param (never a body field) is the only identifier
    // forwarded — R6 keeps every other outbound field server-derived.
    const access = await resolveLegalStaffAccess(event, 'intake_payment', { pathname: '/api/dashboard/legal/intakes/[intakeId]/accept' })

    const result = await callBlawbyRoute(access.env, {
      routeKey: 'intakeAccept',
      scope: 'legal:intake:write',
      method: 'POST',
      identity: { organizationId: access.organizationId, actorId: access.userId, actorKind: 'staff' },
      correlationId,
      body: { intakeId },
      parseResponse: parseIntakeAcceptResult,
    })

    return legalJsonResponse({ intake: result })
  } catch (error) {
    rethrowHttpError(error)
    return apiErrorResponse(event, 500, 'LEGAL_INTAKE_ACCEPT_FAILED', 'Failed to accept the intake')
  }
})

import { defineHandler } from 'nitro';
import { getRouterParam } from 'nitro/h3';
