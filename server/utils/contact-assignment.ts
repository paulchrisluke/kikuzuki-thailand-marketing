import { queryFirst, type DbClient } from '~/server/db'

export interface ContactSubmissionAssignment {
  selectedLocation: { id: string; title: string } | null
  experience: { id: string; title: string; location_id: string } | null
  assignedLocationId: string | null
  error: string | null
}

export async function resolveContactSubmissionAssignment(
  db: DbClient,
  opts: {
    siteId: string
    locationId?: string | null
    experienceId?: string | null
  },
): Promise<ContactSubmissionAssignment> {
  let selectedLocation: ContactSubmissionAssignment['selectedLocation'] = null
  if (opts.locationId) {
    selectedLocation = await queryFirst<{ id: string; title: string }>(
      db,
      'SELECT id, title FROM business_locations WHERE id = ? AND site_id = ? LIMIT 1',
      [opts.locationId, opts.siteId],
    )
    if (!selectedLocation) {
      return {
        selectedLocation: null,
        experience: null,
        assignedLocationId: null,
        error: 'location_id must reference a location on this site',
      }
    }
  }

  let experience: ContactSubmissionAssignment['experience'] = null
  if (opts.experienceId) {
    experience = await queryFirst<{ id: string; title: string; location_id: string }>(
      db,
      'SELECT p.id, p.name AS title, p.location_id FROM products p WHERE p.product_type = \'experience\' AND p.id = ? AND p.site_id = ? LIMIT 1',
      [opts.experienceId, opts.siteId],
    )
    if (!experience) {
      return {
        selectedLocation,
        experience: null,
        assignedLocationId: null,
        error: 'experience_id must reference an experience on this site',
      }
    }
  }

  return {
    selectedLocation,
    experience,
    assignedLocationId: experience?.location_id ?? selectedLocation?.id ?? null,
    error: null,
  }
}
