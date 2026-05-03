import { defineEventHandler, readBody, createError, toWebRequest } from 'h3'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { discardDrafts, discardAllDrafts } from '~/server/utils/content-management'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)

  const body = await readBody(event)
  const { path, all } = body

  if (!await isAdminRequest(toWebRequest(event), env)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const db = env.REVIEWS_DB

  if (!env.REVIEWS_DB) throw createError({ statusCode: 503, message: 'Database unavailable' })

  if (all) {
    await discardAllDrafts(db)
    return { success: true, scope: 'all' }
  }

  if (!path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path or all flag' })
  }

  const page = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
  await discardDrafts(db, page)

  return { success: true, scope: 'page', page }
})
