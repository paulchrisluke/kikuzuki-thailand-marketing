import { BLOG_CATEGORY_SLUGS } from '~/utils/blog-categories'
import { CATEGORY_SLUGS as DOCS_CATEGORY_SLUGS } from '~/utils/docs-categories'

/**
 * An article belongs to a collection. Every site has a blog; KrabiClaw's own
 * site (the platform template) also publishes documentation. Both collections
 * share the article model, editor, feeds and markdown routes; the collection
 * decides the URL prefix and the category list.
 */
export type ArticleCollection = 'blog' | 'docs'

export interface ArticleCollectionDefinition {
  slug: ArticleCollection
  label: string
  pathPrefix: string
  /** Category label -> URL segment. */
  categorySlugs: Record<string, string>
}

export const ARTICLE_COLLECTIONS: Record<ArticleCollection, ArticleCollectionDefinition> = {
  blog: { slug: 'blog', label: 'Blog', pathPrefix: '/blog', categorySlugs: BLOG_CATEGORY_SLUGS },
  docs: { slug: 'docs', label: 'Documentation', pathPrefix: '/docs', categorySlugs: DOCS_CATEGORY_SLUGS },
}

export const ARTICLE_COLLECTION_SLUGS = Object.keys(ARTICLE_COLLECTIONS) as ArticleCollection[]

export function isArticleCollection(value: unknown): value is ArticleCollection {
  return typeof value === 'string' && value in ARTICLE_COLLECTIONS
}

export function articleCollectionCategories(collection: ArticleCollection): string[] {
  return Object.keys(ARTICLE_COLLECTIONS[collection].categorySlugs)
}

export function articleCategoryToSlug(collection: ArticleCollection, category: string | null | undefined): string | null {
  if (!category) return null
  return ARTICLE_COLLECTIONS[collection].categorySlugs[category] ?? null
}

export function articleCategoryFromSlug(collection: ArticleCollection, categorySlug: string | null | undefined): string | null {
  if (!categorySlug) return null
  const match = Object.entries(ARTICLE_COLLECTIONS[collection].categorySlugs).find(([, slug]) => slug === categorySlug)
  return match?.[0] ?? null
}

/**
 * The public path of an article in a collection with category-shaped URLs:
 * /blog/{category}/{slug}, /docs/{category}/{slug}. A documentation article whose
 * slug is its own category segment is that category's landing page (/docs/{category}).
 */
export function collectionArticlePath(collection: ArticleCollection, category: string | null | undefined, slug: string): string {
  const definition = ARTICLE_COLLECTIONS[collection]
  const categorySlug = articleCategoryToSlug(collection, category) ?? 'uncategorized'
  if (collection === 'docs' && slug === categorySlug) return `${definition.pathPrefix}/${categorySlug}`
  return `${definition.pathPrefix}/${categorySlug}/${encodeURIComponent(slug)}`
}
