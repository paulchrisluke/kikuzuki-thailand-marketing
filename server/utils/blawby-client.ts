// Server-only transport for KrabiClaw's Blawby legal-facade backend (U8).
//
// Owns exactly what KTD1 assigns to this file: OAuth client_credentials token
// exchange with scoped cache + coalescing, a pinned-origin fetch wrapper with
// timeout and rejected redirects, a fresh outbound header allowlist, runtime
// response validation, and upstream error classification (R2-R7, R23-R25,
// R28-R29). It does not own route eligibility, flags, or domain workflows —
// callers (U3/U5/U6) decide whether a call is allowed before reaching here.
//
// ASSUMPTIONS pending real U8 verification (flag for U7/U10 reconciliation):
//   - Token endpoint path `/oauth/token` and standard OAuth2 client_credentials
//     JSON shape (`access_token`, `expires_in`, `token_type`) — the plan names
//     the grant type and `client_secret_basic` but not the concrete path or
//     response shape, so this follows RFC 6749/8414 convention.
//   - The machine-auth discriminator for "this 401 means the token itself is
//     stale" is assumed to be a `WWW-Authenticate` header or JSON body
//     containing `error: "invalid_token"` (RFC 6750 convention). U8's real
//     discriminator is not documented in this repo.
//   - `engagementAcceptance` and `practiceRead` route paths below are
//     PLACEHOLDERS proving the route-key/client-IP-allowlist mechanism works;
//     they are not confirmed U8 paths. U5/U6 must replace them with the real
//     paths (and add further route keys) once U8's route contract is known.

import { HTTPError } from 'nitro'
import type { CloudflareEnv } from '~/server/utils/auth'
import { isRecord, readNumber, readString } from '~/server/utils/type-guards'

export interface BlawbyTrustedIdentity {
  organizationId: string
  actorId: string
  actorKind: string
}

// -- Config -------------------------------------------------------------

type RequiredConfigKey =
  | 'LEGAL_BLAWBY_ORIGIN'
  | 'LEGAL_BLAWBY_CLIENT_ID'
  | 'LEGAL_BLAWBY_CLIENT_SECRET'
  | 'LEGAL_BLAWBY_AUDIENCE'

function requireConfig(env: CloudflareEnv, key: RequiredConfigKey): string {
  const value = env[key]
  if (typeof value !== 'string' || !value.trim()) {
    throw new HTTPError({
      statusCode: 503,
      statusMessage: 'Blawby is not configured for this environment',
      data: { code: 'BLAWBY_NOT_CONFIGURED', field: key },
    })
  }
  return value
}

// No `??`/`||` default: a missing or invalid timeout blocks any real call
// (fail closed) rather than silently allowing an unbounded fetch.
function resolveTimeoutMs(env: CloudflareEnv, correlationId: string): number {
  const raw = env.LEGAL_BLAWBY_TIMEOUT_MS
  const parsed = typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HTTPError({
      statusCode: 503,
      statusMessage: 'Blawby request timeout is not configured',
      data: { code: 'BLAWBY_NOT_CONFIGURED', field: 'LEGAL_BLAWBY_TIMEOUT_MS', requestCorrelationId: correlationId },
    })
  }
  return parsed
}

function resolvePinnedOrigin(env: CloudflareEnv, correlationId: string): URL {
  const raw = requireConfig(env, 'LEGAL_BLAWBY_ORIGIN')
  let origin: URL
  try {
    origin = new URL(raw)
  } catch {
    throw new HTTPError({
      statusCode: 503,
      statusMessage: 'Blawby origin is not a valid URL',
      data: { code: 'BLAWBY_NOT_CONFIGURED', field: 'LEGAL_BLAWBY_ORIGIN', requestCorrelationId: correlationId },
    })
  }
  if (
    origin.protocol !== 'https:'
    || origin.username
    || origin.password
    || origin.hash
    || origin.search
    || (origin.pathname !== '/' && origin.pathname !== '')
  ) {
    throw new HTTPError({
      statusCode: 503,
      statusMessage: 'Blawby origin must be a bare HTTPS origin',
      data: { code: 'BLAWBY_NOT_CONFIGURED', field: 'LEGAL_BLAWBY_ORIGIN', requestCorrelationId: correlationId },
    })
  }
  return origin
}

