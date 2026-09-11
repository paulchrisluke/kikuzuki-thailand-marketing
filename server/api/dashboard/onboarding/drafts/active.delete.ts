// DELETE /api/dashboard/onboarding/drafts/active
//
// Abandoning the draft: the owner rewound past the business name, so the
// pending site the first save created is at an address they did not mean to
// claim. Delete it now — nothing was ever public — and close the draft so the
// next save starts a fresh one at the address the new name derives.

import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getAuthSession } from '~/server/utils/auth'
import { execute, queryFirst } from '~/server/db'
import { deletePendingSiteNow } from '~/server/utils/tenant-deletion'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const session = await getAuthSession(event, env)
  if (!session?.user?.id) return jsonResponse({ error: 'Authentication required' }, { status: 401 })

  const draft = await queryFirst<{ id: string; organization_id: string | null; subdomain_candidate: string }>(db, `
    SELECT id, organization_id, subdomain_candidate
    FROM onboarding_drafts
    WHERE user_id = ? AND status = 'active'
    LIMIT 1
  `, [session.user.id])
  if (!draft) return jsonResponse({ success: true, deleted: false })

  let deleted = false
  if (draft.organization_id) {
    const site = await queryFirst<{ id: string }>(db, `
      SELECT id FROM sites
      WHERE organization_id = ? AND subdomain = ? AND onboarding_status = 'pending'
      LIMIT 1
    `, [draft.organization_id, draft.subdomain_candidate])
    if (site) {
      const result = await deletePendingSiteNow(env, site.id, session.user.id)
      deleted = result.deleted
      if (!result.deleted && result.reason === 'site_is_live') {
        // The owner activated it in another tab. Leave the site alone and leave
        // the draft for the activation flow to close.
        return jsonResponse({ error: 'This site is already live.' }, { status: 409 })
      }
    }
  }

  await execute(db, `
    UPDATE onboarding_drafts SET status = 'abandoned', updated_at = ? WHERE id = ? AND status = 'active'
  `, [new Date().toISOString(), draft.id])

  return jsonResponse({ success: true, deleted })
})
import { defineHandler } from 'nitro';
