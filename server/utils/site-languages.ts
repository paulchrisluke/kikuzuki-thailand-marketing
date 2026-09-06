import { execute, executeBatch, queryAll, queryFirst, type DbClient } from '~/server/db'
import { getOrganizationBillingStatus } from '~/server/utils/billing'
import type { CloudflareEnv } from '~/server/utils/auth'
import { canonicalizeLocale, englishManifestHash } from '~/server/utils/localization'
import { localizationError } from '~/server/utils/localization-errors'

interface SiteLanguageRow {
  id: string
  locale: string
  status: 'published' | 'disabled' | 'draft'
  activated_at: string | null
  disabled_at: string | null
}

async function loadLanguage(db: DbClient, organizationId: string, siteId: string, locale: string) {
  return await queryFirst<SiteLanguageRow>(db, `
    SELECT id, locale, status, activated_at, disabled_at FROM site_locales
     WHERE organization_id = ? AND site_id = ? AND locale = ?
  `, [organizationId, siteId, locale])
}

export async function enableSiteLanguage(
  db: DbClient, env: CloudflareEnv,
  input: { organizationId: string; siteId: string; locale: unknown; label: string },
) {
  const locale = canonicalizeLocale(input.locale)
  if (locale === 'en') localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'English is the immutable source language')
  const catalog = await queryFirst<{ status: string; source_manifest_hash: string | null }>(db, `
    SELECT status, metadata_json ->> '$.source_manifest_hash' AS source_manifest_hash
      FROM content_documents WHERE kind = 'locale_catalog' AND row_role = 'catalog'
       AND metadata_json ->> '$.locale' = ?
  `, [locale])
  if (!catalog || catalog.status !== 'available' || catalog.source_manifest_hash !== await englishManifestHash()) {
    localizationError(403, 'PLATFORM_LOCALE_UNAVAILABLE', 'The platform locale catalog is unavailable', { locale })
  }
  const projection = await getOrganizationBillingStatus(env, db, input.organizationId)
  if (projection.plan !== 'growth' || !projection.stripeSubscriptionId) {
    localizationError(402, 'LANGUAGE_LICENSE_REQUIRED', 'An active Growth subscription is required to enable a language')
  }
  const now = new Date().toISOString()
  const result = await execute(db, `
    INSERT INTO site_locales (id, organization_id, site_id, locale, label, is_source, status, activated_at, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, 0, 'published', ?, ?, ?
     WHERE NOT EXISTS (SELECT 1 FROM site_locales WHERE organization_id = ? AND site_id = ? AND is_source = 0 AND status = 'published' AND locale <> ?)
    ON CONFLICT(organization_id, site_id, locale) DO UPDATE SET label = excluded.label, status = 'published',
      activated_at = COALESCE(site_locales.activated_at, excluded.activated_at), disabled_at = NULL, updated_at = excluded.updated_at
  `, [`locale::${input.organizationId}::${input.siteId}::${locale}`, input.organizationId, input.siteId, locale, input.label.trim() || locale, now, now, now, input.organizationId, input.siteId, locale])
  if (result.meta?.changes !== 1) localizationError(409, 'LANGUAGE_LICENSE_REQUIRED', 'Growth includes one secondary language per site. Disable the current language before enabling another.')
  return await loadLanguage(db, input.organizationId, input.siteId, locale)
}

export async function disableSiteLanguage(
  db: DbClient,
  input: { organizationId: string; siteId: string; locale: unknown },
) {
  const locale = canonicalizeLocale(input.locale)
  if (locale === 'en') localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'English cannot be disabled')
  const now = new Date().toISOString()
  await execute(db, `UPDATE site_locales SET status = 'disabled', disabled_at = COALESCE(disabled_at, ?), updated_at = ?
    WHERE organization_id = ? AND site_id = ? AND locale = ? AND is_source = 0`, [now, now, input.organizationId, input.siteId, locale])
  return await loadLanguage(db, input.organizationId, input.siteId, locale)
}

