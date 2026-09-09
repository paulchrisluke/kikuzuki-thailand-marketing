import { resolvePublicTemplate } from '~/utils/template-registry'
import { collectionArticlePath, type ArticleCollection } from '~/utils/article-collections'

/**
 * The public path of an article on a site. Customer templates publish one blog
 * at a fixed prefix (/blog or /article). The platform template publishes
 * collections whose URLs carry the category: /blog/{category}/{slug} and
 * /docs/{category}/{slug}.
 */
export function tenantBlogPostPath(
  template: Parameters<typeof resolvePublicTemplate>[0],
  slug: string,
  category?: string | null,
  collection: ArticleCollection = 'blog',
) {
  const routes = resolvePublicTemplate(template).serviceRoutes
  if (!routes.articlePathHasCategory) return `${routes.articleDetailPrefix}/${encodeURIComponent(slug)}`
  return collectionArticlePath(collection, category, slug)
}
