import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { processQueuedTranslationJobs } from '~/server/utils/translation-processor'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const secret = typeof env.CRON_SECRET === 'string' ? env.CRON_SECRET : ''
  if (secret) {
    const authorization = getHeader(event, 'authorization') || ''
    if (authorization !== `Bearer ${secret}`) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!import.meta.dev) {
    return jsonResponse({ error: 'CRON_SECRET is required' }, { status: 500 })
  }

  const body = await readBody(event).catch(() => ({})) as { limit?: number; batches_per_job?: number }
  const result = await processQueuedTranslationJobs(db, env, {
    limit: body.limit,
    batchesPerJob: body.batches_per_job,
  })

  return jsonResponse({ success: true, ...result })
})
