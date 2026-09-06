<template>
  <UAlert
    v-if="postError"
    color="error"
    variant="soft"
    title="Post could not be loaded"
    :description="postError.message"
  />
  <BlogPostEditor
    v-else-if="isPrimaryLanguage"
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
  <div v-else-if="!postError && translationLocale" class="mx-auto mt-6 max-w-3xl space-y-3 rounded-lg border border-default p-5">
    <h2 class="text-sm font-semibold">Edit Post</h2>
    <p class="text-xs text-muted">Primary ({{ sourceLocale }}): {{ postResource?.post.title }}</p>
      <label class="block text-sm">Title<input v-model="translationFields.title" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">Excerpt<textarea v-model="translationFields.excerpt" :rows="4" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" /></label>
      <label class="block text-sm">Category<input v-model="translationFields.category" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">Tags<input v-model="translationFields.tags_text" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2" placeholder="tag one, tag two"></label>
      <label class="block text-sm">Nav title<input v-model="translationFields.nav_title" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
      <label class="block text-sm">SEO keywords<input v-model="translationFields.seo_keywords" class="mt-1 w-full rounded-lg border border-default bg-default px-3 py-2"></label>
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
      {{ translationSaving ? 'Saving…' : 'Save' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { tenantBlogRepository } from '~/lib/components/workspace/blog/tenantBlogRepository'
import { isBlogPostResponse } from '~/lib/components/workspace/blog/blog-response-contracts'
import BlogPostEditor from '~/lib/components/workspace/blog/BlogPostEditor.vue'
import MediaPicker from '~/lib/components/workspace/media/MediaPicker.vue'
import type { BlogEditorBlock, BlogPost } from '~/lib/components/workspace/blog/types'
import { blankBlogLocalizedText, blogLocalizedTextFields, writeBlogLocalizedText, type BlogLocalizedFieldPath } from '~/utils/blog-editor'
import { tenantBlogPostPath } from '~/utils/tenant-blog-route'

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

// ── Translations (resource_localizations, same API as the editor CRUD) ──
const dashboardApi = useDashboardApi()
const toast = useToast()
const contentLanguage = useDashboardContentLanguage()
await contentLanguage.load(siteId)
const translationLocale = contentLanguage.locale
const sourceLocale = contentLanguage.sourceLocale
const isPrimaryLanguage = computed(() => translationLocale.value === sourceLocale.value)
const translationFields = reactive({ title: '', excerpt: '', category: '', tags_text: '', nav_title: '', seo_keywords: '' })
const translationBlocks = ref<BlogEditorBlock[]>([])
const translationDocumentUpdatedAt = ref<string | null>(null)
const translationError = ref<string | null>(null)
const translationSaving = ref(false)
type BlogTranslationResponse = { localization: { values: Record<string, unknown>; content_document?: { document: { updated_at: string }; blocks: BlogEditorBlock[] } } }
function isBlogTranslationResponse(value: unknown): value is BlogTranslationResponse {
  if (!isRecord(value) || !isRecord(value.localization) || !isRecord(value.localization.values)) return false
  const document = value.localization.content_document
  return document === undefined
    || (isRecord(document) && isRecord(document.document) && typeof document.document.updated_at === 'string' && Array.isArray(document.blocks))
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
  const locale = translationLocale.value
  if (!locale || locale === sourceLocale.value) return
  try {
    const response = await dashboardApi<BlogTranslationResponse>(
      `/api/editor/sites/${siteId}/localization/tenant_blog_post/${postId}/${encodeURIComponent(locale)}`,
      { validate: isBlogTranslationResponse },
    )
    const values = response.localization.values
    translationBlocks.value = structuredClone(response.localization.content_document?.blocks ?? [])
    translationDocumentUpdatedAt.value = response.localization.content_document?.document.updated_at ?? null
    translationFields.title = typeof values.title === 'string' ? values.title : ''
    translationFields.excerpt = typeof values.excerpt === 'string' ? values.excerpt : ''
    translationFields.category = typeof values.category === 'string' ? values.category : ''
    translationFields.tags_text = Array.isArray(values.tags_json) ? values.tags_json.join(', ') : ''
    translationFields.nav_title = typeof values.nav_title === 'string' ? values.nav_title : ''
    translationFields.seo_keywords = typeof values.seo_keywords === 'string' ? values.seo_keywords : ''
  } catch (cause) {
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode !== 404) translationError.value = cause instanceof Error ? cause.message : 'Failed to load translation'
    translationBlocks.value = statusCode === 404 ? blankTranslationBlocks() : []
    translationDocumentUpdatedAt.value = null
    translationFields.title = ''; translationFields.excerpt = ''
    translationFields.category = ''; translationFields.tags_text = ''; translationFields.nav_title = ''
    translationFields.seo_keywords = ''
  }
}
watch(translationLocale, () => { if (translationLocale.value && translationLocale.value !== sourceLocale.value) void loadTranslationFields() }, { immediate: true })
async function saveTranslation() {
  if (!translationLocale.value || translationLocale.value === sourceLocale.value) return
  translationSaving.value = true; translationError.value = null
  try {
    if (!translationBlocks.value.length) throw new Error('Add translated article content before saving.')
    const values: Record<string, string> = {}
    if (translationFields.title.trim()) values.title = translationFields.title.trim()
    if (translationFields.excerpt.trim()) values.excerpt = translationFields.excerpt.trim()
    if (translationFields.category.trim()) values.category = translationFields.category.trim()
    if (translationFields.nav_title.trim()) values.nav_title = translationFields.nav_title.trim()
    if (translationFields.seo_keywords.trim()) values.seo_keywords = translationFields.seo_keywords.trim()
    const slug = String(postResource.value?.post.slug ?? '')
    const sourcePath = tenantBlogPostPath({ theme: postResource.value?.post.editor_template }, slug)
    const tags_json = translationFields.tags_text.split(',').map(tag => tag.trim()).filter(Boolean)
    const response = await dashboardApi<BlogTranslationResponse>(`/api/editor/sites/${siteId}/localization/tenant_blog_post/${postId}/${encodeURIComponent(translationLocale.value)}`, {
      method: 'PUT',
      body: {
        values: { ...values, ...(tags_json.length ? { tags_json } : {}) },
        route_path: `/${translationLocale.value}${sourcePath}`,
        content_blocks: translationBlocks.value,
        ...(translationDocumentUpdatedAt.value ? { expected_document_updated_at: translationDocumentUpdatedAt.value } : {}),
      },
      validate: isBlogTranslationResponse,
    })
    translationBlocks.value = structuredClone(response.localization.content_document?.blocks ?? [])
    translationDocumentUpdatedAt.value = response.localization.content_document?.document.updated_at ?? null
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    translationError.value = cause instanceof Error ? cause.message : 'Failed to save translation'
  } finally {
    translationSaving.value = false
  }
}
</script>
