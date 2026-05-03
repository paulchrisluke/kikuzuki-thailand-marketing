import { toWebRequest } from 'h3'
import { isAdminRequest } from '../../../utils/admin-auth'
import { cloudflareEnv, jsonResponse } from '../../../utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  if (!(await isAdminRequest(toWebRequest(event), env))) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
  }

  if (env.REVIEWS_DB) {
    await env.REVIEWS_DB.prepare(
      `DELETE FROM google_oauth_tokens WHERE provider = 'google'`
    ).run()
    await env.REVIEWS_DB.prepare(
      `UPDATE google_business_snapshots SET business_json = null, reviews_json = null, media_json = null, posts_json = null, errors_json = null, synced_at = null WHERE id = 'current'`
    ).run()
  }

  return jsonResponse({ ok: true })
})
