// GET /api/dashboard/legal/intakes
//
// Staff intake listing (LegalOperation 'intake_without_payment',
// BlawbyRouteKey 'intakeList' — real U8 route `GET /intakes`, see
// blawby-client.ts). Read-only: no Origin pre-check (R26 only requires it
// for mutations).

import { apiErrorResponse, rethrowHttpError } from '~/server/utils/api-response'
import { callBlawbyRoute } from '~/server/utils/blawby-client'
import { legalJsonResponse, legalRequestCorrelationId, resolveLegalStaffAccess } from '~/server/utils/legal-access'

interface IntakeSummary {
  id: string
  status: string
}

function parseIntakeList(body: unknown): { intakes: IntakeSummary[] } | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  const raw = record.intakes
  if (!Array.isArray(raw)) return undefined
  const intakes: IntakeSummary[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return undefined
    const row = entry as Record<string, unknown>
    if (typeof row.id !== 'string' || typeof row.status !== 'string') return undefined
    intakes.push({ id: row.id, status: row.status })
  }
  return { intakes }
}

export default defineHandler(async (event) => {
  const correlationId = legalRequestCorrelationId(event)
  try {
    const access = await resolveLegalStaffAccess(event, 'intake_without_payment', { pathname: '/api/dashboard/legal/intakes' })

    const result = await callBlawbyRoute(access.env, {
      routeKey: 'intakeList',
      scope: 'legal:intake:read',
      method: 'GET',
      identity: { organizationId: access.organizationId, actorId: access.userId, actorKind: 'human' },
      correlationId,
      parseResponse: parseIntakeList,
    })

    return legalJsonResponse(result)
  } catch (error) {
    rethrowHttpError(error)
    return apiErrorResponse(event, 500, 'LEGAL_INTAKE_LIST_FAILED', 'Failed to load intakes')
  }
})

import { defineHandler } from 'nitro';
