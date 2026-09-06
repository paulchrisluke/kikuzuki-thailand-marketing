import { queryAll } from '~/server/db'
import { defineScheduledTask } from '~/server/utils/scheduled-task'
import { refreshSocialCard, type SocialCardOwner } from '~/server/utils/social-card'

/**
 * Owners per run. Each one renders an image and uploads it, so this is bounded
 * by the work rather than by the number of sites: a single site with a full
 * menu is a hundred renders, which is not something to do in one scheduled
 * invocation. A backlog drains a little each night.
 */
const OWNERS_PER_RUN = 25

/** Only the owners regenerateSiteSocialCards supports, with their own filters. */
const OWNER_SOURCES: ReadonlyArray<{ table: string; ownerType: SocialCardOwner['owner_type']; filter?: string }> = [
  { table: 'sites', ownerType: 'site' },
  { table: 'business_locations', ownerType: 'business_location', filter: "status = 'active'" },
  { table: 'products', ownerType: 'product', filter: "is_visible = 1 AND product_type = 'standard'" },
  { table: 'experiences', ownerType: 'experience' },
  { table: 'posts', ownerType: 'post', filter: "status = 'published'" },
  { table: 'blog_posts', ownerType: 'blog_post', filter: "status = 'published'" },
  { table: 'offerings', ownerType: 'offering' },
  { table: 'reviews', ownerType: 'review', filter: "status = 'approved'" },
  { table: 'tenant_page_variants', ownerType: 'tenant_page', filter: "path != '/'" },
]

export default defineScheduledTask({
  meta: { name: 'social-card-backfill', description: 'Generate social cards for owners that have none' },
  async run({ context }): Promise<{ result: { generated: number; failed: number; remaining: number; skipped?: string } }> {
    const environment = (context as { cloudflare?: { env?: Record<string, unknown> } } | undefined)?.cloudflare?.env
    const db = environment?.DB as D1Database | undefined
    if (!db && import.meta.dev) return { result: { generated: 0, failed: 0, remaining: 0, skipped: 'DB unavailable in local scheduled task context' } }
    if (!db) throw new Error('DB is required')

    // Cards are generated whenever content or media changes through the API, so
    // an owner reaches this task only when its rows were written some other way —
    // an import or a seed writing SQL directly. Without this those pages would
    // serve no og:image at all until somebody noticed.
    const owners = await queryAll<{ owner_type: SocialCardOwner['owner_type']; owner_id: string }>(db, `
      ${OWNER_SOURCES.map(({ table, ownerType, filter }) => `
        SELECT '${ownerType}' AS owner_type, ${table}.id AS owner_id, ${table}.created_at AS created_at
          FROM ${table}
         WHERE ${filter ? `${filter} AND ` : ''}NOT EXISTS (
           SELECT 1 FROM media_placements mp
            WHERE mp.owner_type = '${ownerType}' AND mp.owner_id = ${table}.id
              AND mp.slot = 'social_card' AND mp.status = 'active'
         )`).join('\n        UNION ALL')}
      ORDER BY created_at ASC
      LIMIT ?
    `, [OWNERS_PER_RUN + 1])

    let generated = 0
    let failed = 0
    for (const owner of owners.slice(0, OWNERS_PER_RUN)) {
      const result = await refreshSocialCard({ db, env: environment as never, owner: owner as SocialCardOwner })
      if (result.kind === 'generated') generated += 1
      if (result.kind === 'failed') failed += 1
    }
    // One extra row was fetched purely to report whether a backlog remains.
    return { result: { generated, failed, remaining: owners.length > OWNERS_PER_RUN ? OWNERS_PER_RUN + 1 : owners.length - generated - failed } }
  },
})
