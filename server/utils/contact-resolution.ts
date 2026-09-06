import { queryFirst, type DbClient } from '~/server/db'

export async function resolveLocationContact(
  db: DbClient,
  siteId: string,
  locationId: string,
): Promise<{ contactPhone: string | null; contactEmail: string | null }> {
  const location = await queryFirst<{ phone: string | null; email: string | null }>(
    db,
    `SELECT phone, email FROM business_locations WHERE id = ? AND site_id = ? AND status = 'active' LIMIT 1`,
    [locationId, siteId],
  )
  return { contactPhone: location?.phone ?? null, contactEmail: location?.email ?? null }
}
