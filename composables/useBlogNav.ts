import { BLOG_CATEGORY_SLUGS, blogCategoryToSlug } from '~/utils/blog-categories'
import { groupItemsByNavSection } from '~/utils/platform-content-nav'
import { publicApiRequest } from '~/utils/api-clients'
import { validateApiShape } from '~/utils/api-validation'

interface PublicBlogPost {
  id: string
  slug: string
  title: string
  category?: string | null
  nav_section?: string | null
  nav_title?: string | null
  nav_order?: number | null
  nav_section_order?: number | null
  hide_from_nav?: boolean | number | null
  featured_order?: number | null
  excerpt?: string | null
  published_at?: string | null
  media?: Array<{
    asset_id: string
    slot: string
    public_url: string | null
    kind: string | null
    width: number | null
    height: number | null
  }>
}

interface BlogNavCategory {
  category: string
  categorySlug: string
  posts: Array<PublicBlogPost & { label: string }>
}

export function useBlogNav() {
  const requestEvent = useRequestEvent()
  const { data, pending, error } = useAsyncData<{ posts: PublicBlogPost[] }>('public-blog-index', async () => {
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const [{ cloudflareEnv }, { listPublicPlatformBlogPosts }] = await Promise.all([
        import('~/server/utils/api-response'),
        import('~/server/utils/content/publishing'),
      ])
      const db = cloudflareEnv(requestEvent).db
      if (!db) throw createError({ statusCode: 503, statusMessage: 'Blog data is temporarily unavailable' })
      return { posts: await listPublicPlatformBlogPosts(db) }
    }
    return await publicApiRequest<{ posts: PublicBlogPost[] }>('/api/public/blog', {
      validate: validateApiShape({ posts: { arrayOf: { id: 'string', slug: 'string', title: 'string' } } }),
    })
  })

  const posts = computed<PublicBlogPost[]>(() => data.value?.posts ?? [])

  const categories = computed<BlogNavCategory[]>(() => {
    const eligible = posts.value
      .filter(post => post.category && blogCategoryToSlug(post.category) && !post.hide_from_nav)
    .map(post => ({ ...post, _categorySlug: blogCategoryToSlug(post.category!)! }))

    const groups = groupItemsByNavSection<typeof eligible[number]>(
      eligible,
      (post) => post.nav_section?.trim() || post.category!,
      Object.keys(BLOG_CATEGORY_SLUGS),
    )

    return groups.map(group => ({
      category: group.category,
      categorySlug: group.items[0]?._categorySlug ?? '',
      posts: group.items,
    }))
  })

  return { posts, categories, pending, error }
}
