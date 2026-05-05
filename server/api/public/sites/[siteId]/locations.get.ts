// Get public business locations for a site
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'

export default defineEventHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  
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
    // Get site and verify it's active
    const site = await db.prepare(`
      SELECT id, organization_id, status FROM sites 
      WHERE id = ? AND status = 'active'
      LIMIT 1
    `).bind(siteId).first()
    
    if (!site) {
      return jsonResponse({ 
        error: 'Site not found or inactive' 
      }, { status: 404 })
    }

    // Get active business locations for this site
    const locations = await db.prepare(`
      SELECT id, slug, title, address, phone, website_url, maps_url, latitude, longitude,
             opening_hours, rating, review_count, is_primary, status, last_synced_at,
             google_location_id, google_connection_id, image_url, city
      FROM business_locations 
      WHERE organization_id = ? AND site_id = ? AND status = 'active'
      ORDER BY is_primary DESC, title ASC
    `).bind(site.organization_id, siteId).all()
    
    // Parse JSON fields and return public-safe data
    const parsedLocations = (locations.results || []).map((location: any) => ({
      id: location.id,
      slug: location.slug,
      title: location.title,
      address: location.address ? JSON.parse(location.address) : null,
      phone: location.phone,
      website_url: location.website_url,
      maps_url: location.maps_url,
      latitude: location.latitude,
      longitude: location.longitude,
      opening_hours: location.opening_hours ? JSON.parse(location.opening_hours) : null,
      rating: location.rating,
      review_count: location.review_count,
      is_primary: location.is_primary,
      status: location.status,
      image_url: location.image_url,
      city: location.city
    }))
    
    return jsonResponse({
      success: true,
      locations: parsedLocations,
      count: parsedLocations.length
    })
    
  } catch (error) {
    console.error('Failed to get public business locations:', error)
    return jsonResponse({ 
      error: 'Failed to get business locations' 
    }, { status: 500 })
  }
})
