import { HTTPError } from 'nitro'
import { execute, queryFirst, type DbClient } from '~/server/db'

export interface SiteConfig {
  brand_color?: string
  social_facebook?: string
  social_instagram?: string
  social_tiktok?: string
  press_email?: string
  partnerships_email?: string
  catering_email?: string
  careers_email?: string
  google_analytics_measurement_id?: string
  google_site_verification?: string
  default_timezone?: string
}

export const getConfig = async (
  db: DbClient,
  organizationId: string,
  siteId: string
): Promise<SiteConfig> => {
  const row = await queryFirst<Record<keyof SiteConfig, unknown>>(db, `
    SELECT json_extract(settings_json, '$.config.brand_color') AS brand_color,
           json_extract(settings_json, '$.config.press_email') AS press_email,
           json_extract(settings_json, '$.config.partnerships_email') AS partnerships_email,
           json_extract(settings_json, '$.config.catering_email') AS catering_email,
           json_extract(settings_json, '$.config.careers_email') AS careers_email,
           CASE WHEN json_extract(integrations_json, '$.google.status') = 'active' THEN json_extract(integrations_json, '$.google.ga4_measurement_id') END AS google_analytics_measurement_id,
           json_extract(settings_json, '$.config.google_site_verification') AS google_site_verification,
           json_extract(settings_json, '$.config.default_timezone') AS default_timezone,
           social_facebook_url AS social_facebook,
           social_instagram_url AS social_instagram,
           social_tiktok_url AS social_tiktok
      FROM sites WHERE organization_id = ? AND id = ?
  `, [organizationId, siteId])
  if (!row) throw new HTTPError({ statusCode: 404, statusMessage: 'Site not found' })
  const config: SiteConfig = {}
  for (const key of ["brand_color","press_email","partnerships_email","catering_email","careers_email","google_analytics_measurement_id","google_site_verification","default_timezone","social_facebook","social_instagram","social_tiktok"] as const) {
    const value = row[key]
    if (value == null) continue
    if (typeof value !== 'string') throw new Error('Invalid stored site setting: ' + key)
    config[key] = value
  }
  return config
}

export const resolveLocationTimezone = async (
  db: DbClient,
  organizationId: string,
  siteId: string,
  locationId: string | null,
): Promise<string> => {
  const location = await queryFirst<{ timezone: string | null }>(db,
    'SELECT timezone FROM business_locations WHERE id = ? AND organization_id = ? AND site_id = ?',
    [locationId, organizationId, siteId])
  if (!location?.timezone) throw new HTTPError({ statusCode: 409, statusMessage: 'Set the location timezone before offering bookings' })
  return location.timezone
}

/**
 * Returns true if `dateStr` (YYYY-MM-DD) is strictly before "today" as observed in `timezone`.
 * Workers always run on a UTC clock, so "today" must be computed in the venue's zone rather
 * than compared against `new Date()` directly — otherwise bookings/reservations near midnight
 * are wrongly accepted/rejected for venues whose local day hasn't rolled over yet (or already has).
 */
export const isDateBeforeTimezoneToday = (dateStr: string, timezone: string): boolean => {
  const todayInZone = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return dateStr < todayInZone
}

/**
 * Returns true if `dateStr` + `timeStr` ("HH:MM") is at or before the current moment as observed
 * in `timezone`. Used to strip/reject same-day slots whose start time has already passed — a slot
 * list built only from opening_hours (see shared/reservation-hours.ts generateReservationTimes)
 * still includes every slot for today regardless of the current wall-clock time, so this is the
 * second, orthogonal check needed to keep "today" from showing/accepting already-passed times.
 */
export const isTimeSlotInPast = (dateStr: string, timeStr: string, timezone: string, now: Date = new Date()): boolean => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
  const nowDateStr = `${get('year')}-${get('month')}-${get('day')}`
  const nowTimeStr = `${get('hour')}:${get('minute')}`
  if (dateStr !== nowDateStr) return dateStr < nowDateStr
  return timeStr <= nowTimeStr
}

export const setConfig = async (
  db: DbClient,
  organizationId: string,
  siteId: string,
  key: keyof SiteConfig,
  value: string
) => {
  if (key === 'google_analytics_measurement_id') {
    const current = await queryFirst<{ kind: string | null; measurement_id: string | null; revision: string | null }>(db, `
      SELECT json_extract(integrations_json, '$.google.kind') AS kind,
             json_extract(integrations_json, '$.google.ga4_measurement_id') AS measurement_id,
             json_extract(integrations_json, '$.google.revision') AS revision
        FROM sites WHERE organization_id = ? AND id = ?
    `, [organizationId, siteId])
    if (!current) throw new HTTPError({ statusCode: 404, statusMessage: 'Site not found' })
    if (current.kind === 'oauth') {
      if ((current.measurement_id ?? '') === value) return
      throw new HTTPError({ statusCode: 409, statusMessage: 'Disconnect Google Analytics before setting a manual measurement ID' })
    }
    const result = await execute(db, `
      UPDATE sites SET integrations_json = json_set(integrations_json, '$.google',
        json_object('kind', 'manual', 'status', ?, 'ga4_measurement_id', ?, 'revision', ?,
          'updated_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
      WHERE organization_id = ? AND id = ? AND json_extract(integrations_json, '$.google.revision') IS ?
    `, [value ? 'active' : 'disabled', value || null, crypto.randomUUID(), organizationId, siteId, current.revision])
    if (result.meta?.changes !== 1) throw new HTTPError({ statusCode: 409, statusMessage: 'Google Analytics settings changed. Reload before saving.' })
    return
  }
  const result = await execute(
    db,
    `UPDATE sites SET settings_json = json_set(settings_json, ?, ?),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE organization_id = ? AND id = ?`,
    ['$.config.' + key, value, organizationId, siteId],
  )
  if (result.meta?.changes !== 1) throw new HTTPError({ statusCode: 409, statusMessage: 'Site ownership changed. Reload before saving.' })
}

export const deleteConfig = async (
  db: DbClient,
  organizationId: string,
  siteId: string,
  key: keyof SiteConfig
) => {
  if (key === 'google_analytics_measurement_id') return setConfig(db, organizationId, siteId, key, '')
  const result = await execute(
    db,
    `UPDATE sites SET settings_json = json_remove(settings_json, ?),
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE organization_id = ? AND id = ?`,
    ['$.config.' + key, organizationId, siteId],
  )
  if (result.meta?.changes !== 1) throw new HTTPError({ statusCode: 409, statusMessage: 'Site ownership changed. Reload before saving.' })
}
