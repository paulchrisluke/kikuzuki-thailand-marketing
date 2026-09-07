<template>
  <div>
    <DashboardListEditor
      v-model:editing="editing"
      title="Posts"
      description="News, events and offers from this location."
      :items="listItems"
      :pending="pending"
      :error="loadError"
      empty-title="No posts yet"
      empty-icon="i-lucide-file-text"
      add-label="Write a post"
      :removing-id="removingId"
      @add="openNew"
      @open="openExisting"
      @remove="removePost"
    >
      <template #filters>
        <UTabs v-model="activeTab" :items="postTabs" :content="false" aria-label="Post status" />
      </template>

      <template #item="{ item }">
        <button
          type="button"
          class="flex w-full items-center gap-4 text-left"
          :data-testid="`post-${item.id}`"
          @click="openExisting(item)"
        >
          <!--
            The picture leads, and a post without one keeps the same footprint
            so the list does not reflow between rows that have one and rows
            that do not.
          -->
          <span class="size-12 shrink-0 overflow-hidden rounded-lg bg-muted">
            <img v-if="coverUrl(item.row)" :src="coverUrl(item.row)!" :alt="item.title" class="h-full w-full object-cover">
            <span v-else class="flex h-full w-full items-center justify-center">
              <UIcon name="i-lucide-file-text" class="size-4 text-muted" />
            </span>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold text-highlighted">{{ item.title }}</span>
            <!--
              What the post is, the way a dish states its price. With four post
              types a row that showed only a date could not tell an offer from
              an event.
            -->
            <span class="mt-1 block truncate text-sm text-muted">{{ item.summary }}</span>
          </span>
        </button>
      </template>
    </DashboardListEditor>

    <!--
      Adding asks only for what the contract will not accept a post without: its
      type, its words, and — for an event or an offer — the window it runs in.
      Everything else is a section of the post once it exists.
    -->
    <DashboardListItemDialog
      v-model:open="newDialogOpen"
      title="New post"
      :removable="false"
      :saving="editor.saving.value"
      :save-disabled="!canCreate"
      save-label="Create"
      @save="createPost"
    >
      <UFormField label="What are you posting?">
        <URadioGroup v-model="newType" :items="typeOptions" :ui="{ fieldset: 'flex flex-wrap gap-4' }" />
      </UFormField>

      <UFormField label="Post" required>
        <UTextarea
          v-model="editor.form.body"
          :rows="5"
          autofocus
          placeholder="What's new? Write it the way you'd say it to a guest."
          class="w-full"
        />
      </UFormField>

      <UFormField
        v-if="editor.form.topic.event"
        :label="newType === 'offer' ? 'When the offer runs' : 'When it happens'"
      >
        <PostScheduleFields v-model="editor.form.topic.event" :is-offer="newType === 'offer'" />
      </UFormField>

      <p class="text-sm text-muted">
        You'll land on this post's own page, where its photo, headline, call to action and
        publishing time are each a section you can fill in.
      </p>
    </DashboardListItemDialog>

  </div>
</template>

<script setup lang="ts">
import { formatTimestamp, formatCalendarDate } from '~/utils/timezone'
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'
import PostScheduleFields from '~/components/dashboard/PostScheduleFields.vue'
import { normalizePostMediaForForm, useLocationPostEditor } from '~/composables/useLocationPostEditor'
import type { PostMutation } from '~/shared/posts'
import { postScheduleComplete } from '~/utils/post-fields'
import { getErrorMessage } from '~/utils/errors'

// The posts index. Rendered by `posts.vue`, which owns the frame.
const dashboardApi = useDashboardApi()
const siteId = await useDashboardSiteId()
const dashboardLocation = useDashboardLocation()

const currentLocationId = computed(() => dashboardLocation.currentLocationId.value)
const editor = useLocationPostEditor(siteId, currentLocationId)
const { locationPaths } = useDashboardSiteLinks()
const postsPath = computed(() => locationPaths.value?.posts ?? '')

const TYPE_LABELS: Record<string, string> = {
  standard: 'Update',
  event: 'Event',
  offer: 'Offer',
  alert: 'Alert',
}
/**
 * `alert` is deliberately absent. The contract accepts exactly one alert —
 * `covid_19` — so offering it would be a dead choice; an existing alert post
 * still opens and edits here.
 */
const typeOptions = [
  { value: 'standard', label: 'Update', description: 'News from the location.' },
  { value: 'event', label: 'Event', description: 'Something at a set date and time.' },
  { value: 'offer', label: 'Offer', description: 'A deal that runs between two dates.' },
]

const postTabs = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Live' },
  { value: 'scheduled', label: 'Scheduled' },
]
const activeTab = ref<string | number>('all')
const editing = ref(false)
const removingId = ref<string | null>(null)

const isPostsResponse = (value: unknown): value is { posts: ApiRecord[] } =>
  isRecord(value)
  && Array.isArray(value.posts)
  && value.posts.every(post => isRecord(post) && typeof post.id === 'string' && typeof post.status === 'string')

