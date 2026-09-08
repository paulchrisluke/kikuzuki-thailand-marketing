// POST /api/public/sites/[siteId]/legal/intakes/post-pay
//
// The ONLY route in this family that may attach an unbound Checkout
// session returned by a first-use Payment Link redirect (plan step 5:
// "attach it only after U8 verifies all correlations"). Called
// exclusively by the same-origin, non-mutating callback page (see
// pages/legal/payment-return.vue) via a client-side POST -- never
// reachable directly from a Payment Link redirect itself, since a redirect
// is a GET.
//
// R26: this is a cookie-authenticated legal mutation, so Origin is
// validated (inside resolveLegalPublicSiteAccess, against the site's own
// canonical origin) exactly like every other route in this family --
// "exact-origin BFF POST" in the plan text means this same R13/R26 check,
// not a separate mechanism.
//
// BlawbyRouteKey 'intakePostPay' -- real U8 route `GET
// /intakes/{uuid}/post-pay/status` (U8's "server-to-server post-pay GET"
// per plan step 5) to verify the correlation between request reference,
// intake id, and checkout session id before anything is attached. The path
// param is the Blawby intake UUID.
//
// KNOWN GAP: per task-u8-reconciliation-brief.md section 2, U8's real
// post-pay route also takes a query param
// (`checkoutSessionStatusQuerySchema`, likely the Stripe Checkout Session
// id) that this task's scope (path-param support only, section 4) does not
// add plumbing for -- callBlawbyRoute has no query-param support yet, and
// the brief could not confirm the exact query field name from this repo
// alone. This call currently sends no query string at all; U8's response
// may therefore not reflect the specific checkoutSessionId being verified.
// Flagged in task-u8-reconciliation-report.md; needs the real query field
// name confirmed against blawby-ts before this route can be trusted for
// production traffic.
//
// Every field the browser sends here (requestReference, blawbyIntakeId,
// checkoutSessionId) originated from Blawby's own Payment Link redirect
// query string, NOT from anything KrabiClaw trusts blindly -- this route
// re-verifies all three against Blawby server-to-server and against
// KrabiClaw's own durable record before ever calling
// attachLegalCheckoutSessionInitial/replaceLegalCheckoutSession. "Missing,
// sibling-subdomain, and cross-origin post-pay POSTs fail" is exactly
// resolveLegalPublicSiteAccess's Origin check (a sibling-subdomain
// canonical-origin mismatch fails there); "wrong intake" and "wrong
// request reference" are the record.blawbyIntakeId comparison below.

import { rethrowHttpError } from '~/server/utils/api-response'
import { callBlawbyRoute } from '~/server/utils/blawby-client'
import {
  assertLegalPublicActorBudgets,
  legalApiErrorResponse,
  legalJsonResponse,
  legalRequestCorrelationId,
  requireLegalPublicActor,
  resolveLegalPublicSiteAccess,
} from '~/server/utils/legal-access'
import {
  attachLegalCheckoutSessionInitial,
  findLegalIntakeReferenceForActor,
  replaceLegalCheckoutSession,
} from '~/server/utils/legal-intake-references'
import { getClientIp } from '~/server/utils/hourly-rate-limit'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface PostPayVerification {
  verified: boolean
  checkoutSessionId: string
}

function parsePostPayVerification(body: unknown): PostPayVerification | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  return typeof record.verified === 'boolean' && typeof record.checkoutSessionId === 'string'
    ? { verified: record.verified, checkoutSessionId: record.checkoutSessionId }
    : undefined
}

