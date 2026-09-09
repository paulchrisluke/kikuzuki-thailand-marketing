<template>
  <div>
    <div v-if="pending" class="py-12 text-center">
      <p class="text-muted">Loading...</p>
    </div>

    <div v-else-if="error || !article" class="rounded-lg border border-red-200 bg-red-50 p-6">
      <p class="text-red-600">{{ error?.message || 'Documentation not found' }}</p>
    </div>

    <div v-else class="xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-10">
      <article>
        <h1 class="mb-6 text-4xl font-bold text-default">{{ article.title }}</h1>

        <div ref="articleBodyRef">
          <BlogArticleRenderer :title="article.title" :blocks="blocks" template="platform" :show-title="false" class="docs-page-body max-w-none! px-0! py-0!" />
        </div>

        <div v-if="current?.isCategoryIndex && siblings.length" class="mt-14 grid gap-6 sm:grid-cols-2">
          <NuxtLink
            v-for="item in siblings"
            :key="item.path"
            :to="item.path"
            class="rounded-2xl border border-default p-6 no-underline transition hover:border-muted hover:bg-elevated"
          >
            <p class="text-lg font-semibold text-default">{{ item.title }}</p>
            <p v-if="item.excerpt" class="mt-2 text-sm text-muted">{{ item.excerpt }}</p>
          </NuxtLink>
        </div>

        <nav v-if="!current?.isCategoryIndex && (previousArticle || nextArticle)" class="mt-16 flex items-start justify-between gap-6">
          <NuxtLink
            v-if="previousArticle"
            :to="previousArticle.path"
            class="group flex min-w-0 flex-initial flex-col gap-1 no-underline"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Previous</p>
            <span class="flex w-full min-w-0 items-center gap-1.5 text-lg font-semibold text-default group-hover:text-primary">
              <PlatformIcon name="arrow-left" class="size-4 shrink-0" />
              <span class="min-w-0 truncate">{{ previousArticle.title }}</span>
            </span>
          </NuxtLink>
          <div v-else class="flex-1" />

          <NuxtLink
            v-if="nextArticle"
            :to="nextArticle.path"
            class="group flex min-w-0 flex-initial flex-col items-end gap-1 text-right no-underline"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Next</p>
            <span class="flex w-full min-w-0 items-center gap-1.5 text-lg font-semibold text-default group-hover:text-primary">
              <span class="min-w-0 truncate">{{ nextArticle.title }}</span>
              <PlatformIcon name="arrow-right" class="size-4 shrink-0" />
            </span>
          </NuxtLink>
        </nav>
      </article>

      <aside class="hidden xl:block">
        <DocsToc :html="tocHtml" />
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import BlogArticleRenderer from '~/components/blog/BlogArticleRenderer.vue'
import { renderMarkdownToHtml, sanitizeHtmlForSsr } from '~/utils/markdown'
import type { BlogEditorBlock } from '~/lib/components/workspace/blog/types'
import { useContentPageSchema } from '~/composables/useContentPageSchema'
import { articleCategoryFromSlug } from '~/utils/article-collections'
import { structuredComponentsFromBlocks } from '~/utils/blog-editor'
import { isRecord, publicApiRequest } from '~/utils/api-clients'
import { loadDomPurify } from '~/utils/dom-purify-loader'

interface DocsArticleDetail {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  category?: string | null
  seo_title?: string | null
  seo_description?: string | null
  canonical_url?: string | null
  robots?: string | null
  updated_at?: string | null
  social_image?: import('~/utils/social-metadata').SocialImageSource | null
  content_blocks?: BlogEditorBlock[] | null
}

// Documentation is the site's `docs` article collection, rendered inside the
// docs layout. /docs/{category} is the category's landing article when one exists.
definePageMeta({ layout: 'docs' })

const DOMPurify = import.meta.client ? await loadDomPurify() : { sanitize: sanitizeHtmlForSsr }

const route = useRoute()
const requestEvent = useRequestEvent()
const segments = computed(() => {
  const raw = route.params.segments
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('/') : []
  return parts.map(part => part.trim()).filter(Boolean)
})

const categorySlug = computed(() => segments.value[0] ?? '')
const category = computed(() => articleCategoryFromSlug('docs', categorySlug.value))
if (segments.value.length < 1 || segments.value.length > 2 || !category.value) {
  throw createError({ statusCode: 404, statusMessage: 'Documentation not found' })
}

const path = computed(() => `/docs/${segments.value.join('/')}`)
const { articles, error: articlesError } = await useDocsArticles()
if (articlesError.value) throw createError({ statusCode: 500, statusMessage: 'Failed to load documentation index' })

const current = computed(() => articles.value.find(item => item.path === path.value) ?? null)

