// Get sites for organizations
import { cloudflareEnv, jsonResponse } from '../utils/api-response'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { organization_ids } = query
  
  if (!organization_ids || typeof organization_ids !== 'string') {
    return jsonResponse({ 
      error: 'Organization IDs are required' 
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
    const orgIdList = organization_ids.split(',')
    
    // Build WHERE clause for multiple organization IDs
    const placeholders = orgIdList.map(() => '?').join(',')
    const sites = await db.prepare(`
      SELECT id, organization_id, theme_id, name, slug, subdomain, 
             custom_domain, status, plan, created_at, updated_at
      FROM sites 
      WHERE organization_id IN (${placeholders})
      ORDER BY created_at DESC
    `).bind(...orgIdList).all()
    
    return jsonResponse({
      sites: sites.results || []
    })
    
  } catch (error) {
    console.error('Failed to fetch sites:', error)
    return jsonResponse({ 
      error: 'Failed to fetch sites' 
    }, { status: 500 })
  }
})
