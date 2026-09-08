import { randomUUID } from 'node:crypto'
import { expect, type APIRequestContext } from '@playwright/test'
import { loginAs } from './auth'

export const MCP_VERSION = '2025-06-18'
// Fixed fixture sites seeded by generate-demo-seed.ts with the matching plan already
// active. Entitlement checks are site-scoped (hasSiteEntitlement), so a plan-gated tool
// call needs the org's actual paid site, not a brand-new site from ensureSite() (which
// always starts on `free` per the second-site billing rule).
export const MCP_GROWTH_SITE_ID = 'site-mcp-growth'
export const MCP_GROWTH_SERVICE_SITE_ID = 'site-mcp-growth-service'

export async function mcpRequest(
  request: APIRequestContext,
  baseURL: string,
  options: {
    method: 'initialize' | 'notifications/initialized' | 'server/discover' | 'tools/list' | 'tools/call' | 'resources/list' | 'resources/read' | 'bad/method'
    id?: string | number
    siteId?: string
    toolName?: string
    args?: Record<string, unknown>
    extraHeaders?: Record<string, string>
    params?: Record<string, unknown>
    idempotent?: boolean
  },
) {
  const payload = {
    jsonrpc: '2.0',
    id: options.id ?? `${options.method}-${Date.now()}`,
    method: options.method,
    params: options.params ?? (options.method === 'tools/call'
      ? { name: options.toolName, arguments: options.args ?? {} }
      : options.siteId ? { site_id: options.siteId } : {}),
    _meta: {
      'io.modelcontextprotocol/version': MCP_VERSION,
      'io.modelcontextprotocol/method': options.method,
      ...(options.method === 'tools/call' && options.toolName ? { 'io.modelcontextprotocol/name': options.toolName } : {}),
    },
  }

  const requestId = randomUUID()
  const startedAt = Date.now()
  const diagnostic = { requestId, method: options.method, tool: options.toolName ?? null }
  console.info('[e2e-mcp]', JSON.stringify({ event: 'started', ...diagnostic }))
  try {
    const response = await request.post(`${baseURL}/api/mcp`, {
      maxRetries: options.idempotent ? 1 : 0,
      headers: {
        'content-type': 'application/json',
        'mcp-protocol-version': MCP_VERSION,
        'mcp-method': options.method,
        ...(options.method === 'tools/call' && options.toolName ? { 'mcp-name': options.toolName } : {}),
        ...(options.extraHeaders ?? {}),
        'x-request-id': requestId,
      },
      data: payload,
    })
    const headers = response.headers()
    console.info('[e2e-mcp]', JSON.stringify({
      event: 'finished', ...diagnostic, durationMs: Date.now() - startedAt,
      status: response.status(), rayId: headers['cf-ray'] ?? null,
      serverRequestId: headers['x-request-id'] ?? null,
      d1Statements: headers['x-d1-query-count'] ?? null,
      d1Batches: headers['x-d1-batch-count'] ?? null,
      d1DurationMs: headers['x-d1-duration-ms'] ?? null,
      serverDurationMs: headers['x-total-duration-ms'] ?? null,
    }))
    return response
  } catch (error) {
    // Playwright puts the full request, cookies included, in the error's call log.
    // The first line is only the failure kind, e.g. "apiRequestContext.post: read ECONNRESET".
    const reason = error instanceof Error ? error.message.split('\n')[0] : String(error)
    console.error('[e2e-mcp]', JSON.stringify({ event: 'transport_failed', ...diagnostic, reason, durationMs: Date.now() - startedAt }))
    // The original error is deliberately not attached as `cause`: its call log carries the cookies.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`MCP transport failed: ${options.method} ${options.toolName ?? ''}; ${reason}; requestId=${requestId}`)
  }
}

// Extracts typed data from a tools/call result and preserves protocol/tool
// failures as test failures with the server's error text.
export function mcpData<T>(body: { error?: unknown; result?: { isError?: boolean; content?: Array<{ type?: string; text?: string }>; structuredContent?: unknown } }): T {
  if (body.error) {
    throw new Error(`MCP request failed: ${JSON.stringify(body.error)}`)
  }
  if (body.result?.isError) {
    const message = body.result.content
      ?.map(item => item.text)
      .filter((text): text is string => typeof text === 'string' && text.length > 0)
      .join('\n')
    throw new Error(`MCP tool call failed: ${message || 'unknown error'}`)
  }
  if (body.result?.structuredContent && typeof body.result.structuredContent === 'object') {
    return body.result.structuredContent as T
  }
  throw new Error('MCP tool response contained no result.structuredContent')
}

export async function ensureSite(request: APIRequestContext, baseURL: string) {
  const suffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  const res = await request.post(`${baseURL}/api/sites`, {
    data: { name: `MCP E2E ${suffix}`, subdomain: `e2e-mcp-${suffix}`, vertical: 'restaurant' },
  })
  expect(res.ok(), await res.text()).toBe(true)
  const { siteId } = await res.json() as { siteId: string }
  expect(siteId).toEqual(expect.any(String))
  return siteId
}

export async function ensureLocation(request: APIRequestContext, baseURL: string, siteId: string) {
  const locations = await mcpRequest(request, baseURL, {
    method: 'tools/call',
    toolName: 'list_locations',
    args: { site_id: siteId },
  })
  expect(locations.status()).toBe(200)
  const locationsBody = await locations.json()
  const data = mcpData<{ locations: Array<{ id: string }> }>(locationsBody)
  expect(data.locations, 'A newly provisioned test site has one seeded location').toHaveLength(1)
  return data.locations[0]!.id
}

// Create disposable locations through the same API used by the CMS.
export async function createScratchLocation(request: APIRequestContext, baseURL: string, siteId: string) {
  const response = await request.post(`${baseURL}/api/sites/${siteId}/locations`, {
    data: { title: `MCP Scratch Location ${Date.now()}`, city: 'Krabi' },
  })
  expect(response.status(), await response.text()).toBe(201)
  const { location } = await response.json() as { location: { id: string } }
  expect(location.id).toEqual(expect.any(String))
  return location.id
}

export async function loginAsFreshMcpUser(request: APIRequestContext, baseURL: string, label: string) {
  const userId = `user-e2e-mcp-fresh-${label}`
  await loginAs(request, baseURL, userId)
  return userId
}
