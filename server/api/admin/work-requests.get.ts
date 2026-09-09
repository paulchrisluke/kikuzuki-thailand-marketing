// GET /api/admin/work-requests — platform admin views all work requests
import { cloudflareEnv, jsonResponse } from "~/server/utils/api-response";
import { queryAll } from "~/server/db";
import { platformPermissionJsonResponse } from "~/server/utils/platform-admin-users";
import { findOrganizationById } from '~/server/utils/member-access'

export default defineHandler(async (event) => {
  const env = cloudflareEnv(event);
  const db = env.DB;
  if (!db)
    return jsonResponse({ error: "Database not available" }, { status: 500 });

  const permissionDenied = await platformPermissionJsonResponse(event, env, { platform: ["support"] });
  if (permissionDenied) return permissionDenied;

  const query = getQuery(event);
  const statusFilter = query.status ? String(query.status) : null;
  const showDone = query.done === "1";
  const requestId = query.id ? String(query.id) : null;

  const rows = await queryAll<ApiRecord>(db, `
    SELECT
      wr.id, json_extract(wr.payload_json, '$.type') AS type, json_extract(wr.payload_json, '$.title') AS title, json_extract(wr.payload_json, '$.description') AS description, wr.status, wr.priority, json_extract(wr.payload_json, '$.source') AS source, json_extract(wr.payload_json, '$.notes') AS notes, wr.assigned_to, wr.created_at, wr.updated_at, json_extract(wr.payload_json, '$.completed_at') AS completed_at, wr.organization_id, s.brand_name
    FROM requests wr
    LEFT JOIN sites s ON s.id = wr.site_id
    WHERE wr.kind = 'work' AND (? IS NULL OR wr.id = ?)
    AND (? IS NULL OR wr.status = ?)
    AND (? = 1 OR wr.status != 'done' OR wr.id = ?)
    ORDER BY
      CASE wr.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, CASE wr.status WHEN 'in_progress' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, wr.created_at DESC
    LIMIT 200
  `, [requestId, requestId, statusFilter, statusFilter, showDone ? 1 : 0, requestId]);

  const organizationIds = [...new Set((rows ?? []).map(row => String(row.organization_id)))]
  const organizations = new Map<string, Awaited<ReturnType<typeof findOrganizationById>>>(
    await Promise.all(organizationIds.map(async organizationId =>
      [organizationId, await findOrganizationById(env, organizationId)] as const,
    )),
  )
  return jsonResponse({ requests: (rows ?? []).map((row) => {
    const organization = organizations.get(String(row.organization_id))
    const { organization_id: _organizationId, ...request } = row
    return { ...request, org_name: organization?.name ?? null, org_slug: organization?.slug ?? null }
  }) });
});
import { defineHandler } from 'nitro';
import { getQuery } from 'nitro/h3';
