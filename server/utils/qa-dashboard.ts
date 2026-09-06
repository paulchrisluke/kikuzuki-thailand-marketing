import { queryAll, type DbClient } from '~/server/db'
import { listQa } from '~/server/utils/location-qa'

export async function getTenantPages(db: DbClient, siteId: string): Promise<Array<{ path: string; title: string }>> {
  const rows = await queryAll<{ path: string; title: string }>(db,
    `SELECT v.path AS path, v.title
     FROM content_documents v
     WHERE v.kind = 'page' AND v.row_role = 'root' AND v.site_id = ?
     ORDER BY v.title ASC`,
    [siteId],
  )
  return rows ?? []
}

export async function getQaScopes(db: DbClient, siteId: string): Promise<Array<{ page_path: string | null }>> {
  const rows = await queryAll<{ page_path: string | null }>(db,
    `SELECT DISTINCT scope_path AS page_path
     FROM content_documents
     WHERE kind = 'qa' AND row_role = 'root' AND site_id = ? AND location_id IS NULL
     ORDER BY page_path ASC`,
    [siteId],
  )
  return rows ?? []
}

export async function getSiteQa(
  db: DbClient,
  siteId: string,
  pagePath: string | null,
): Promise<Array<{
  id: string
  question: string
  answer: string | null
  status: 'published' | 'hidden'
  sort_order: number
  page_path: string | null
}>> {
  const rows = await listQa(db, siteId, null, false, pagePath)
  return rows.map(({ id, question, answer, status, sort_order, page_path }) => ({ id, question, answer, status, sort_order, page_path }))
}
