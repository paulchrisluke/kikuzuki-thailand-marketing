import { defineEventHandler, toWebRequest } from 'h3'
import { getPageContent, getDraftContent } from '~/server/utils/content-management'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const page = event.context.params?.page || 'home'
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB

  if (!env.REVIEWS_DB) throw createError({ statusCode: 503, message: 'Database unavailable' })

  const isAdmin = await isAdminRequest(toWebRequest(event), env)

  const publishedContent = await getPageContent(db, page)

  if (isAdmin) {
    const drafts = await getDraftContent(db, page)
    const mergedContent = [...publishedContent]
    for (const draft of drafts) {
      const index = mergedContent.findIndex(c => c.field === draft.field)
      if (index !== -1) {
        mergedContent[index] = { ...mergedContent[index], ...draft }
      } else {
        mergedContent.push(draft)
      }
    }
    return { content: mergedContent, hasDrafts: drafts.length > 0 }
  }

  return { content: publishedContent, hasDrafts: false }
})
