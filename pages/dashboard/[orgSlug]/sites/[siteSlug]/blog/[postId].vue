<template>
  <UAlert
    v-if="postError"
    color="error"
    variant="soft"
    title="Post could not be loaded"
    :description="postError.message"
  />
  <BlogPostEditor
    v-else
    :repository="repository"
    :initial-post="postResource?.post ?? null"
    defer-load
    :site-id="siteId"
    title="Edit Post"
    :back-url="baseUrl"
    back-label="Blog"
    :is-edit="true"
    :media-picker-component="MediaPicker"
    :free-text-category="true"
  />
  <div v-if="!postError && translationLocales.length" class="mx-auto mt-6 max-w-3xl space-y-3 rounded-lg border border-default p-5">
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-sm font-semibold">Translations</h2>
      <select v-model="translationLocale" aria-label="Field language" class="rounded-lg border border-default bg-default px-2 py-1 text-sm">
        <option value="en">en</option>
        <option v-for="option in translationLocales" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>
    <template v-if="translationLocale !== 'en'">
      <p class="text-xs text-muted">Source (English): {{ postResource?.post.title }}</p>
      <label class="block text-sm">Title ({{ translationLocale }})<input v-model="translationFields.title" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">Excerpt ({{ translationLocale }})<textarea v-model="translationFields.excerpt" :rows="4" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" /></label>
      <label class="block text-sm">Category ({{ translationLocale }})<input v-model="translationFields.category" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">Tags ({{ translationLocale }})<input v-model="translationFields.tags_text" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" placeholder="tag one, tag two"></label>
      <label class="block text-sm">Nav title ({{ translationLocale }})<input v-model="translationFields.nav_title" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">SEO title ({{ translationLocale }})<input v-model="translationFields.seo_title" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">SEO description ({{ translationLocale }})<textarea v-model="translationFields.seo_description" :rows="2" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" /></label>
      <label class="block text-sm">SEO keywords ({{ translationLocale }})<input v-model="translationFields.seo_keywords" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <div class="space-y-3 border-t border-default pt-4">
        <h3 class="text-sm font-semibold">Article content</h3>
        <div v-for="(block, blockIndex) in translationBlocks" :key="block.id || blockIndex" class="space-y-2 rounded-lg border border-default p-3">
          <p class="text-xs font-semibold uppercase text-muted">{{ block.type }}</p>
          <label v-for="field in translationBlockFields(block)" :key="field.path.join('.')" class="block text-sm">
            {{ field.label }}
            <textarea :value="field.value" :rows="field.rows" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" @input="updateTranslationBlockText(block, field.path, $event)" />
          </label>
        </div>
      </div>
      <p v-if="translationError" class="text-sm text-error">{{ translationError }}</p>
      <button type="button" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="translationSaving" @click="saveTranslation">
        {{ translationSaving ? 'Saving…' : 'Save translation' }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { tenantBlogRepository } from '~/lib/components/workspace/blog/tenantBlogRepository'
import { isBlogPostResponse } from '~/lib/components/workspace/blog/blog-response-contracts'
import BlogPostEditor from '~/lib/components/workspace/blog/BlogPostEditor.vue'
import MediaPicker from '~/lib/components/workspace/media/MediaPicker.vue'
import type { BlogEditorBlock, BlogPost } from '~/lib/components/workspace/blog/types'
import { blankBlogLocalizedText, blogLocalizedTextFields, readBlogLocalizedText, writeBlogLocalizedText, type BlogLocalizedFieldPath } from '~/utils/blog-editor'
import { tenantBlogPostPath } from '~/utils/tenant-blog-route'
import { publicTemplateRegistry } from '~/utils/template-registry'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.blog' })

const route = useRoute()
const orgSlug = route.params.orgSlug as string
const siteSlug = route.params.siteSlug as string
const siteId = await useDashboardSiteId()
const postId = String(route.params.postId || '')
if (!postId) throw createError({ statusCode: 400, statusMessage: 'Post ID is required' })

const requestEvent = useRequestEvent()
const { data: postResource, error: postError } = await useAsyncData(
  `dashboard-blog-post:${siteId}:${postId}`,
  async () => {
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const { loadDashboardBlogPost } = await import('~/server/utils/dashboard-editor-resources')
      return await loadDashboardBlogPost(requestEvent, siteId, postId)
    }
    return await dashboardFetch<{ post: BlogPost }>(
      `/api/editor/sites/${siteId}/blog/${postId}`,
      { orgSlug, siteSlug },
      { validate: isBlogPostResponse },
    )
  },
  { lazy: import.meta.client },
)

