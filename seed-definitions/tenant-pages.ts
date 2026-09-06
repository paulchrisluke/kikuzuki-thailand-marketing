export interface SeedTenantPageRow {
  id: string
  page: string
  field: string
  content: string | null
  heroTitle?: string | null
  heroSubtitle?: string | null
  media: Array<{ asset_id: string; slot: 'media' | 'gallery' }>
}

export interface SeedTenantPageLocaleField {
  locale: string
  page: string
  field: string
  content: string | null
  value?: string | null
  heroTitle?: string | null
  heroSubtitle?: string | null
  status: 'published' | 'stale'
}

interface SeedTenantPageLocale {
  locale: string
  status: 'published' | 'disabled'
}

type SqlValue = (_value: string | number | boolean | null) => string
type SqlJson = (_value: unknown) => string

function pathForPage(page: string) {
  if (page === 'home') return '/'
  if (page === 'privacy') return '/policies/privacy'
  if (page === 'terms') return '/policies/terms'
  return `/${page}`
}

function pageTypeForPage(page: string) {
  if (page === 'home' || page === 'about' || page === 'contact') return 'system'
  if (page === 'privacy' || page === 'terms') return 'legal'
  return 'recipe'
}

function blockData(page: string, rows: SeedTenantPageRow[]) {
  const blocks: Array<{ id: string; type: string; position: number; data: Record<string, unknown>; media: Array<{ asset_id: string; slot: string }> }> = []
  const hero = rows.find(row => row.field === 'hero')
  if (hero) {
    blocks.push({
      id: `${hero.id}-block-hero`,
      type: 'hero',
      position: 0,
      data: {
        title: hero.heroTitle ?? hero.content,
        subtitle: hero.heroSubtitle ?? null,
      },
      media: hero.media,
    })
  }

  const cta = rows.filter(row => row.field.startsWith('cta.'))
  if (cta.length) {
    blocks.push({
      id: `${cta[0]!.id}-block-cta`,
      type: 'cta',
      position: blocks.length,
      data: {
        title: cta.find(row => row.field === 'cta.title')?.content ?? null,
        description: cta.find(row => row.field === 'cta.description')?.content ?? null,
        label: cta.find(row => row.field === 'cta.label')?.content ?? null,
        url: cta.find(row => row.field === 'cta.url')?.content ?? null,
      },
      media: [],
    })
  }

  for (const row of rows) {
    if (row.field === 'hero' || row.field.startsWith('cta.')) continue
    if (row.media.length) {
      blocks.push({ id: `${row.id}-block-image`, type: 'image', position: blocks.length, data: { alt: row.field, field: row.field }, media: row.media })
      continue
    }
    if (!row.content?.trim()) continue
    const isHeading = row.field.endsWith('.title') || row.field.endsWith('.headline') || row.field.endsWith('.kicker')
    blocks.push({
      id: `${row.id}-block-content`,
      type: isHeading ? 'heading' : 'markdown',
      position: blocks.length,
      data: isHeading ? { text: row.content, level: 2, field: row.field } : { markdown: row.content, field: row.field },
      media: [],
    })
  }
  if (!blocks.length) blocks.push({ id: `${page}-empty-page-hero`, type: 'hero', position: 0, data: { title: 'Page', subtitle: null }, media: [] })
  return blocks
}