// Static route paths only — never accepts a path from a caller argument.
// Only relative paths matching this allowlist may be requested; combined
// with the origin-match assertion in buildBlawbyUrl this rejects absolute
// overrides, scheme-relative overrides, encoded host escapes, userinfo, and
// fragments even if a future edit to this file introduced a bad literal.
const SAFE_PATH_PATTERN = /^\/[A-Za-z0-9/_-]+$/

const BLAWBY_TOKEN_PATH = '/oauth/token'

interface BlawbyRouteDescriptor {
  path: string
  includeClientIp: boolean
}

// Placeholder route metadata — see file-header ASSUMPTIONS. Real route keys
// and paths must be added here (never accepted from a caller) as U5/U6 learn
// U8's actual contract.
//
// U5 additions (ALL placeholder paths, unverified — see U5 report for the
// same PLACEHOLDER flag U2 already carries for engagementAcceptance/
// practiceRead above):
//   - practiceMutate: staff practice-profile updates.
//   - connectStart: begins a Blawby Connect onboarding flow, returning an
//     onboarding-link URL (validated against a Stripe-origin allowlist by
//     the route, R30) and binding it to the caller-supplied Connect
//     request key (forwarded as requestReference).
//   - intakeList / intakeAccept: staff intake review and payment-required
//     intake acceptance.
//   - engagementContractsList: staff engagement-contract listing.
// engagement-contracts accept reuses engagementAcceptance verbatim rather
// than adding a duplicate route key.
//
// U6 additions (ALL placeholder paths, unverified -- same PLACEHOLDER flag
// as every other route key above; see the U6 report):
//   - intakeCreate: public actor creates a new intake (client IP forwarded
//     -- this is the first anonymous-abuse-sensitive write in the family).
//   - intakeRecover: re-fetches an already-claimed intake by request
//     reference after response loss, without resubmitting the payload.
//   - intakeCheckout: begins or replaces a Blawby Checkout/Payment Link
//     session for an already-created intake (client IP forwarded --
//     payment-adjacent).
//   - intakeStatus: read-only status poll for a bound intake.
//   - intakePostPay: server-to-server verification GET called ONLY by the
//     BFF's post-pay route (never directly reachable by the browser) after
//     a Payment Link return, to correlate and confirm a Checkout session
//     before it is ever attached (client IP forwarded -- this is the
//     payment-confirmation boundary).
const BLAWBY_BEARER_ROUTES = {
  engagementAcceptance: { path: '/legal/engagements/accept', includeClientIp: true },
  practiceRead: { path: '/legal/practice', includeClientIp: false },
  practiceMutate: { path: '/legal/practice/update', includeClientIp: false },
  connectStart: { path: '/legal/connect/onboard', includeClientIp: false },
  intakeList: { path: '/legal/intakes', includeClientIp: false },
  intakeAccept: { path: '/legal/intakes/accept', includeClientIp: false },
  engagementContractsList: { path: '/legal/engagements', includeClientIp: false },
  intakeCreate: { path: '/legal/public/intakes', includeClientIp: true },
  intakeRecover: { path: '/legal/public/intakes/recover', includeClientIp: false },
  intakeCheckout: { path: '/legal/public/intakes/checkout', includeClientIp: true },
  intakeStatus: { path: '/legal/public/intakes/status', includeClientIp: false },
  intakePostPay: { path: '/legal/public/intakes/post-pay', includeClientIp: true },
} as const satisfies Record<string, BlawbyRouteDescriptor>

export type BlawbyRouteKey = keyof typeof BLAWBY_BEARER_ROUTES

function buildBlawbyUrl(origin: URL, path: string, correlationId: string): URL {
  if (!SAFE_PATH_PATTERN.test(path)) {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby route path is invalid',
      data: { code: 'BLAWBY_INVALID_ROUTE', requestCorrelationId: correlationId },
    })
  }
  const url = new URL(path, origin)
  if (url.origin !== origin.origin || url.username || url.password || url.hash) {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby route path escaped the pinned origin',
      data: { code: 'BLAWBY_ORIGIN_ESCAPE', requestCorrelationId: correlationId },
    })
  }
  return url
}

