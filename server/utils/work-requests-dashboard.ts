import { queryAll, type DbClient } from '~/server/db'

export interface WorkRequest {
  id: string
  type: string
  title: string
  status: string
  notes: string | null
  created_at: string
}

export async function listWorkRequests(db: DbClient, organizationId: string): Promise<WorkRequest[]> {
  return await queryAll<WorkRequest>(db,
    `SELECT id, json_extract(payload_json, '$.type') AS type, json_extract(payload_json, '$.title') AS title, status, json_extract(payload_json, '$.notes') AS notes, created_at
     FROM requests
     WHERE kind = 'work' AND organization_id = ?
     ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
       CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
       created_at DESC
     LIMIT 100`,
    [organizationId],
  )
}
