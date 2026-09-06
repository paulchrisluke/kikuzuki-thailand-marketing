import { queryAll } from '~/server/db'
import { defineScheduledTask } from '~/server/utils/scheduled-task'
import { regenerateSiteSocialCards } from '~/server/utils/social-card'

/**
 * Sites per run. Generation renders and uploads an image per owner, so this is
 * bounded rather than sweeping every site each night.
 */
const SITES_PER_RUN = 3

export default defineScheduledTask({
  meta: { name: 'social-card-backfill', description: 'Generate social cards for sites that have none' },
  async run({ context }): Promise<{ result: { sites: number; generated: number; failed: number; skipped?: string } }> {
    const environment = (context as { cloudflare?: { env?: Record<string, unknown> } } | undefined)?.cloudflare?.env
    const db = environment?.DB as D1Database | undefined
    if (!db && import.meta.dev) return { result: { sites: 0, generated: 0, failed: 0, skipped: 'DB unavailable in local scheduled task context' } }
    if (!db) throw new Error('DB is required')

    // Cards are generated whenever content or media changes through the API, so
    // a site reaches this task only when its rows were written some other way —
    // an import or a seed writing SQL directly. Without this those sites would
    // serve no og:image at all until somebody noticed.
    const sites = await queryAll<{ id: string }>(db, `
      SELECT s.id
        FROM sites s
       WHERE NOT EXISTS (
         SELECT 1 FROM media_placements mp
          WHERE mp.site_id = s.id AND mp.owner_type = 'site'
            AND mp.slot = 'social_card' AND mp.status = 'active'
       )
       ORDER BY s.created_at ASC
       LIMIT ?
    `, [SITES_PER_RUN])

    let generated = 0
    let failed = 0
    for (const site of sites) {
      const results = await regenerateSiteSocialCards({ db, env: environment as never, siteId: site.id })
      generated += results.filter(result => result.kind === 'generated').length
      failed += results.filter(result => result.kind === 'failed').length
    }
    return { result: { sites: sites.length, generated, failed } }
  },
})
