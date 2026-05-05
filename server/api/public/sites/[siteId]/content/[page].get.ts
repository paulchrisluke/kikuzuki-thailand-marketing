// Get published content for public tenant rendering (no auth required)
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { getPageContent } from '~/server/utils/content-management'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  const page = getRouterParam(event, 'page')
  const locationSlug = getQuery(event).location as string || undefined
  
  if (!siteId || !page) {
    return jsonResponse({ 
      error: 'Site ID and page are required' 
    }, { status: 400 })
  }
  
  const env = cloudflareEnv(event)
  const db = env.REVIEWS_DB
  
  if (!db) {
    return jsonResponse({ 
      error: 'Database not available' 
    }, { status: 500 })
  }

  try {
    // Get site info (public access)
    const site = await db.prepare(`
      SELECT id, organization_id, status, onboarding_status 
      FROM sites 
      WHERE id = ? AND status = 'active' AND onboarding_status = 'active'
      LIMIT 1
    `).bind(siteId).first()
    
    if (!site) {
      return jsonResponse({ 
        error: 'Site not found or not active' 
      }, { status: 404 })
    }

    // Find location by slug if provided
    let locationId = null
    if (locationSlug) {
      const location = await db.prepare(`
        SELECT id FROM business_locations 
        WHERE site_id = ? AND slug = ? AND status = 'active'
        LIMIT 1
      `).bind(siteId, locationSlug).first()
      
      if (location) {
        locationId = location.id
      }
    }

    // Get published content only (no drafts)
    const content = await getPageContent(db, site.organization_id, siteId, page, locationId)
    
    return jsonResponse({
      success: true,
      content,
      siteId,
      locationId,
      page
    })
    
  } catch (error) {
    console.error('Failed to get public content:', error)
    return jsonResponse({ 
      error: 'Failed to get content' 
    }, { status: 500 })
  }
})