const repository = tenantBlogRepository({
  siteId,
  orgSlug,
  siteSlug,
})

const baseUrl = `/dashboard/${orgSlug}/sites/${siteSlug}/blog`

useSeoMeta({ title: 'Edit Post | Dashboard' })

const dashboardApi = useDashboardApi()
const toast = useToast()
const translationLocale = ref('en')
const translationLocales = ref<string[]>([])
const translationFields = reactive({ title: '', excerpt: '', category: '', tags_text: '', nav_title: '', seo_title: '', seo_description: '', seo_keywords: '' })
const translationBlocks = ref<BlogEditorBlock[]>([])
const translationDocumentUpdatedAt = ref<string | null>(null)
const translationError = ref<string | null>(null)
const translationSaving = ref(false)
function isBlogLocalesResponse(value: unknown): value is { languages: Array<{ locale: string; status: string; is_source: boolean | number }> } {
  return isRecord(value) && Array.isArray(value.languages)
}
async function loadTranslationLocales() {
  try {
    const response = await dashboardApi<{ languages: Array<{ locale: string; status: string; is_source: boolean | number }> }>(
      `/api/editor/sites/${siteId}/locales`,
      { validate: isBlogLocalesResponse },
    )
    translationLocales.value = response.languages.filter(item => item.status === 'published' && !item.is_source).map(item => item.locale)
  } catch (cause) {
    translationLocales.value = []
    translationError.value = cause instanceof Error ? cause.message : 'Failed to load site languages'
  }
}
type BlogTranslationResponse = { localization: Record<string, unknown> & { updated_at: string; metadata: Record<string, unknown>; content_blocks: BlogEditorBlock[] } }
function isBlogTranslationResponse(value: unknown): value is BlogTranslationResponse {
  return isRecord(value) && isRecord(value.localization) && typeof value.localization.updated_at === 'string'
    && isRecord(value.localization.metadata) && Array.isArray(value.localization.content_blocks)
}
function translationBlockFields(block: BlogEditorBlock) {
  return blogLocalizedTextFields(block)
}
function updateTranslationBlockText(block: BlogEditorBlock, path: BlogLocalizedFieldPath, event: Event) {
  if (!(event.target instanceof HTMLTextAreaElement)) return
  writeBlogLocalizedText(block.data, path, event.target.value)
}
function blankTranslationBlocks(): BlogEditorBlock[] {
  const sourceBlocks = (postResource.value?.post.content_document?.blocks ?? []) as BlogEditorBlock[]
  return sourceBlocks.map(blankBlogLocalizedText)
}
async function loadTranslationFields() {
  translationError.value = null
  try {
    const response = await dashboardApi<BlogTranslationResponse>(
      `/api/editor/sites/${siteId}/localization/content_document/${postId}/${encodeURIComponent(translationLocale.value)}`,
      { validate: isBlogTranslationResponse },
    )
    const values = response.localization
    translationBlocks.value = structuredClone(response.localization.content_blocks)
    translationDocumentUpdatedAt.value = response.localization.updated_at
    translationFields.title = typeof values.title === 'string' ? values.title : ''
    translationFields.excerpt = typeof values.summary === 'string' ? values.summary : ''
    translationFields.category = typeof values.metadata.category === 'string' ? values.metadata.category : ''
    translationFields.tags_text = Array.isArray(values.metadata.tags) ? values.metadata.tags.join(', ') : ''
    translationFields.nav_title = typeof values.metadata.nav_title === 'string' ? values.metadata.nav_title : ''
    translationFields.seo_title = typeof values.seo_title === 'string' ? values.seo_title : ''
    translationFields.seo_description = typeof values.seo_description === 'string' ? values.seo_description : ''
    translationFields.seo_keywords = typeof values.seo_keywords === 'string' ? values.seo_keywords : ''
  } catch (cause) {
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode !== 404) translationError.value = cause instanceof Error ? cause.message : 'Failed to load translation'
    translationBlocks.value = statusCode === 404 ? blankTranslationBlocks() : []
    translationDocumentUpdatedAt.value = null
    translationFields.title = ''; translationFields.excerpt = ''
    translationFields.category = ''; translationFields.tags_text = ''; translationFields.nav_title = ''
    translationFields.seo_title = ''; translationFields.seo_description = ''; translationFields.seo_keywords = ''
  }
}
watch(translationLocale, () => { if (translationLocale.value !== 'en') void loadTranslationFields() })
async function saveTranslation() {
  if (translationLocale.value === 'en') return
  translationSaving.value = true; translationError.value = null
  try {
    if (!translationBlocks.value.length) throw new Error('Add translated article content before saving.')
    const sourceBlocks = (postResource.value?.post.content_document?.blocks ?? []) as BlogEditorBlock[]
    const missingBlockText = sourceBlocks.some((source: BlogEditorBlock, index: number) => translationBlockFields(source).some(field => {
      const translatedValue = translationBlocks.value[index]
        ? readBlogLocalizedText(translationBlocks.value[index].data, field.path)
        : undefined
      return field.value.trim() !== '' && (translatedValue === undefined || translatedValue.trim() === '')
    }))
    if (missingBlockText) throw new Error('Translate every article text field before saving.')
    const metadata: Record<string, unknown> = {}
    const values: Record<string, unknown> = { metadata }
    values.title = translationFields.title.trim()
    values.summary = translationFields.excerpt.trim()
    metadata.category = translationFields.category.trim()
    metadata.nav_title = translationFields.nav_title.trim()
    values.seo_title = translationFields.seo_title.trim()
    values.seo_description = translationFields.seo_description.trim()
    values.seo_keywords = translationFields.seo_keywords.trim()
    const slug = String(postResource.value?.post.slug ?? '')
    const template: unknown = postResource.value?.post.editor_template
    if (template !== 'saya' && template !== 'blawby') throw new Error('Article template is missing or invalid.')
    const sourcePath = tenantBlogPostPath({ themeId: publicTemplateRegistry[template].themeId }, slug)
    const tags_json = translationFields.tags_text.split(',').map(tag => tag.trim()).filter(Boolean)
    const response = await dashboardApi<BlogTranslationResponse>(`/api/editor/sites/${siteId}/localization/content_document/${postId}/${encodeURIComponent(translationLocale.value)}`, {
      method: 'PUT',
      body: {
        values: { ...values, metadata: { ...metadata, tags: tags_json } },
        route_path: `/${translationLocale.value}${sourcePath}`,
        content_blocks: translationBlocks.value,
        ...(translationDocumentUpdatedAt.value ? { expected_updated_at: translationDocumentUpdatedAt.value } : {}),
      },
      validate: isBlogTranslationResponse,
    })
    translationBlocks.value = structuredClone(response.localization.content_blocks)
    translationDocumentUpdatedAt.value = response.localization.updated_at
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    translationError.value = cause instanceof Error ? cause.message : 'Failed to save translation'
  } finally {
    translationSaving.value = false
  }
}
void loadTranslationLocales()
</script>
