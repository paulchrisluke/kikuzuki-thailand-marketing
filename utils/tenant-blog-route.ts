import { resolvePublicTemplate } from '~/utils/template-registry'

export function tenantBlogPostPath(template: Parameters<typeof resolvePublicTemplate>[0], slug: string) {
  return resolvePublicTemplate(template).serviceRoutes.articleDetailPrefix + '/' + encodeURIComponent(slug)
}
