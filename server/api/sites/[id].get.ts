// Get single site details
import { cloudflareEnv, jsonResponse } from '../../utils/api-response'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'id')
  
  if (!siteId) {
    return jsonResponse({ 
      error: 'Site ID is required' 
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
    const site = await db.prepare(`
      SELECT id, organization_id, theme_id, name, slug, subdomain, 
             custom_domain, status, plan, created_at, updated_at
      FROM sites 
      WHERE id = ?
      LIMIT 1
    `).bind(siteId).first()
    
    if (!site) {
      return jsonResponse({ 
        error: 'Site not found' 
      }, { status: 404 })
    }
    
    return jsonResponse(site)
    
  } catch (error) {
    console.error('Failed to fetch site:', error)
    return jsonResponse({ 
      error: 'Failed to fetch site' 
    }, { status: 500 })
  }
})
