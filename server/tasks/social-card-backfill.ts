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
    //
    // Every owner type regenerateSiteSocialCards covers is checked, not just the
    // site's own card: a site whose brand card exists while its locations and
    // products have none would otherwise never be picked up, and those are the
    // public pages a guest actually lands on.
    const uncarded = (table: string, ownerType: string, filter = '') => `
      SELECT ${table}.site_id AS site_id FROM ${table}
       WHERE ${filter ? `${filter} AND ` : ''}NOT EXISTS (
         SELECT 1 FROM media_placements mp
          WHERE mp.site_id = ${table}.site_id AND mp.owner_type = '${ownerType}'
            AND mp.owner_id = ${table}.id AND mp.slot = 'social_card' AND mp.status = 'active'
       )`
    const sites = await queryAll<{ id: string }>(db, `
      SELECT DISTINCT site_id AS id FROM (
        SELECT sites.id AS site_id FROM sites
         WHERE NOT EXISTS (
           SELECT 1 FROM media_placements mp
            WHERE mp.site_id = sites.id AND mp.owner_type = 'site'
              AND mp.slot = 'social_card' AND mp.status = 'active'
         )
        UNION ${uncarded('business_locations', 'business_location', "business_locations.status = 'active'")}
        UNION ${uncarded('products', 'product', "products.is_visible = 1 AND products.product_type = 'standard'")}
        UNION ${uncarded('experiences', 'experience')}
        UNION ${uncarded('posts', 'post', "posts.status = 'published'")}
        UNION ${uncarded('blog_posts', 'blog_post', "blog_posts.status = 'published'")}
        UNION ${uncarded('offerings', 'offering')}
        UNION ${uncarded('reviews', 'review', "reviews.status = 'approved'")}
        UNION ${uncarded('tenant_page_variants', 'tenant_page', "tenant_page_variants.path != '/'")}
      )
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
