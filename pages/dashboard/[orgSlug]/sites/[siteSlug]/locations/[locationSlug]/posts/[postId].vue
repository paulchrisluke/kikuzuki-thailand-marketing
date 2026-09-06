<template>
  <UDashboardPanel id="location-post-detail">
    <template #header>
      <UDashboardNavbar :title="postTitle" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="postsPath" label="Posts" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="loadError"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        title="Post could not be loaded"
        :description="loadError"
      />

      <div v-else class="space-y-4">
        <PostEditor v-if="isPrimaryLanguage"
          v-model:title="editor.form.title"
          v-model:body="editor.form.body"
          v-model:media="editor.form.media"
          eyebrow="Location post"
          :status-text="String(post?.status ?? '')"
          :site-id="siteId"
          show-image
          show-preview
          can-delete
          :show-slug="false"
          :show-seo="false"
          :saving="editor.saving.value"
          :publishing="editor.publishing.value"
          body-placeholder="What's the post about?"
          :body-rows="6"
          publish-label="Publish…"
          save-label="Save changes"
          @save="onSave"
          @publish="openPublish"
          @delete="onDelete"
        />

        <div v-else class="space-y-3 rounded-lg border border-default p-4">
          <p class="text-xs text-muted">Primary ({{ sourceLocale }}): {{ editor.form.title }}</p>
            <UFormField label="Title">
              <UInput v-model="translationFields.title" class="w-full" />
            </UFormField>
            <UFormField label="Body">
              <UTextarea v-model="translationFields.body" :rows="5" class="w-full" />
            </UFormField>
            <UFormField label="Event title">
              <UInput v-model="translationFields.event_title" class="w-full" />
            </UFormField>
            <UFormField label="Offer terms">
              <UTextarea v-model="translationFields.offer_terms" :rows="2" class="w-full" />
            </UFormField>
          <p v-if="translationError" class="text-sm text-error">{{ translationError }}</p>
          <UButton :loading="translationSaving" :disabled="!translationReady" label="Save" @click="saveTranslation" />
        </div>

        <div v-if="publicPath" class="flex flex-wrap items-center gap-2">
          <UButton :to="publicPath" target="_blank" size="sm" color="neutral" variant="soft" icon="i-lucide-external-link">
            View public post
          </UButton>
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-copy" @click="copyPublicLink">
            Copy public link
          </UButton>
        </div>
      </div>
    </template>
  </UDashboardPanel>

  <!--
    Publishing is a step after saving, not a set of checkboxes sitting inside
    the form: the tenant writes the post, saves it, then decides where it goes.
  -->
  <UModal v-model:open="publishOpen" title="Publish this post">
    <template #body>
      <div class="space-y-3 px-6 py-4">
        <p class="text-sm text-muted">Choose where this post should go out.</p>
        <label
          v-for="channel in channelOptions"
          :key="channel.value"
          class="flex items-center gap-3 rounded-lg border border-default px-3 py-2 text-sm"
          :class="channel.disabled ? 'text-muted' : 'text-default'"
        >
          <UCheckbox
            :model-value="editor.selectedChannels.value.includes(channel.value)"
            :disabled="channel.disabled"
            @update:model-value="toggleChannel(channel.value, Boolean($event))"
          />
          <span class="min-w-0 flex-1 truncate">{{ channel.label }}</span>
          <UBadge v-if="channel.disabled" size="xs" color="neutral" variant="soft">Not connected</UBadge>
        </label>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-3 px-6 py-4">
        <UButton color="neutral" variant="ghost" label="Cancel" @click="publishOpen = false" />
        <UButton
          :loading="editor.publishing.value"
          :disabled="!editor.selectedChannels.value.length"
          :label="editor.selectedChannels.value.length > 1 ? `Publish to ${editor.selectedChannels.value.length} channels` : 'Publish'"
          @click="onPublish"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import PostEditor from '~/lib/components/workspace/editor/PostEditor.vue'
import { useLocationPostEditor } from '~/composables/useLocationPostEditor'
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.posts' })

