#!/usr/bin/env node
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnYarn } from './utils/spawn-yarn.mjs'

export const CONTENT_DOCUMENT_SCOPE_QUERY = `
  SELECT d.id, p.organization_id, p.site_id FROM content_documents d
    JOIN blog_posts p ON p.id = d.owner_id
    JOIN sites s ON s.id = p.site_id AND s.organization_id = p.organization_id
   WHERE d.site_id = p.site_id AND d.owner_type = CASE WHEN p.site_id = 'platform' THEN 'platform_blog' ELSE 'tenant_blog' END
  UNION ALL
  SELECT d.id, 'platform', 'platform' FROM content_documents d
    JOIN platform_docs p ON p.id = d.owner_id
    JOIN sites s ON s.id = 'platform' AND s.organization_id = 'platform'
   WHERE d.owner_type = 'platform_doc' AND d.site_id = 'platform'
  UNION ALL
  SELECT d.id, v.organization_id, v.site_id FROM content_documents d
    JOIN tenant_page_variants v ON v.id = d.owner_id AND v.document_id = d.id AND v.site_id = d.site_id
    JOIN tenant_pages p ON p.id = v.page_id AND p.site_id = v.site_id AND p.organization_id = v.organization_id
    JOIN site_locales l ON l.site_id = v.site_id AND l.organization_id = v.organization_id AND l.locale = v.locale
   WHERE d.owner_type = 'tenant_page'
  UNION ALL
  SELECT d.id, r.organization_id, r.site_id FROM content_documents d
    JOIN resource_localizations r ON r.id = d.owner_id AND r.document_id = d.id AND r.site_id = d.site_id
    JOIN blog_posts p ON p.id = r.resource_id AND p.site_id = r.site_id AND p.organization_id = r.organization_id
   WHERE d.owner_type = 'resource_localization' AND r.resource_type = 'tenant_blog_post'
`

const OWNER_TABLES = {
  site: 'sites', business_location: 'business_locations', product: 'products', post: 'posts',
  blog_post: 'blog_posts', experience: 'experiences', offering: 'offerings',
  review: 'reviews', review_request: 'review_requests', tenant_compliance: 'tenant_compliance',
  tenant_page: 'tenant_page_variants',
}

export const MEDIA_PLACEMENT_OWNER_AUDIT_QUERY = `WITH document_scope AS (${CONTENT_DOCUMENT_SCOPE_QUERY})
  SELECT mp.owner_type, COUNT(*) AS orphaned_count FROM media_placements mp
   WHERE NOT (
     ${Object.entries(OWNER_TABLES).map(([ownerType, table]) => `(mp.owner_type = '${ownerType}' AND EXISTS (SELECT 1 FROM ${table} o WHERE o.id = mp.owner_id AND o.organization_id = mp.organization_id AND ${ownerType === 'site' ? 'o.id' : 'o.site_id'} = mp.site_id))`).join(' OR ')}
     OR (mp.owner_type = 'content_block' AND EXISTS (SELECT 1 FROM content_blocks b JOIN document_scope d ON d.id = b.document_id WHERE b.id = mp.owner_id AND d.organization_id = mp.organization_id AND d.site_id = mp.site_id))
     OR (mp.owner_type = 'platform_doc' AND mp.organization_id = 'platform' AND mp.site_id = 'platform' AND EXISTS (SELECT 1 FROM platform_docs p WHERE p.id = mp.owner_id))
   ) GROUP BY mp.owner_type ORDER BY mp.owner_type
`

function main() {
  const targets = process.argv.slice(2)
  let failed = false
  for (const target of targets.length ? targets : ['local']) {
    if (!['local', 'preview', 'staging', 'production'].includes(target)) throw new Error(`Unsupported environment: ${target}`)
    const args = ['wrangler', 'd1', 'execute', 'DB']
    if (target === 'local') args.push('--local')
    else { if (target !== 'production') args.push('--env', target); args.push('--remote') }
    const result = spawnYarn([...args, '--command', MEDIA_PLACEMENT_OWNER_AUDIT_QUERY, '--json'], { encoding: 'utf8' })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error((result.stderr || result.stdout || `Wrangler exited ${result.status}`).trim())
    const records = JSON.parse(result.stdout)[0]?.results ?? []
    if (records.length === 0) { console.log(`ok  ${target}: every media placement has an owner in the same scope`); continue }
    failed = true
    for (const row of records) console.error(`not ok  ${target}: ${row.orphaned_count} missing or out-of-scope owners for ${row.owner_type}`)
  }
  if (failed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
