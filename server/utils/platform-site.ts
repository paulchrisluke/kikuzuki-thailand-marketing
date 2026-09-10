import { queryFirst, type DbClient } from '~/server/db'
import { PLATFORM_TEMPLATE } from '~/utils/template-registry'

export interface PlatformSiteIdentity {
  id: string
  organization_id: string
}

/**
 * KrabiClaw's own site is the one site running the platform template. Request
 * handlers already have it as `event.context.siteId` once the platform host has
 * resolved; this lookup is for work that runs outside a request for that host
 * (search corpus, llms.txt, analytics roll-ups).
 */
export async function getPlatformSite(db: DbClient): Promise<PlatformSiteIdentity> {
  const site = await queryFirst<PlatformSiteIdentity>(
    db,
    "SELECT id, organization_id FROM sites WHERE theme_id = ? AND status = 'active' LIMIT 1",
    [PLATFORM_TEMPLATE.themeId],
  )
  if (!site) throw new Error('No active site runs the platform template')
  return site
}