function renderPage(
  siteId: string,
  organizationId: string,
  page: string,
  locale: string,
  rows: SeedTenantPageRow[],
  sqlValue: SqlValue,
  sqlJson: SqlJson,
  pathOverride?: string,
  titleOverride?: string,
) {
  const path = pathOverride ?? pathForPage(page)
  const pageKey = path.replaceAll('/', '-').replace(/^-/, '') || 'home'
  const pageId = `tenant-page-${siteId}-${pageKey}`
  const variantId = `${pageId}-${locale}`
  const documentId = locale === 'en' ? pageId : `${variantId}-document`
  const blocks = blockData(page, rows).map(block => ({ ...block, id: `${variantId}-${block.id}` }))
  const hero = rows.find(row => row.field === 'hero')
  const title = titleOverride ?? hero?.heroTitle ?? hero?.content ?? (page === 'home' ? 'Home' : page[0]!.toUpperCase() + page.slice(1))
  const blockSql = blocks.map(block => `INSERT OR REPLACE INTO content_blocks (id, document_id, parent_block_id, type, position, level, data_json, created_at, updated_at) VALUES (${sqlValue(block.id)}, ${sqlValue(documentId)}, NULL, ${sqlValue(block.type)}, ${block.position}, ${block.type === 'heading' ? 2 : 'NULL'}, ${sqlJson(block.data)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`).join('\n')
  const placementSql = blocks.flatMap(block => block.media.map((media, index) => `INSERT INTO media_placements (id, organization_id, site_id, owner_type, owner_id, slot, asset_id, sort_order, status, created_at, updated_at) VALUES (${sqlValue(`${block.id}-${media.slot}-${index}`)}, ${sqlValue(organizationId)}, ${sqlValue(siteId)}, 'content_block', ${sqlValue(block.id)}, ${sqlValue(media.slot)}, ${sqlValue(media.asset_id)}, ${index}, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`)).join('\n')
  return `INSERT OR REPLACE INTO content_documents
  (id, organization_id, site_id, kind, row_role, root_id, root_role, locale, path, title, source, metadata_json)
VALUES (${sqlValue(documentId)}, ${sqlValue(organizationId)}, ${sqlValue(siteId)}, 'page', ${sqlValue(locale === 'en' ? 'root' : 'representation')}, ${sqlValue(locale === 'en' ? null : pageId)}, ${sqlValue(locale === 'en' ? null : 'root')}, ${sqlValue(locale)}, ${sqlValue(path)}, ${sqlValue(title)}, ${sqlValue(locale === 'en' ? 'fixture' : null)}, ${sqlJson({ page_type: pageTypeForPage(page), recipe: page })});
DELETE FROM media_placements WHERE owner_type = 'content_block' AND owner_id IN (SELECT id FROM content_blocks WHERE document_id = ${sqlValue(documentId)});
DELETE FROM content_blocks WHERE document_id = ${sqlValue(documentId)};
${blockSql}
${placementSql}`
}

export function renderTenantPagesSeedSql(input: {
  siteId: string
  organizationId: string
  sourceLocale: string
  locales: SeedTenantPageLocale[]
  rows: SeedTenantPageRow[]
  localeFields?: SeedTenantPageLocaleField[]
  pages?: string[]
  additionalPages?: Array<{ page: string; path: string; title: string }>
  sqlValue: SqlValue
  sqlJson: SqlJson
}) {
  if (input.sourceLocale !== 'en') throw new Error('Canonical seed source locale must be English')
  const sourceLocale = input.locales.find(locale => locale.locale === input.sourceLocale)
  if (!sourceLocale) {
    throw new Error(`Source locale "${input.sourceLocale}" is not configured for this site`)
  }
  if (sourceLocale.status !== 'published') {
    throw new Error(`Source locale "${input.sourceLocale}" must be published`)
  }
  const pages = Array.from(new Set([...input.rows.map(row => row.page), ...(input.pages ?? []), 'home', 'about', 'contact']))
  const chunks: string[] = []
  const configuredLocales = [...input.locales].sort((a, b) => Number(b.locale === 'en') - Number(a.locale === 'en'))
  for (const locale of configuredLocales) {
    for (const page of pages) {
      const sourceRows = input.rows.filter(row => row.page === page)
      const localizedRows = locale.locale === input.sourceLocale
        ? sourceRows
        : sourceRows.flatMap(row => {
            const localized = input.localeFields?.find(item =>
              item.locale === locale.locale &&
              item.page === page &&
              item.field === row.field &&
              item.status === 'published',
            )
            if (!localized) return []
            const hasLocalizedValue = [localized.content, localized.value, localized.heroTitle, localized.heroSubtitle]
              .some(value => value !== undefined && value !== null)
            if (!hasLocalizedValue) return []
            return [{
              ...row,
              content: localized.content ?? localized.value ?? null,
              heroTitle: localized.heroTitle ?? null,
              heroSubtitle: localized.heroSubtitle ?? null,
            }]
          })
      if (locale.locale !== input.sourceLocale && localizedRows.length === 0) continue
      chunks.push(renderPage(
        input.siteId,
        input.organizationId,
        page,
        locale.locale,
        localizedRows,
        input.sqlValue,
        input.sqlJson,
      ))
    }
  }
  for (const locale of configuredLocales) {
    for (const page of input.additionalPages ?? []) {
      if (locale.locale !== input.sourceLocale) continue
      chunks.push(renderPage(
        input.siteId,
        input.organizationId,
        page.page,
        locale.locale,
        [],
        input.sqlValue,
        input.sqlJson,
        page.path,
        page.title,
      ))
    }
  }
  return `-- BEGIN GENERATED: tenant_pages\n${chunks.join('\n')}\n-- END GENERATED: tenant_pages`
}
