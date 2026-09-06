import { getQuery } from 'nitro/h3';
import { queryAll, queryFirst } from '~/server/db'
import { jsonResponse } from '~/server/utils/api-response'
import { getNotificationAccess } from '~/server/utils/notification-access'

interface NotificationRow {
  id: string
  scope: 'platform' | 'organization' | 'site'
  template: string
  severity: 'info' | 'success' | 'warning' | 'error'
  organization_id: string | null
  site_id: string | null
  location_id: string | null
  target_user_id: string | null
  title: string | null
  message: string | null
  deep_link: string | null
  created_at: string
  read_at: string | null
}

export default defineHandler(async (event) => {
  const access = await getNotificationAccess(event)
  const rawLimit = Number(getQuery(event).limit ?? 20)
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, Math.trunc(rawLimit))) : 20

  const [rows, count] = await Promise.all([
    queryAll<NotificationRow>(access.db, `
      SELECT n.id, json_extract(n.payload_json, '$.visibility_scope') AS scope, n.event_name AS template, json_extract(n.payload_json, '$.severity') AS severity, n.organization_id, n.context_site_id AS site_id, n.location_id, n.target_user_id, json_extract(n.payload_json, '$.title') AS title, n.body AS message, json_extract(n.payload_json, '$.deep_link') AS deep_link, n.created_at, nr.read_at
      FROM activity_entries n
      LEFT JOIN (SELECT parent_id, MAX(occurred_at) AS read_at FROM activity_entries WHERE kind = 'acknowledgement' AND actor_user_id = ? GROUP BY parent_id) nr ON nr.parent_id = n.id
      WHERE ${access.whereSql}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ?
    `, [access.userId, ...access.whereParams, limit]), queryFirst<{ count: number }>(access.db, `
      SELECT COUNT(*) AS count
      FROM activity_entries n
      LEFT JOIN (SELECT parent_id, MAX(occurred_at) AS read_at FROM activity_entries WHERE kind = 'acknowledgement' AND actor_user_id = ? GROUP BY parent_id) nr ON nr.parent_id = n.id
      WHERE ${access.whereSql} AND nr.read_at IS NULL
    `, [access.userId, ...access.whereParams]), ])

  return jsonResponse({
    notifications: rows, unread_count: Number(count?.count ?? 0), })
})
import { defineHandler } from 'nitro';