export default defineHandler(async (event) => {
  const correlationId = legalRequestCorrelationId(event)
  const siteId = String(getRouterParam(event, 'siteId') || '').trim()
  if (!siteId) return legalApiErrorResponse(event, 400, 'LEGAL_INTAKE_SITE_ID_REQUIRED', 'Site id is required')

  try {
    // Origin/rollout/entitlement/IP-budget gate, then session, exactly as
    // every other route in this family -- this IS the "exact-origin BFF
    // POST" the plan requires for the Payment Link callback.
    const context = await resolveLegalPublicSiteAccess(event, 'intake_payment', siteId)
    const actor = await requireLegalPublicActor(event, context)

    const body = await readBody(event).catch(() => null) as {
      requestReference?: unknown
      blawbyIntakeId?: unknown
      checkoutSessionId?: unknown
    } | null
    const requestReference = typeof body?.requestReference === 'string' ? body.requestReference.trim() : ''
    const blawbyIntakeId = typeof body?.blawbyIntakeId === 'string' ? body.blawbyIntakeId.trim() : ''
    const checkoutSessionId = typeof body?.checkoutSessionId === 'string' ? body.checkoutSessionId.trim() : ''
    if (!UUID_V4_PATTERN.test(requestReference) || !blawbyIntakeId || !checkoutSessionId) {
      return legalApiErrorResponse(event, 400, 'LEGAL_INTAKE_POST_PAY_FIELDS_INVALID', 'A valid request reference, intake id, and checkout session id are required')
    }

    await assertLegalPublicActorBudgets(event, context, 'intake_payment', actor, requestReference)

    const record = await findLegalIntakeReferenceForActor(context.db, {
      requestReference,
      organizationId: context.organizationId,
      siteId: context.siteId,
      actorId: actor.actorId,
    })
    if (!record) {
      return legalApiErrorResponse(event, 404, 'LEGAL_INTAKE_NOT_FOUND', 'No intake was found for this request reference')
    }
    // "Wrong intake" / "wrong request reference": the browser-supplied
    // intake id must match KrabiClaw's own durably-bound value for this
    // request reference before Blawby is ever asked to verify anything.
    if (record.blawbyIntakeId !== blawbyIntakeId) {
      return legalApiErrorResponse(event, 409, 'LEGAL_INTAKE_POST_PAY_INTAKE_MISMATCH', 'The intake id does not match this request reference')
    }

    // Server-to-server verification GET (plan step 5) -- confirms
    // organization/site/intake/checkout-session correlation at Blawby
    // before anything is attached. The browser-supplied checkoutSessionId
    // is passed only as the value to VERIFY, never trusted directly.
    const verification = await callBlawbyRoute<PostPayVerification>(context.env, {
      routeKey: 'intakePostPay',
      scope: 'legal:intakes',
      method: 'GET',
      identity: { organizationId: context.organizationId, actorId: actor.actorId, actorKind: actor.actorKind },
      correlationId,
      requestReference,
      // blawbyIntakeId (the body-validated, already-matched-to-record value)
      // is used rather than record.blawbyIntakeId directly -- both are equal
      // at this point (checked above), but blawbyIntakeId's type is a plain
      // non-null string, avoiding a redundant null-narrowing assertion.
      pathParam: blawbyIntakeId,
      clientIp: getClientIp(event),
      parseResponse: parsePostPayVerification,
    })

    if (!verification.verified || verification.checkoutSessionId !== checkoutSessionId) {
      return legalApiErrorResponse(event, 409, 'LEGAL_INTAKE_POST_PAY_UNVERIFIED', 'Blawby could not verify this checkout session')
    }

    // Only NOW, after Blawby's own verified response, may this session be
    // attached (plan step 4/5's "attach only the session returned in a
    // validated Blawby response").
    const attach = record.checkoutSessionId
      ? await replaceLegalCheckoutSession(context.db, event, {
          requestReference,
          organizationId: context.organizationId,
          siteId: context.siteId,
          expectedPriorSessionId: record.checkoutSessionId,
          newSessionId: verification.checkoutSessionId,
        })
      : await attachLegalCheckoutSessionInitial(context.db, event, {
          requestReference,
          organizationId: context.organizationId,
          siteId: context.siteId,
          checkoutSessionId: verification.checkoutSessionId,
        })
    if (attach === 'conflict') {
      return legalApiErrorResponse(event, 409, 'LEGAL_INTAKE_CHECKOUT_SESSION_CONFLICT', 'This request reference already has a different checkout session bound')
    }

    return legalJsonResponse({ checkoutSessionId: verification.checkoutSessionId, status: 'attached' })
  } catch (error) {
    rethrowHttpError(error)
    return legalApiErrorResponse(event, 500, 'LEGAL_INTAKE_POST_PAY_FAILED', 'Failed to verify and attach the checkout session')
  }
})

import { defineHandler } from 'nitro';
import { getRouterParam, readBody } from 'nitro/h3';
