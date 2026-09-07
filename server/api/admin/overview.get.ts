import { getQuery } from 'nitro/h3'
import { queryAll } from '~/server/db'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { listPlatformOrganizations, platformPermissionError, requirePlatformEventPermission } from '~/server/utils/platform-admin-users'
import { findOrganizationById, listOrganizationMembers } from '~/server/utils/member-access'

interface OrganizationRow { id: string; name: string; slug: string | null; impersonation_user_id: string | null }
interface SiteRow { id: string; organization_id: string; slug: string; brand_name: string | null; subdomain: string | null; status: string | null }
interface LocationRow { id: string; site_id: string; slug: string; title: string; city: string | null; }

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event)
  const db = env.DB
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  try {
    await requirePlatformEventPermission(event, env, { platform: ['organizations'] })
    const organizationId = String(getQuery(event).id || '').trim()
    const selectedOrganization = organizationId ? await findOrganizationById(env, organizationId) : null
    const [organizations, siteRows, locationRows] = await Promise.all([
      organizationId
        ? Promise.resolve(selectedOrganization ? [selectedOrganization] : [])
        : listPlatformOrganizations(env, { limit: 50 }), queryAll<SiteRow>(db, `
        SELECT id, organization_id, slug, brand_name, subdomain, status
        FROM sites
        ${organizationId ? 'WHERE organization_id = ?' : ''}
        ORDER BY COALESCE(brand_name, slug) ASC
      `, organizationId ? [organizationId] : []), queryAll<LocationRow>(db, `
        SELECT bl.id, bl.site_id, bl.slug, bl.title, bl.city
        FROM business_locations bl
        ${organizationId ? 'JOIN sites s ON s.id = bl.site_id WHERE s.organization_id = ?' : ''}
        ORDER BY title ASC
      `, organizationId ? [organizationId] : []), ])
    const organizationRows: OrganizationRow[] = await Promise.all(organizations.map(async (organization) => {
      const members = await listOrganizationMembers(env, organization.id)
      const impersonationUser = members.find(member => member.role === 'owner')
      return {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        impersonation_user_id: impersonationUser?.userId ?? null,
      }
    }))
    organizationRows.sort((left, right) => left.name.localeCompare(right.name))

    const locationsBySite = new Map<string, LocationRow[]>()
    for (const location of locationRows) locationsBySite.set(location.site_id, [...(locationsBySite.get(location.site_id) || []), location])

    const sitesByOrganization = new Map<string, SiteRow[]>()
    for (const site of siteRows) sitesByOrganization.set(site.organization_id, [...(sitesByOrganization.get(site.organization_id) || []), site])

    return jsonResponse({
      organizations: organizationRows.map(organization => ({
        id: organization.id, name: organization.name, slug: organization.slug, impersonationUserId: organization.impersonation_user_id, sites: (sitesByOrganization.get(organization.id) || []).map(site => ({
          id: site.id, slug: site.slug, name: site.brand_name, subdomain: site.subdomain, status: site.status, locations: (locationsBySite.get(site.id) || []).map(location => ({
            id: location.id, slug: location.slug, title: location.title, city: location.city, })), })), })), })
  } catch (error) {
    const { statusCode, message } = platformPermissionError(error, 'Failed to load organizations')
    return jsonResponse({ error: message }, { status: statusCode })
  }
})
import { defineHandler } from 'nitro';
