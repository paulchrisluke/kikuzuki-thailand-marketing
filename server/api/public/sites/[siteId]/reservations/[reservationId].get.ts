import { queryFirst } from '~/server/db'
import { cloudflareEnv, jsonResponse } from '~/server/utils/api-response'
import { hashReservationCancelToken, readBearerToken } from '~/server/utils/reservation-cancel-token'

export default defineHandler(async (event) => {
  const siteId = getRouterParam(event, 'siteId')
  const reservationId = getRouterParam(event, 'reservationId')
  const token = readBearerToken((event.req.headers.get('authorization')))

  if (!siteId || !reservationId || !token) {
    return jsonResponse({ error: 'Missing required parameters' }, { status: 400 })
  }

  const env = cloudflareEnv(event)
  const db = env.db
  if (!db) return jsonResponse({ error: 'Database not available' }, { status: 500 })

  const tokenHash = await hashReservationCancelToken(token)
  const reservation = await queryFirst(
    db, `
    SELECT json_extract(payload_json, '$.guest.name') AS name, booking_date AS date, time_slot AS time, CAST(party_size AS TEXT) || CASE json_extract(payload_json, '$.party_size_is_minimum') WHEN 1 THEN '+' ELSE '' END AS guests, status, location_id
    FROM requests
    WHERE kind = 'reservation' AND id = ?
      AND site_id = ?
      AND json_extract(payload_json, '$.cancellation.token_hash') = ?
      AND json_extract(payload_json, '$.cancellation.used_at') IS NULL
      AND json_extract(payload_json, '$.cancellation.expires_at') > ?
    LIMIT 1
  `, [reservationId, siteId, tokenHash, new Date().toISOString()], )

  if (!reservation) {
    return jsonResponse({ error: 'Reservation not found' }, { status: 404 })
  }

  return jsonResponse({
    success: true, reservation
  })
})
import { defineHandler } from 'nitro';
import { getHeader } from 'nitro/h3';
import { getRouterParam } from 'nitro/h3';