const route = useRoute()
const dashboardApi = useDashboardApi()
const toast = useToast()
const { locationPaths } = useDashboardSiteLinks()
const siteId = await useDashboardSiteId()
const dashboardLocation = useDashboardLocation()

const postId = computed(() => String(route.params.postId ?? ''))
const currentLocationId = computed(() => dashboardLocation.currentLocationId.value)
const postsPath = computed(() => locationPaths.value?.posts ?? '')
const editor = useLocationPostEditor(siteId, currentLocationId)

const isSinglePostResponse = (value: unknown): value is { post: ApiRecord } =>
  isRecord(value) && isRecord(value.post) && typeof value.post.id === 'string'
const isFacebookResponse = (value: unknown): value is { connected: boolean } =>
  isRecord(value) && typeof value.connected === 'boolean'

const { data, error } = await useAsyncData(
  computed(() => `dashboard-location-post:${siteId}:${postId.value}`),
  () => dashboardApi<{ post: ApiRecord }>(`/api/editor/sites/${siteId}/posts/${postId.value}`, {
    validate: isSinglePostResponse,
  }),
  { watch: [postId] },
)

// Whether Facebook is connected only decides which publish channels are
// offered. Fetching it beside the post meant an integrations outage set the
// page's error and hid the editor, so a tenant could not edit their own post
// because of an unrelated service.
const { data: facebookData } = await useAsyncData(
  computed(() => `facebook-connection:${currentLocationId.value ?? 'missing'}`),
  () => dashboardApi<{ connected: boolean }>('/api/integrations/facebook-pages/connection', {
    query: { locationId: currentLocationId.value ?? '' },
    validate: isFacebookResponse,
  }),
  { lazy: true, default: () => ({ connected: false }) },
)

const loadError = computed(() => (error.value ? getErrorMessage(error.value, 'Failed to load the post') : null))
const post = computed(() => data.value?.post ?? null)
const facebookConnected = computed(() => facebookData.value?.connected ?? false)

watch(post, value => { if (value) editor.loadFrom(value) }, { immediate: true })

const channelOptions = computed(() => [
  { value: 'site', label: 'This website', disabled: false },
  { value: 'facebook', label: 'Facebook Page', disabled: !facebookConnected.value, hint: facebookConnected.value ? undefined : 'Connect in Integrations' },
  { value: 'instagram', label: 'Instagram', disabled: !facebookConnected.value, hint: facebookConnected.value ? 'Requires image' : 'Connect in Integrations' },
])

const publicPath = computed(() => {
  const path = post.value?.canonical_url || post.value?.public_path
  return path ? String(path) : null
})

const publishOpen = ref(false)

async function onSave() {
  await editor.save(postId.value)
}

/** Publishing acts on a saved post, so pending edits are committed first —
 *  but an untouched post is already saved and must not be rewritten. */
async function openPublish() {
  if (editor.isDirty.value && !(await editor.save(postId.value))) return
  publishOpen.value = true
}

function toggleChannel(value: string, checked: boolean) {
  const selected = editor.selectedChannels.value
  editor.selectedChannels.value = checked
    ? (selected.includes(value) ? selected : [...selected, value])
    : selected.filter(channel => channel !== value)
}

async function onPublish() {
  if (await editor.publish(postId.value)) publishOpen.value = false
}

async function onDelete() {
  if (await editor.remove(postId.value)) await navigateTo(postsPath.value)
}

async function copyPublicLink() {
  const path = publicPath.value
  if (!path || !import.meta.client) return
  const url = path.startsWith('http') ? path : new URL(path, window.location.origin).toString()
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
    await navigator.clipboard.writeText(url)
    toast.add({ description: 'Public link copied', color: 'success' })
  } catch {
    toast.add({ description: 'Failed to copy public link', color: 'error' })
  }
}

