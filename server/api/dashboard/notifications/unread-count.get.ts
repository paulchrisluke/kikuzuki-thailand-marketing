import { queryFirst } from '~/server/db'
import { jsonResponse } from '~/server/utils/api-response'
import { getNotificationAccess } from '~/server/utils/notification-access'

export default defineHandler(async (event) => {
  const access = await getNotificationAccess(event)
  const row = await queryFirst<{ count: number }>(access.db, `
    SELECT COUNT(*) AS count
    FROM activity_entries n
    LEFT JOIN (SELECT parent_id, MAX(occurred_at) AS read_at FROM activity_entries WHERE kind = 'acknowledgement' AND actor_user_id = ? GROUP BY parent_id) nr ON nr.parent_id = n.id
    WHERE ${access.whereSql} AND nr.read_at IS NULL
  `, [access.userId, ...access.whereParams])

  return jsonResponse({ unread_count: Number(row?.count ?? 0) })
})
import { defineHandler } from 'nitro';