// -- Fresh outbound header allowlist (R5-R6) -----------------------------
//
// Every header here is built from explicit parameters only. This function
// never receives or reads an inbound Request/Headers object, so browser
// cookies, forwarding headers, `Authorization`, and inbound `x-krabiclaw-*`
// values cannot reach it by construction — there is nothing to filter out.

function buildOutboundHeaders(params: {
  contentType?: string
  authorization?: string
  identity?: BlawbyTrustedIdentity
  requestReference?: string
  clientIp?: string
  correlationId: string
}): Headers {
  const headers = new Headers()
  if (params.contentType) headers.set('content-type', params.contentType)
  if (params.authorization) headers.set('authorization', params.authorization)
  if (params.identity) {
    headers.set('x-krabiclaw-organization-id', params.identity.organizationId)
    headers.set('x-krabiclaw-actor-id', params.identity.actorId)
    headers.set('x-krabiclaw-actor-kind', params.identity.actorKind)
  }
  if (params.requestReference) headers.set('x-krabiclaw-request-reference', params.requestReference)
  headers.set('x-krabiclaw-correlation-id', params.correlationId)
  if (params.clientIp) headers.set('x-krabiclaw-client-ip', params.clientIp)
  return headers
}

// -- Low-level pinned-origin fetch (R4) ----------------------------------

interface BlawbyRawResponse {
  status: number
  body: unknown
  wwwAuthenticate: string | null
}

async function fetchBlawby(params: {
  env: CloudflareEnv
  path: string
  method: 'GET' | 'POST'
  headers: Headers
  body?: string
  correlationId: string
}): Promise<BlawbyRawResponse> {
  const origin = resolvePinnedOrigin(params.env, params.correlationId)
  const url = buildBlawbyUrl(origin, params.path, params.correlationId)
  const timeoutMs = resolveTimeoutMs(params.env, params.correlationId)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let response: Response
  try {
    response = await fetch(url, {
      method: params.method,
      headers: params.headers,
      body: params.body,
      redirect: 'manual',
      signal: controller.signal,
    })
  } catch (error) {
    // Exactly one attempt: network errors and timeouts are never retried here
    // (KTD6) — the caller decides whether a higher-level replay applies.
    const isAbort = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
    throw new HTTPError({
      statusCode: 503,
      statusMessage: isAbort ? 'Blawby request timed out' : 'Blawby request failed',
      data: {
        code: isAbort ? 'BLAWBY_TIMEOUT' : 'BLAWBY_UNAVAILABLE',
        requestCorrelationId: params.correlationId,
      },
    })
  } finally {
    clearTimeout(timer)
  }

  // Rejected redirects: `redirect: 'manual'` never follows automatically;
  // any 3xx (or an opaque redirect result) is a classified failure, not a
  // second request, so no credential is ever sent to a redirect target.
  if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby returned a redirect',
      data: { code: 'BLAWBY_REDIRECT_REJECTED', requestCorrelationId: params.correlationId },
    })
  }

  if (response.status >= 500) {
    throw new HTTPError({
      statusCode: 503,
      statusMessage: 'Blawby is unavailable',
      data: { code: 'BLAWBY_UPSTREAM_UNAVAILABLE', requestCorrelationId: params.correlationId },
    })
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby returned a malformed response',
      data: { code: 'BLAWBY_MALFORMED_RESPONSE', requestCorrelationId: params.correlationId },
    })
  }

  return {
    status: response.status,
    body,
    wwwAuthenticate: response.headers.get('www-authenticate'),
  }
}

// -- Token exchange, scoped cache + coalescing (R2-R3) -------------------

interface TokenCacheEntry {
  token: string
  expiresAt: number
  inflight?: Promise<string>
}

// Isolate-local cache: tokens are short-lived credentials, and only requests
// within one isolate need coalescing (see plan Risks and Dependencies).
const tokenCache = new Map<string, TokenCacheEntry>()

const TOKEN_RENEWAL_SKEW_MS = 60_000

