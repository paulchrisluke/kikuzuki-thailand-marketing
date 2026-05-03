import { defineEventHandler, readBody, createError, toWebRequest } from 'h3'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { publishDrafts, publishAllDrafts } from '~/server/utils/content-management'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)

  // if (!await isAdminRequest(toWebRequest(event), env)) {
  //   throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  // }

  const { path, all } = await readBody(event)
  const db = env.REVIEWS_DB

  // Handle missing database in development
  if (!db) {
    console.warn('Database not available in development mode, mocking publish')
    return { success: true, mocked: true }
  }

  try {
    if (all) {
      await publishAllDrafts(db)
      return { success: true, scope: 'all' }
    }

    if (!path) {
      throw createError({ statusCode: 400, statusMessage: 'Missing path or all flag' })
    }

    const page = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
    await publishDrafts(db, page)

    return { success: true, scope: 'page', page }
  } catch (err: any) {
    console.error('Failed to publish drafts:', err)
    throw createError({ statusCode: 500, statusMessage: err.message || 'Database error' })
  }
})
