/**
 * Ownership policy for schema tables that carry both organization_id
 * and site_id.  Every table belongs to exactly one category; the product
 * model guard parses schema.ts and verifies that this union stays exhaustive.
 *
 * The runtime transfer builder consumes these lists instead of inferring
 * ownership from table names or blindly moving every scoped row.
 */

export const SITE_TRANSFER_REPARENT_TABLES = [
  'customers', 'business_locations', 'requests', 'content_documents',
  'media_assets', 'media_placements', 'product_categories', 'products', 'prices',
  'review_requests', 'reviews', 'offerings', 'site_redirects', 'resource_localizations',
  'analytics_summaries', 'analytics_events', 'site_domains', 'site_locales',
] as const

export const SITE_TRANSFER_RETAIN_TABLES = [
  'usage_events', 'stripe_ga4_subscription_intents', 'mcp_tool_call_events', 'activity_entries',
] as const

export const SITE_TRANSFER_REVOKE_TABLES = ['user_workspace_state'] as const
// Epoch 3 inherits access directly from the destination organization. No billing,
// entitlement, or other derived projection is rebuilt during a site transfer.
export const SITE_TRANSFER_REBUILD_TABLES = [] as const

export const SITE_TRANSFER_POLICY = {
  reparent: SITE_TRANSFER_REPARENT_TABLES,
  retain: SITE_TRANSFER_RETAIN_TABLES,
  revoke: SITE_TRANSFER_REVOKE_TABLES,
  rebuild: SITE_TRANSFER_REBUILD_TABLES,
} as const

export const RESOURCE_TEAM_GENERATION_CONFIG_KEY = 'resource_team_generation'
export const RESOURCE_TEAM_GENERATION_MAX_COMPONENT_LENGTH = 256

export interface ResourceTeamGeneration {
  transfer_id: string
  generation: string
}

function assertResourceTeamGenerationComponent(value: unknown, field: keyof ResourceTeamGeneration): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > RESOURCE_TEAM_GENERATION_MAX_COMPONENT_LENGTH) {
    throw new Error(`Invalid ${RESOURCE_TEAM_GENERATION_CONFIG_KEY}.${field}`)
  }
}

export function serializeResourceTeamGeneration(value: ResourceTeamGeneration): string {
  assertResourceTeamGenerationComponent(value.transfer_id, 'transfer_id')
  assertResourceTeamGenerationComponent(value.generation, 'generation')
  return JSON.stringify({
    transfer_id: value.transfer_id,
    generation: value.generation,
  })
}

export function parseResourceTeamGeneration(raw: string): ResourceTeamGeneration {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Invalid ${RESOURCE_TEAM_GENERATION_CONFIG_KEY}`)
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid ${RESOURCE_TEAM_GENERATION_CONFIG_KEY}`)
  }
  const keys = Object.keys(parsed).sort()
  if (keys.length !== 2 || keys[0] !== 'generation' || keys[1] !== 'transfer_id') {
    throw new Error(`Invalid ${RESOURCE_TEAM_GENERATION_CONFIG_KEY}`)
  }
  const value = parsed as Partial<ResourceTeamGeneration>
  assertResourceTeamGenerationComponent(value.transfer_id, 'transfer_id')
  assertResourceTeamGenerationComponent(value.generation, 'generation')
  return {
    transfer_id: value.transfer_id,
    generation: value.generation,
  }
}

export type SiteTransferPolicyCategory = keyof typeof SITE_TRANSFER_POLICY
export type SiteTransferPolicyTable = typeof SITE_TRANSFER_POLICY[SiteTransferPolicyCategory][number]

const policyTables = Object.values(SITE_TRANSFER_POLICY).flat()

if (new Set(policyTables).size !== policyTables.length) {
  throw new Error('Site transfer policy contains duplicate tables.')
}
