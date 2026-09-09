<template>
  <div>
    <div v-if="pending" class="py-12 text-center">
      <p class="text-muted">Loading...</p>
    </div>

    <div v-else-if="error || !page" class="rounded-lg border border-red-200 bg-red-50 p-6">
      <p class="text-red-600">{{ error?.message || 'Documentation not found' }}</p>
    </div>

    <div v-else class="xl:grid xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-10">
      <article>
        <h1 class="mb-6 text-4xl font-bold text-default">{{ page.title }}</h1>

        <div ref="articleBodyRef">
          <TenantPageRenderer :page="page" template="platform" class="docs-page-body" />
        </div>

        <div v-if="current?.isCategoryIndex && siblingPages.length" class="mt-14 grid gap-6 sm:grid-cols-2">
          <NuxtLink
            v-for="item in siblingPages"
            :key="item.path"
            :to="item.path"
            class="rounded-2xl border border-default p-6 no-underline transition hover:border-muted hover:bg-elevated"
          >
            <p class="text-lg font-semibold text-default">{{ item.title }}</p>
            <p v-if="item.summary" class="mt-2 text-sm text-muted">{{ item.summary }}</p>
          </NuxtLink>
        </div>

        <nav v-if="!current?.isCategoryIndex && (previousPage || nextPage)" class="mt-16 flex items-start justify-between gap-6">
          <NuxtLink
            v-if="previousPage"
            :to="previousPage.path"
            class="group flex min-w-0 flex-initial flex-col gap-1 no-underline"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Previous</p>
            <span class="flex w-full min-w-0 items-center gap-1.5 text-lg font-semibold text-default group-hover:text-primary">
              <PlatformIcon name="arrow-left" class="size-4 shrink-0" />
              <span class="min-w-0 truncate">{{ previousPage.title }}</span>
            </span>
          </NuxtLink>
          <div v-else class="flex-1" />

          <NuxtLink
            v-if="nextPage"
            :to="nextPage.path"
            class="group flex min-w-0 flex-initial flex-col items-end gap-1 text-right no-underline"
          >
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Next</p>
            <span class="flex w-full min-w-0 items-center gap-1.5 text-lg font-semibold text-default group-hover:text-primary">
              <span class="min-w-0 truncate">{{ nextPage.title }}</span>
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
import TenantPageRenderer from '~/components/tenant-pages/TenantPageRenderer.vue'
import { renderMarkdownToHtml, sanitizeHtmlForSsr } from '~/utils/markdown'
import type { BlogEditorBlock } from '~/lib/components/workspace/blog/types'
import { useContentPageSchema } from '~/composables/useContentPageSchema'
import { slugToCategory } from '~/utils/docs-categories'
import { structuredComponentsFromBlocks } from '~/utils/blog-editor'
import { isRecord, publicApiRequest } from '~/utils/api-clients'
import { loadDomPurify } from '~/utils/dom-purify-loader'
import type { PublicTenantPage } from '~/server/utils/public-tenant-pages'

// Documentation is the site's ordinary pages under /docs, rendered inside the
// docs layout. /docs/{category} is the category's landing page when one exists.
definePageMeta({ layout: 'docs' })

const DOMPurify = import.meta.client ? await loadDomPurify() : { sanitize: sanitizeHtmlForSsr }

const route = useRoute()
const requestEvent = useRequestEvent()
const { siteId } = useTenantSite()
const segments = computed(() => {
  const raw = route.params.segments
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('/') : []
  return parts.map(part => part.trim()).filter(Boolean)
})

if (segments.value.length < 1 || segments.value.length > 2 || !slugToCategory(segments.value[0])) {
  throw createError({ statusCode: 404, statusMessage: 'Documentation not found' })
}

const path = computed(() => `/docs/${segments.value.join('/')}`)
const { pages, error: pagesError } = await useDocsPages()
if (pagesError.value) throw createError({ statusCode: 500, statusMessage: 'Failed to load documentation index' })

const current = computed(() => pages.value.find(item => item.path === path.value) ?? null)

