import { defineEventHandler, readBody, createError, toWebRequest } from 'h3'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { buildUpsertDraftStmt } from '~/server/utils/content-management'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)

  // if (!await isAdminRequest(toWebRequest(event), env)) {
  //   throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  // }

  const { path, changes } = await readBody(event)

  if (!path || !changes) {
    throw createError({ statusCode: 400, statusMessage: 'Missing path or changes' })
  }

  const page = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '-')
  const db = env.REVIEWS_DB

  // Handle missing database in development
  if (!db) {
    console.warn('Database not available in development mode, mocking draft save')
    return { success: true, mocked: true }
  }

  try {
    const stmts = []
    for (const [field, value] of Object.entries(changes as Record<string, unknown>)) {
      stmts.push(buildUpsertDraftStmt(db, {
        id: `${page}-${field}`,
        page,
        field,
        content: typeof value === 'string' ? value : JSON.stringify(value)
      }))
    }
    
    if (stmts.length > 0) {
      console.log(`[draft.post.ts] Executing db.batch with ${stmts.length} statements...`)
      await db.batch(stmts)
      console.log(`[draft.post.ts] db.batch completed successfully.`)
    }
    
    return { success: true }
  } catch (err: any) {
    console.error('[draft.post.ts] Failed to save drafts:', err)
    throw createError({ statusCode: 500, statusMessage: err.message || 'Database error' })
  }
})
