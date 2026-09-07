// POST /api/dashboard/legal/practice
//
// Staff practice-profile mutation (LegalOperation 'practice_mutation',
// BlawbyRouteKey 'practiceMutate' — PLACEHOLDER path '/legal/practice/update',
// see server/utils/blawby-client.ts's BLAWBY_BEARER_ROUTES comment; not a
// verified U8 contract). Origin is validated FIRST (before
// resolveLegalStaffAccess) per the plan's step-3 ordering — see
// assertLegalStaffMutationOrigin's own comment in legal-access.ts for why
// dashboard origin is pre-checked this way and which env field stands in
// for it.

import { apiErrorResponse, cloudflareEnv, rethrowHttpError } from '~/server/utils/api-response'
import { callBlawbyRoute } from '~/server/utils/blawby-client'
import { assertLegalStaffMutationOrigin, legalJsonResponse, legalRequestCorrelationId, resolveLegalStaffAccess } from '~/server/utils/legal-access'

interface PracticeProfile {
  name: string
  description: string | null
}

function parsePracticeProfile(body: unknown): PracticeProfile | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  if (typeof record.name !== 'string') return undefined
  const description = typeof record.description === 'string' ? record.description : null
  return { name: record.name, description }
}

export default defineHandler(async (event) => {
  const correlationId = legalRequestCorrelationId(event)
  assertLegalStaffMutationOrigin(event, cloudflareEnv(event))

  try {
    const body = await readBody(event).catch(() => null) as { name?: unknown; description?: unknown } | null
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : null
    if (!name) return apiErrorResponse(event, 400, 'LEGAL_PRACTICE_NAME_REQUIRED', 'Practice name is required')

    // Only server-derived fields (name/description from the narrowed body)
    // are forwarded — R6: no browser-supplied organizationId/actorId/token
    // field can reach callBlawbyRoute's identity.
    const access = await resolveLegalStaffAccess(event, 'practice_mutation', { pathname: '/api/dashboard/legal/practice' })

    const profile = await callBlawbyRoute(access.env, {
      routeKey: 'practiceMutate',
      scope: 'legal:practice:write',
      method: 'POST',
      identity: { organizationId: access.organizationId, actorId: access.userId, actorKind: 'staff' },
      correlationId,
      body: { name, description },
      parseResponse: parsePracticeProfile,
    })

    return legalJsonResponse({ profile })
  } catch (error) {
    rethrowHttpError(error)
    return apiErrorResponse(event, 500, 'LEGAL_PRACTICE_MUTATE_FAILED', 'Failed to update the practice profile')
  }
})

import { defineHandler } from 'nitro';
import { readBody } from 'nitro/h3';
