import { toWebRequest } from 'h3'
import { getSiteContent, getPageContent, getSiteContentField } from '~/server/utils/content-management'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const env = cloudflareEnv(event)
  if (!(await isAdminRequest(toWebRequest(event), env))) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  const query = getQuery(event)
  const db = env.D1_DATABASE

  if (query.page && query.field) {
    const content = await getSiteContentField(db, query.page as string, query.field as string)
    if (!content) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Content not found'
      })
    }
    return { content }
  }

  if (query.page) {
    const pageContent = await getPageContent(db, query.page as string)
    return { content: pageContent }
  }

  const allContent = await getSiteContent(db)
  return { content: allContent }
})