// ── Translations (resource_localizations, same API as the editor CRUD) ──
const contentLanguage = useDashboardContentLanguage()
await contentLanguage.load(siteId)
const translationLocale = contentLanguage.locale
const sourceLocale = contentLanguage.sourceLocale
const isPrimaryLanguage = computed(() => translationLocale.value === sourceLocale.value)
const translationFields = reactive({ title: '', body: '', event_title: '', offer_terms: '' })
const postTitle = computed(() => {
  const title = isPrimaryLanguage.value ? editor.form.title : translationFields.title
  const text = title.trim()
  return text ? text : (isPrimaryLanguage.value ? 'Post' : 'Not translated')
})
const translationError = ref<string | null>(null)
const translationSaving = ref(false)
const translationLoading = ref(false)
const loadedTranslationPostId = ref('')
const loadedTranslationLocale = ref('')
let translationLoadGeneration = 0
const translationReady = computed(() => !translationLoading.value
  && loadedTranslationPostId.value === postId.value
  && loadedTranslationLocale.value === translationLocale.value)

function isPostTranslationResponse(value: unknown): value is { localization: { values: Record<string, unknown> } } {
  return isRecord(value) && isRecord(value.localization) && isRecord(value.localization.values)
}

async function loadTranslationFields() {
  const requestedPostId = postId.value
  const requestedLocale = translationLocale.value
  const generation = ++translationLoadGeneration
  for (const field of ['title', 'body', 'event_title', 'offer_terms'] as const) {
    translationFields[field] = ''
  }
  loadedTranslationPostId.value = ''
  loadedTranslationLocale.value = ''
  translationError.value = null
  if (!requestedPostId || !requestedLocale || requestedLocale === sourceLocale.value) {
    translationLoading.value = false
    return
  }
  translationLoading.value = true
  try {
    const response = await dashboardApi<{ localization: { values: Record<string, unknown> } }>(
      `/api/editor/sites/${siteId}/localization/site_post/${requestedPostId}/${encodeURIComponent(requestedLocale)}`,
      { validate: isPostTranslationResponse },
    )
    if (generation !== translationLoadGeneration
      || postId.value !== requestedPostId
      || translationLocale.value !== requestedLocale) return
    const values = response.localization.values
    for (const field of ['title', 'body', 'event_title', 'offer_terms'] as const) {
      translationFields[field] = typeof values[field] === 'string' ? values[field] : ''
    }
    loadedTranslationPostId.value = requestedPostId
    loadedTranslationLocale.value = requestedLocale
  } catch (cause) {
    if (generation !== translationLoadGeneration
      || postId.value !== requestedPostId
      || translationLocale.value !== requestedLocale) return
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode !== 404) translationError.value = getErrorMessage(cause, 'Failed to load translation')
    for (const field of ['title', 'body', 'event_title', 'offer_terms'] as const) {
      translationFields[field] = ''
    }
    if (statusCode === 404) {
      loadedTranslationPostId.value = requestedPostId
      loadedTranslationLocale.value = requestedLocale
    }
  } finally {
    if (generation === translationLoadGeneration) translationLoading.value = false
  }
}

watch([postId, translationLocale], () => { void loadTranslationFields() }, { immediate: true })

async function saveTranslation() {
  const requestedPostId = postId.value
  const requestedLocale = translationLocale.value
  if (!requestedPostId || !requestedLocale || requestedLocale === sourceLocale.value
    || !translationReady.value
    || loadedTranslationPostId.value !== requestedPostId
    || loadedTranslationLocale.value !== requestedLocale) return
  translationSaving.value = true
  translationError.value = null
  try {
    const values: Record<string, string> = {}
    for (const field of ['title', 'body', 'event_title', 'offer_terms'] as const) {
      if (translationFields[field].trim()) values[field] = translationFields[field].trim()
    }
    await dashboardApi(`/api/editor/sites/${siteId}/localization/site_post/${requestedPostId}/${encodeURIComponent(requestedLocale)}`, {
      method: 'PUT',
      body: { values, route_path: `/${requestedLocale}/posts/${editor.form.slug}` },
      validate: isRecord,
    })
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    translationError.value = getErrorMessage(cause, 'Failed to save translation')
  } finally {
    translationSaving.value = false
  }
}

useSeoMeta({ title: () => `${editor.form.title || 'Post'} | KrabiClaw Dashboard`, robots: 'noindex, nofollow' })
</script>
