import { CATEGORY_SLUGS, slugToCategory } from '~/utils/docs-categories'
import { isRecord, publicApiRequest } from '~/utils/api-clients'

/**
 * Documentation is the KrabiClaw site's ordinary `page` documents whose path
 * starts with /docs. The category is the first path segment after /docs; a page
 * at exactly /docs/{category} is that category's landing page. Order within a
 * category is the page's sort_order.
 */
export interface DocsPage {
  id: string
  path: string
  title: string
  summary: string | null
  sortOrder: number
  categorySlug: string
  category: string
  isCategoryIndex: boolean
}

export interface DocsCategory {
  category: string
  categorySlug: string
  pages: DocsPage[]
}

interface PageRow { id: string; path: string; title: string; summary: string | null; sort_order: number }

const isPageRow = (value: unknown): value is PageRow =>
  isRecord(value) && typeof value.id === 'string' && typeof value.path === 'string' && typeof value.title === 'string'
  && (value.summary === null || typeof value.summary === 'string') && typeof value.sort_order === 'number'

function toDocsPage(row: PageRow): DocsPage | null {
  const [, root, categorySlug, ...rest] = row.path.split('/')
  if (root !== 'docs' || !categorySlug) return null
  const category = slugToCategory(categorySlug)
  if (!category) return null
  return {
    id: row.id, path: row.path, title: row.title, summary: row.summary, sortOrder: row.sort_order,
    categorySlug, category, isCategoryIndex: rest.length === 0,
  }
}

export async function useDocsPages() {
  const { siteId } = useTenantSite()
  const requestEvent = useRequestEvent()
  const asyncData = useAsyncData<{ pages: PageRow[] }>('docs-pages', async () => {
    if (!siteId) throw createError({ statusCode: 500, statusMessage: 'Documentation requires the current site' })
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const [{ cloudflareEnv }, { listPublishedTenantPagePaths }] = await Promise.all([
        import('~/server/utils/api-response'),
        import('~/server/utils/content/pages'),
      ])
      const db = cloudflareEnv(requestEvent).db
      if (!db) throw createError({ statusCode: 503, statusMessage: 'Documentation is temporarily unavailable' })
      return { pages: (await listPublishedTenantPagePaths(db, siteId, 'en')).filter(page => page.path.startsWith('/docs')) }
    }
    const response = await publicApiRequest<{ pages: PageRow[] }>(`/api/public/sites/${encodeURIComponent(siteId)}/pages`, {
      validate: (value): value is { pages: PageRow[] } => isRecord(value) && Array.isArray(value.pages) && value.pages.every(isPageRow),
    })
    return { pages: response.pages.filter(page => page.path.startsWith('/docs')) }
  })
  // Callers decide routing from the list, so the list must be loaded before they continue.
  await asyncData
  const { data, pending, error } = asyncData

  const categoryOrder = Object.values(CATEGORY_SLUGS)
  const pages = computed<DocsPage[]>(() => (data.value?.pages ?? [])
    .map(toDocsPage)
    .filter((page): page is DocsPage => page !== null)
    .sort((a, b) => categoryOrder.indexOf(a.categorySlug) - categoryOrder.indexOf(b.categorySlug)
      || Number(b.isCategoryIndex) - Number(a.isCategoryIndex)
      || a.sortOrder - b.sortOrder
      || a.path.localeCompare(b.path)))

  const categories = computed<DocsCategory[]>(() => categoryOrder.flatMap((categorySlug) => {
    const group = pages.value.filter(page => page.categorySlug === categorySlug)
    return group.length ? [{ category: group[0]!.category, categorySlug, pages: group }] : []
  }))

  return { pages, categories, pending, error }
}