// A category with no landing article opens on its first article.
if (!current.value && segments.value.length === 1) {
  const first = articles.value.find(item => item.categorySlug === categorySlug.value)
  if (!first) throw createError({ statusCode: 404, statusMessage: 'Documentation category not found' })
  await navigateTo(first.path, { replace: true, redirectCode: 302 })
}

// The landing article's slug is its category segment.
const slug = computed(() => segments.value[1] ?? categorySlug.value)

const isArticleResponse = (value: unknown): value is { post: DocsArticleDetail } =>
  isRecord(value) && isRecord(value.post) && typeof value.post.title === 'string' && Array.isArray(value.post.content_blocks)

const { data: article, pending, error } = await useAsyncData(`docs-article-${path.value}`, async () => {
  let loaded: DocsArticleDetail | null
  if (import.meta.server) {
    // Read through the request's own D1 binding rather than a nested self-fetch.
    if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
    const [{ cloudflareEnv }, { getPublishedBlogPost }] = await Promise.all([
      import('~/server/utils/api-response'),
      import('~/server/utils/content/publishing'),
    ])
    const env = cloudflareEnv(requestEvent)
    if (!env.db) throw createError({ statusCode: 503, statusMessage: 'Documentation is temporarily unavailable' })
    loaded = await getPublishedBlogPost(env.db, category.value!, slug.value, env, undefined, 'docs') as DocsArticleDetail | null
  } else {
    const response = await publicApiRequest<{ post: DocsArticleDetail }>(
      `/api/public/blog/${encodeURIComponent(categorySlug.value)}/${encodeURIComponent(slug.value)}?collection=docs`,
      { validate: isArticleResponse },
    )
    loaded = response.post
  }
  if (!loaded) throw createError({ statusCode: 404, statusMessage: 'Documentation not found' })
  return loaded
})

if (error.value) throw error.value

function renderMarkdown(markdown: string) {
  return DOMPurify.sanitize(renderMarkdownToHtml(markdown || ''))
}

const blocks = computed(() => (article.value?.content_blocks ?? []) as BlogEditorBlock[])

const tocHtml = computed(() => blocks.value
  .filter(block => block.type === 'heading' || block.type === 'markdown')
  .map(block => block.type === 'heading'
    ? `<h${Math.max(2, Math.min(6, block.level || 2))}>${DOMPurify.sanitize(String(block.data.text || ''))}</h${Math.max(2, Math.min(6, block.level || 2))}>`
    : renderMarkdown(String(block.data.markdown || '')))
  .join('\n'))

const articleBodyRef = shallowRef<Element | null>(null)
useCopyableCodeBlocks(articleBodyRef, blocks)
const renderedComponents = computed(() => structuredComponentsFromBlocks(blocks.value))

const siblings = computed(() => articles.value.filter(item =>
  item.categorySlug === current.value?.categorySlug && item.path !== current.value?.path))

// Previous/Next walks the sidebar's order across every category.
const currentIndex = computed(() => articles.value.findIndex(item => item.path === path.value))
const previousArticle = computed(() => currentIndex.value > 0 ? articles.value[currentIndex.value - 1] : null)
const nextArticle = computed(() => currentIndex.value >= 0 && currentIndex.value < articles.value.length - 1 ? articles.value[currentIndex.value + 1] : null)

const seoTitle = computed(() => article.value?.seo_title || article.value?.title || 'Documentation')
const seoDescription = computed(() => article.value?.seo_description || article.value?.excerpt || `Learn about ${article.value?.title || 'this topic'} in KrabiClaw documentation.`)

const breadcrumbs = computed(() => [
  { name: 'Docs', url: '/docs' },
  ...(current.value ? [{ name: current.value.category, url: `/docs/${current.value.categorySlug}` }] : []),
  ...(current.value && !current.value.isCategoryIndex ? [{ name: current.value.title, url: current.value.path }] : []),
])

const runtimeConfig = useRuntimeConfig()
const requestURL = useRequestURL()
const platformOrigin = computed(() => runtimeConfig.public.siteUrl || requestURL.origin)
const { canonicalUrl } = useSocialMetadata(() => ({
  template: 'platform' as const,
  schema: false,
  pageType: 'article' as const,
  title: seoTitle.value,
  description: seoDescription.value,
  path: resolveSeoUrl(article.value?.canonical_url || path.value, platformOrigin.value),
  brand: { siteName: 'KrabiClaw' },
  socialImage: article.value?.social_image ?? null,
  robots: article.value?.robots?.trim() || null,
  indexable: !article.value?.robots || !/noindex/i.test(article.value.robots),
}))

useContentPageSchema(computed(() => {
  if (!article.value) return null
  return {
    articleType: 'TechArticle' as const,
    url: canonicalUrl.value,
    title: article.value.title,
    description: seoDescription.value,
    dateModified: article.value.updated_at ?? undefined,
    articleSection: current.value?.category,
    inLanguage: 'en-US',
    breadcrumbs: breadcrumbs.value,
    components: renderedComponents.value,
  }
}))
</script>