function tokenCacheKey(scope: string, audience: string): string {
  return `${scope}::${audience}`
}

function encodeBasicAuth(clientId: string, clientSecret: string): string {
  return btoa(`${clientId}:${clientSecret}`)
}

interface ParsedTokenResponse {
  accessToken: string
  expiresIn: number
}

function parseTokenResponse(body: unknown): ParsedTokenResponse | undefined {
  if (!isRecord(body)) return undefined
  const accessToken = readString(body, 'access_token')
  const expiresIn = readNumber(body, 'expires_in')
  const tokenType = readString(body, 'token_type')
  if (!accessToken || !expiresIn || expiresIn <= 0) return undefined
  if (!tokenType || tokenType.toLowerCase() !== 'bearer') return undefined
  return { accessToken, expiresIn }
}

async function requestFreshToken(
  env: CloudflareEnv,
  scope: string,
  audience: string,
  correlationId: string,
): Promise<{ token: string, expiresAt: number }> {
  const clientId = requireConfig(env, 'LEGAL_BLAWBY_CLIENT_ID')
  const clientSecret = requireConfig(env, 'LEGAL_BLAWBY_CLIENT_SECRET')
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    resource: audience,
    scope,
  }).toString()
  const headers = buildOutboundHeaders({
    contentType: 'application/x-www-form-urlencoded',
    authorization: `Basic ${encodeBasicAuth(clientId, clientSecret)}`,
    correlationId,
  })

  const result = await fetchBlawby({ env, path: BLAWBY_TOKEN_PATH, method: 'POST', headers, body, correlationId })

  if (result.status !== 200) {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby token exchange failed',
      data: { code: 'BLAWBY_TOKEN_EXCHANGE_FAILED', requestCorrelationId: correlationId },
    })
  }

  const parsed = parseTokenResponse(result.body)
  if (!parsed) {
    throw new HTTPError({
      statusCode: 502,
      statusMessage: 'Blawby token response did not match the expected contract',
      data: { code: 'BLAWBY_TOKEN_RESPONSE_INVALID', requestCorrelationId: correlationId },
    })
  }

  return { token: parsed.accessToken, expiresAt: Date.now() + parsed.expiresIn * 1000 }
}

// Concurrent callers for one scope perform exactly one token exchange
// (R3, AE4): the cache-check and inflight-promise registration below run
// synchronously (no `await` before the `tokenCache.set` that publishes the
// inflight promise), so a burst of same-tick callers all observe the same
// promise instead of racing separate exchanges.
function getCachedOrFreshToken(
  env: CloudflareEnv,
  scope: string,
  correlationId: string,
  forceRefresh: boolean,
): Promise<string> {
  if (!scope || /\s/.test(scope)) {
    throw new HTTPError({
      statusCode: 500,
      statusMessage: 'Blawby scope must be a single non-empty scope string',
      data: { code: 'BLAWBY_INVALID_SCOPE', requestCorrelationId: correlationId },
    })
  }

  const audience = requireConfig(env, 'LEGAL_BLAWBY_AUDIENCE')
  const key = tokenCacheKey(scope, audience)
  const now = Date.now()
  const entry = tokenCache.get(key)

  if (forceRefresh && entry) {
    tokenCache.delete(key)
  }

  const current = forceRefresh ? undefined : entry

  if (current?.inflight) {
    return current.inflight
  }

  if (!forceRefresh && current && current.expiresAt - TOKEN_RENEWAL_SKEW_MS > now) {
    return Promise.resolve(current.token)
  }

  const inflight: Promise<string> = requestFreshToken(env, scope, audience, correlationId)
    .then((result) => {
      tokenCache.set(key, { token: result.token, expiresAt: result.expiresAt })
      return result.token
    })
    .catch((error: unknown) => {
      tokenCache.delete(key)
      throw error
    })

  tokenCache.set(key, { token: current?.token ?? '', expiresAt: current?.expiresAt ?? 0, inflight })
  return inflight
}

export async function getBlawbyServiceToken(
  env: CloudflareEnv,
  scope: string,
  correlationId: string,
): Promise<string> {
  return getCachedOrFreshToken(env, scope, correlationId, false)
}