export async function deleteDisabledSiteLanguageContent(
  db: DbClient,
  input: { organizationId: string; siteId: string; locale: unknown },
): Promise<{ deleted: true; locale: string }> {
  const locale = canonicalizeLocale(input.locale)
  if (locale === 'en') localizationError(422, 'LOCALIZATION_VALIDATION_FAILED', 'English source content cannot be deleted')
  const language = await loadLanguage(db, input.organizationId, input.siteId, locale)
  if (language && language.status !== 'disabled') localizationError(409, 'LANGUAGE_LICENSE_SYNCING', 'Disable the language before permanently deleting its content', { locale })
  const documents = await queryFirst<{ ids: string | null }>(db, `
    SELECT json_group_array(document_id) AS ids
      FROM (
        SELECT document_id FROM resource_localizations
         WHERE organization_id = ? AND site_id = ? AND locale = ? AND document_id IS NOT NULL
        UNION
        SELECT document_id FROM tenant_page_variants
         WHERE organization_id = ? AND site_id = ? AND locale = ? AND document_id IS NOT NULL
      )
  `, [input.organizationId, input.siteId, locale, input.organizationId, input.siteId, locale])
  const documentIds = documents?.ids ? JSON.parse(documents.ids) as string[] : []
  const statements = [
    { query: `DELETE FROM site_redirects WHERE organization_id = ? AND site_id = ? AND locale = ?`, params: [input.organizationId, input.siteId, locale] },
    { query: `DELETE FROM media_placements WHERE owner_type = 'tenant_page' AND owner_id IN (SELECT id FROM tenant_page_variants WHERE organization_id = ? AND site_id = ? AND locale = ?)`, params: [input.organizationId, input.siteId, locale] },
    { query: `DELETE FROM media_placements WHERE owner_type = 'content_block' AND owner_id IN (SELECT id FROM content_blocks WHERE document_id IN (SELECT value FROM json_each(?)))`, params: [JSON.stringify(documentIds)] },
    { query: `DELETE FROM resource_localizations WHERE organization_id = ? AND site_id = ? AND locale = ?`, params: [input.organizationId, input.siteId, locale] },
    { query: `DELETE FROM tenant_page_variants WHERE organization_id = ? AND site_id = ? AND locale = ?`, params: [input.organizationId, input.siteId, locale] },
    ...documentIds.map(documentId => ({ query: `DELETE FROM content_documents WHERE id = ?`, params: [documentId] })),
    { query: `DELETE FROM site_locales WHERE organization_id = ? AND site_id = ? AND locale = ? AND is_source = 0`, params: [input.organizationId, input.siteId, locale] },
  ]
  await executeBatch(db, statements, { operation: 'delete disabled language content' })
  return { deleted: true, locale }
}


export async function getSiteLanguageSettings(
  db: DbClient, env: CloudflareEnv,
  input: { organizationId: string; siteId: string },
) {
  const projection = await getOrganizationBillingStatus(env, db, input.organizationId)
  const currentHash = await englishManifestHash()
  const languages = await queryAll(db, `
    SELECT sl.locale, sl.label, sl.is_source, sl.status,
           c.status AS catalog_status,
           CASE WHEN c.metadata_json ->> '$.source_manifest_hash' = ? THEN 1 ELSE 0 END AS catalog_current
      FROM site_locales sl
      LEFT JOIN content_documents c ON c.kind = 'locale_catalog' AND c.row_role = 'catalog' AND c.metadata_json ->> '$.locale' = sl.locale
     WHERE sl.organization_id = ? AND sl.site_id = ?
  `, [currentHash, input.organizationId, input.siteId])
  const availableCatalogs = await queryAll(db, `
    SELECT metadata_json ->> '$.locale' AS locale, metadata_json ->> '$.label' AS label, metadata_json ->> '$.direction' AS direction
      FROM content_documents WHERE kind = 'locale_catalog' AND row_role = 'catalog'
       AND status = 'available' AND metadata_json ->> '$.source_manifest_hash' = ?
     ORDER BY locale
  `, [currentHash])
  return { effective_plan: projection.plan, languages, available_catalogs: availableCatalogs }
}
