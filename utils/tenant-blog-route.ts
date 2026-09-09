import { resolvePublicTemplate } from '~/utils/template-registry'
import { normalizeBlogSlug } from '~/utils/blog-editor'

/**
 * The public path of an article on a site. The template decides the prefix
 * (/blog or /article) and whether the category sits between the prefix and the
 * slug, which KrabiClaw's own blog does (/blog/{category}/{slug}).
 */
export function tenantBlogPostPath(
  template: Parameters<typeof resolvePublicTemplate>[0],
  slug: string,
  category?: string | null,
) {
  const routes = resolvePublicTemplate(template).serviceRoutes
  const encodedSlug = encodeURIComponent(slug)
  if (!routes.articlePathHasCategory) return `${routes.articleDetailPrefix}/${encodedSlug}`
  return `${routes.articleDetailPrefix}/${normalizeBlogSlug(category || 'uncategorized', 'uncategorized')}/${encodedSlug}`
}
