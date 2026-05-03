import { defineEventHandler, getQuery, toWebRequest } from 'h3'
import { getPageContent, getDraftContent } from '~/server/utils/content-management'
import { isAdminRequest } from '~/server/utils/admin-auth'
import { cloudflareEnv } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const page = event.context.params?.page || 'home'
  const query = getQuery(event)
  const isEditMode = query.edit === 'true'
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB

  // Handle missing database in development
  if (!db) {
    console.warn('Database not available in development mode, returning mock data')
    return { 
      content: [
        { id: '1', page, field: 'hero.title', content: 'Welcome to KIKUZUKI', updated_at: new Date().toISOString() },
        { id: '2', page, field: 'hero.subtitle', content: 'Authentic Japanese Robatayaki', updated_at: new Date().toISOString() }
      ], 
      hasDrafts: false 
    }
  }

  // Fetch published content
  const publishedContent = await getPageContent(db, page)

  // In edit mode, merge drafts on top for authorized admins
  if (isEditMode && await isAdminRequest(toWebRequest(event), env)) {
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
