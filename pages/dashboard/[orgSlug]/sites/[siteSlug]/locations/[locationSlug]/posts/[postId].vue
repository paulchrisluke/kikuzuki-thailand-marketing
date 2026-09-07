<template>
  <UDashboardPanel id="location-post-detail">
    <template #header>
      <UDashboardNavbar :title="editor.form.title || 'Post'" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="postsPath" label="Posts" />
        </template>
        <template #right>
          <DashboardResourceLocalization
            :site-id="siteId"
            resource-type="content_document"
            :resource-id="postId"
            resource-label="post"
            :fields="postLocalizationFields"
            :route-path="localizedPostPath"
            :language-settings-path="siteLocalizationSettingsPath"
          />
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
        <PostEditor
          v-model:topic="editor.form.topic"
          show-topic
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
import DashboardResourceLocalization from '~/components/dashboard/DashboardResourceLocalization.vue'
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

const siteLocalizationSettingsPath = computed(() => `/dashboard/${route.params.orgSlug}/sites/${route.params.siteSlug}/settings/localization`)
const postLocalizationFields = computed(() => [
  { key: 'title', label: 'Title', source: post.value?.title },
  { key: 'summary', label: 'Body', source: post.value?.body, multiline: true, rows: 6 },
  ...(post.value?.event ? [{ key: 'metadata.event.title', label: 'Event title', source: post.value.event.title }] : []),
  ...(post.value?.post_type === 'offer' ? [{ key: 'metadata.offer.terms_conditions', label: 'Offer terms', source: post.value.offer?.terms_conditions, multiline: true }] : []),
])
function localizedPostPath(locale: string): string {
  const slug = post.value?.slug
  if (typeof slug !== 'string' || !slug) throw new Error('The post slug is unavailable.')
  return `/${locale}/posts/${slug}`
}


useSeoMeta({ title: () => `${editor.form.title || 'Post'} | KrabiClaw Dashboard`, robots: 'noindex, nofollow' })
</script>
