import { defineEventHandler, getQuery, toWebRequest, createError } from 'h3'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { getDraftStatus } from '~/server/utils/content-management'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)

  if (!await isAdminRequest(toWebRequest(event), env)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const db = env.REVIEWS_DB
  const page = query.page as string | undefined

  return await getDraftStatus(db, page)
})