// A category with no landing page opens on its first page.
if (!current.value && segments.value.length === 1) {
  const first = pages.value.find(item => item.categorySlug === segments.value[0])
  if (!first) throw createError({ statusCode: 404, statusMessage: 'Documentation category not found' })
  await navigateTo(first.path, { replace: true, redirectCode: 302 })
}

const isPublicPage = (value: unknown): value is { pages: PublicTenantPage[] } =>
  isRecord(value) && Array.isArray(value.pages) && value.pages.every(item => isRecord(item) && typeof item.path === 'string' && Array.isArray(item.blocks))

const { data: page, pending, error } = await useAsyncData(`docs-page-${path.value}`, async () => {
  if (!siteId) throw createError({ statusCode: 500, statusMessage: 'Documentation requires the current site' })
  let loaded: PublicTenantPage | null
  if (import.meta.server) {
    // Read through the request's own D1 binding rather than a nested self-fetch.
    if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
    const [{ cloudflareEnv }, { getPublicTenantPageForPath }] = await Promise.all([
      import('~/server/utils/api-response'),
      import('~/server/utils/public-tenant-pages'),
    ])
    const db = cloudflareEnv(requestEvent).db
    if (!db) throw createError({ statusCode: 503, statusMessage: 'Documentation is temporarily unavailable' })
    loaded = await getPublicTenantPageForPath(db, siteId, path.value, { locale: 'en' })
  } else {
    const response = await publicApiRequest<{ pages: PublicTenantPage[] }>(
      `/api/public/sites/${encodeURIComponent(siteId)}/pages?path=${encodeURIComponent(path.value)}`,
      { validate: isPublicPage },
    )
    loaded = response.pages[0] ?? null
  }
  if (!loaded) throw createError({ statusCode: 404, statusMessage: 'Documentation not found' })
  return loaded
})

if (error.value) throw error.value

function renderMarkdown(markdown: string) {
  return DOMPurify.sanitize(renderMarkdownToHtml(markdown || ''))
}

const blocks = computed(() => (page.value?.blocks ?? []) as unknown as BlogEditorBlock[])

const tocHtml = computed(() => blocks.value
  .filter(block => block.type === 'heading' || block.type === 'markdown')
  .map(block => block.type === 'heading'
    ? `<h${Math.max(2, Math.min(6, block.level || 2))}>${DOMPurify.sanitize(String(block.data.text || ''))}</h${Math.max(2, Math.min(6, block.level || 2))}>`
    : renderMarkdown(String(block.data.markdown || '')))
  .join('\n'))

const articleBodyRef = shallowRef<Element | null>(null)
useCopyableCodeBlocks(articleBodyRef, blocks)
const renderedComponents = computed(() => structuredComponentsFromBlocks(blocks.value))

const siblingPages = computed(() => pages.value.filter(item =>
  item.categorySlug === current.value?.categorySlug && item.path !== current.value?.path))

// Previous/Next walks the sidebar's order across every category.
const currentIndex = computed(() => pages.value.findIndex(item => item.path === path.value))
const previousPage = computed(() => currentIndex.value > 0 ? pages.value[currentIndex.value - 1] : null)
const nextPage = computed(() => currentIndex.value >= 0 && currentIndex.value < pages.value.length - 1 ? pages.value[currentIndex.value + 1] : null)

const seoTitle = computed(() => page.value?.seo_title || page.value?.title || 'Documentation')
const seoDescription = computed(() => page.value?.seo_description || page.value?.summary || `Learn about ${page.value?.title || 'this topic'} in KrabiClaw documentation.`)

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
  path: resolveSeoUrl(page.value?.canonical_url || path.value, platformOrigin.value),
  brand: { siteName: 'KrabiClaw' },
  socialImage: page.value?.social_image ?? null,
  robots: page.value?.robots?.trim() || null,
  indexable: !page.value?.robots || !/noindex/i.test(page.value.robots),
}))

useContentPageSchema(computed(() => {
  if (!page.value) return null
  return {
    articleType: 'TechArticle' as const,
    url: canonicalUrl.value,
    title: page.value.title,
    description: seoDescription.value,
    dateModified: page.value.updated_at,
    articleSection: current.value?.category,
    inLanguage: 'en-US',
    breadcrumbs: breadcrumbs.value,
    components: renderedComponents.value,
  }
}))
</script>