const requestEvent = useRequestEvent()
const postsKey = computed(() => `dashboard-location-posts:${siteId}:${currentLocationId.value ?? 'missing'}`)
const { data, pending, error, refresh } = await useAsyncData(
  postsKey,
  async () => {
    if (!currentLocationId.value) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
    // On the server the data is read straight from D1; going back out over HTTP
    // to our own endpoint would cost a round trip during render.
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const { loadDashboardLocationPosts } = await import('~/server/utils/dashboard-editor-resources')
      const resource = await loadDashboardLocationPosts(requestEvent, siteId, currentLocationId.value)
      return { posts: resource.posts.posts as ApiRecord[] }
    }
    const response = await dashboardApi<{ posts: ApiRecord[] }>(`/api/editor/sites/${siteId}/posts`, {
      query: { location_id: currentLocationId.value },
      validate: isPostsResponse,
    })
    return { posts: response.posts }
  },
  { lazy: import.meta.client, watch: [currentLocationId] },
)

const loadError = computed(() => (error.value ? getErrorMessage(error.value, 'Failed to load posts') : null))
const posts = computed(() => data.value?.posts ?? [])

// Filtering happens here rather than by refetching per tab: the list is already
// loaded in full, so a tab press should not cost a round trip.
const visiblePosts = computed(() => {
  if (activeTab.value === 'all') return posts.value
  return posts.value.filter(post => post.status === activeTab.value)
})

const listItems = computed(() => visiblePosts.value.map(row => ({
  id: String(row.id),
  title: postTitle(row),
  summary: postSummary(row),
  row,
})))

// ── Row presentation ────────────────────────────────────
function postTitle(post: ApiRecord): string {
  const title = String(post.title ?? '').trim()
  if (title) return title
  const body = String(post.body ?? '').trim()
  return body ? `${body.slice(0, 60)}${body.length > 60 ? '…' : ''}` : 'Untitled post'
}

/** Type, then what makes this one different, then exactly one date. */
function postSummary(post: ApiRecord): string {
  const parts: string[] = [TYPE_LABELS[String(post.post_type)] ?? 'Post']
  const offer = isRecord(post.offer) ? post.offer : null
  if (offer && typeof offer.coupon_code === 'string' && offer.coupon_code) parts.push(`Code ${offer.coupon_code}`)
  parts.push(postWhen(post))
  return parts.filter(Boolean).join(' · ')
}

/** A post not yet live is described by when it goes live; otherwise by the
 *  dates it is about, and only failing both by when it was last touched. */
function postWhen(post: ApiRecord): string {
  if (post.status === 'scheduled' && typeof post.scheduled_for === 'string') {
    return `Goes live ${formatDate(post.scheduled_for)}`
  }
  const event = isRecord(post.event) ? post.event : null
  const schedule = event && isRecord(event.schedule) ? event.schedule : null
  if (schedule && typeof schedule.start_date === 'string' && schedule.start_date) {
    const start = formatDay(schedule.start_date)
    const end = typeof schedule.end_date === 'string' ? formatDay(schedule.end_date) : ''
    const window = end && end !== start ? `${start} – ${end}` : start
    return post.post_type === 'offer' ? `Runs ${window}` : window
  }
  return formatDate(String(post.updated_at ?? ''))
}

function coverUrl(post: ApiRecord): string | null {
  const cover = normalizePostMediaForForm(post.media).find(entry => entry.slot === 'cover')
  // The thumbnail is a scaled-down duplicate of the same asset, so it is the
  // right source for a row; the full image is only fetched where it shows big.
  return cover?.thumbnail_url ?? cover?.public_url ?? null
}

function formatDate(iso: string) {
  if (!iso) return ''
  return formatTimestamp(iso, 'en', 'UTC', { dateStyle: 'medium' })
}

function formatDay(day: string) {
  return day ? formatCalendarDate(day, 'en') : ''
}

// ── Creating ────────────────────────────────────────────
const newDialogOpen = ref(false)
const newType = ref<'standard' | 'event' | 'offer'>('standard')

/** The chosen type seeds the shape the contract expects for it. An offer carries
 *  its validity window in the same event shape an event uses. */
function seedTopic(type: 'standard' | 'event' | 'offer'): PostMutation {
  return {
    post_type: type,
    event: type === 'standard'
      ? null
      : { title: '', schedule: { start_date: '', start_time: '', end_date: '', end_time: '' } },
    offer: type === 'offer' ? {} : null,
    call_to_action: null,
    alert_type: null,
    scheduled_for: null,
  }
}

const canCreate = computed(() => {
  if (!editor.form.body.trim()) return false
  if (!editor.form.topic.event) return true
  return postScheduleComplete(editor.form.topic.event)
})

function openNew() {
  editor.reset()
  newType.value = 'standard'
  editor.form.topic = seedTopic('standard')
  newDialogOpen.value = true
}

watch(newType, (type) => { editor.form.topic = seedTopic(type) })

async function createPost() {
  const post = await editor.save(null)
  if (!post?.id) return
  newDialogOpen.value = false
  await navigateTo(`${postsPath.value}/${String(post.id)}`)
}

/** A post is its own screen, so opening one is navigation, not a sheet. */
function openExisting(item: { id: string }) {
  return navigateTo(`${postsPath.value}/${item.id}`)
}

/** Removal lives in the list's edit state, the way the menu does it. */
async function removePost(item: { id: string }) {
  removingId.value = item.id
  try {
    if (await editor.remove(item.id)) await refresh()
  } finally {
    removingId.value = null
  }
}
</script>
