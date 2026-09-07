import { queryFirst } from '~/server/db'
import type { IntegrationVersion } from '~/shared/site-settings'
import { jsonResponse } from '~/server/utils/api-response'
import { getGoogleAnalyticsAuthUrl } from '~/server/utils/google-analytics'
import { signOAuthState } from '~/server/utils/encryption'
import { requireSiteAccess } from '~/server/utils/location-access'

export default defineHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  if (!siteId) {
    return jsonResponse({ error: 'Site ID is required' }, { status: 400 })
  }

  const { env, db, session, site } = await requireSiteAccess(event, siteId)

  try {
    const version = await queryFirst<IntegrationVersion>(db, `
      SELECT json_extract(integrations_json, '$.google.revision') AS revision,
             json_extract(settings_json, '$.config.resource_team_generation') AS transfer_generation
        FROM sites WHERE id = ? AND organization_id = ?
    `, [site.id, site.organization_id])
    if (!version) throw new Error('Site no longer belongs to this organization')

    const statePayload = {
      ...version, siteId: site.id, organizationId: site.organization_id, userId: session.user.id, timestamp: Date.now()
    }

    const hmacSecret = env.CONNECTOR_TOKEN_ENCRYPTION_KEY as string | undefined
    if (!hmacSecret) {
      return jsonResponse({ error: 'Server misconfiguration: encryption key not set' }, { status: 500 })
    }
    const state = await signOAuthState(hmacSecret, statePayload)

    const authUrl = getGoogleAnalyticsAuthUrl(env, state)

    return jsonResponse({ success: true, authUrl })
  } catch (error) {
    console.error('Failed to start Google Analytics OAuth:', error)
    const message = error instanceof Error ? error.message : 'Failed to start Google Analytics authorization'
    return jsonResponse({ error: message }, { status: 500 })
  }
})
import { defineHandler } from 'nitro';
import { getRouterParam } from 'nitro/h3';