// -- Machine-auth discriminator + bounded refresh-and-replay (R3, F3) ----

function isMachineAuthFailure(result: BlawbyRawResponse): boolean {
  if (result.status !== 401) return false
  if (result.wwwAuthenticate && /invalid_token/i.test(result.wwwAuthenticate)) return true
  return isRecord(result.body) && readString(result.body, 'error') === 'invalid_token'
}

// -- Generic authenticated route dispatch (R2-R7, R23-R25, R28) ---------

export interface BlawbyRouteCallParams<TResponse> {
  routeKey: BlawbyRouteKey
  scope: string
  method: 'GET' | 'POST'
  identity: BlawbyTrustedIdentity
  correlationId: string
  requestReference?: string
  clientIp?: string
  body?: unknown
  /** Runtime-validate a successful (2xx) response body. Return undefined on mismatch. */
  parseResponse: (body: unknown) => TResponse | undefined
  /**
   * Runtime-validate a reviewed route-family 4xx error contract (R28).
   * Only a successfully parsed known error is passed through with its real
   * status; every other 4xx — including a domain 401 this function does not
   * recognize as the machine-auth discriminator — is sanitized to 502.
   */
  parseKnownError?: (status: number, body: unknown) => Record<string, unknown> | undefined
}

export async function callBlawbyRoute<TResponse>(
  env: CloudflareEnv,
  params: BlawbyRouteCallParams<TResponse>,
): Promise<TResponse> {
  const route = BLAWBY_BEARER_ROUTES[params.routeKey]
  const serializedBody = params.body !== undefined ? JSON.stringify(params.body) : undefined

  const attempt = async (forceRefresh: boolean): Promise<BlawbyRawResponse> => {
    const token = await getCachedOrFreshToken(env, params.scope, params.correlationId, forceRefresh)
    const headers = buildOutboundHeaders({
      contentType: serializedBody !== undefined ? 'application/json' : undefined,
      authorization: `Bearer ${token}`,
      identity: params.identity,
      requestReference: params.requestReference,
      // R5: the trusted client IP is only ever attached for the route(s)
      // flagged to carry it (engagement acceptance); every other route
      // omits it even if a caller passed one.
      clientIp: route.includeClientIp ? params.clientIp : undefined,
      correlationId: params.correlationId,
    })
    return fetchBlawby({
      env,
      path: route.path,
      method: params.method,
      headers,
      body: serializedBody,
      correlationId: params.correlationId,
    })
  }

  let result = await attempt(false)

  // Exactly one discriminated machine-auth refresh-and-replay (KTD6, F3).
  // A domain 401 (not the discriminator) and a second discriminated failure
  // both fall through to classification below without a further retry.
  if (isMachineAuthFailure(result)) {
    result = await attempt(true)
    if (isMachineAuthFailure(result)) {
      throw new HTTPError({
        statusCode: 502,
        statusMessage: 'Blawby authentication failed after refresh',
        data: { code: 'BLAWBY_AUTH_REFRESH_FAILED', requestCorrelationId: params.correlationId },
      })
    }
  }

  if (result.status >= 200 && result.status < 300) {
    const parsed = params.parseResponse(result.body)
    if (parsed === undefined) {
      throw new HTTPError({
        statusCode: 502,
        statusMessage: 'Blawby response did not match the expected contract',
        data: { code: 'BLAWBY_RESPONSE_SCHEMA_MISMATCH', requestCorrelationId: params.correlationId },
      })
    }
    return parsed
  }

  // fetchBlawby already classified 3xx/5xx/network/timeout above this call,
  // so every remaining status here is a 4xx.
  const known = params.parseKnownError?.(result.status, result.body)
  if (known) {
    throw new HTTPError({
      statusCode: result.status,
      statusMessage: 'Blawby rejected the request',
      data: { ...known, requestCorrelationId: params.correlationId },
    })
  }
  throw new HTTPError({
    statusCode: 502,
    statusMessage: 'Blawby returned an unreviewed error response',
    data: { code: 'BLAWBY_UNREVIEWED_ERROR', requestCorrelationId: params.correlationId },
  })
}
