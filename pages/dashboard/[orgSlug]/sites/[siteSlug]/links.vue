<template>
  <div class="space-y-6">
    <!-- The section's own actions. Its title and the way back belong to
         the shell, which renders them once for whichever section is open. -->
    <div class="flex flex-wrap items-center justify-end gap-2">
    <div class="flex items-center gap-2">
      <UButton color="neutral" variant="ghost" icon="i-lucide-copy" :disabled="!publicLinksUrl" @click="copyPublicUrl">Copy URL</UButton>
      <UButton color="neutral" variant="soft" icon="i-lucide-external-link" :to="publicLinksUrl || undefined" target="_blank" :disabled="!publicLinksUrl">Open</UButton>
      <UButton v-if="isPrimaryLanguage" icon="i-lucide-save" :loading="saving" :disabled="!dirty" @click="save">Save</UButton>
    </div>
    </div>

  <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <div class="space-y-6">
      <UAlert
        v-if="errorMessage"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :description="errorMessage"
      />

      <UCard v-if="isPrimaryLanguage">
        <template #header>
          <div>
            <div>
              <h2 class="text-base font-semibold text-highlighted">Page details</h2>
              <p class="mt-1 text-sm text-muted">Manage the owned-domain link hub for this site.</p>
            </div>
          </div>
        </template>

        <div v-if="!editorReady" class="space-y-4">
          <USkeleton class="h-10" />
          <USkeleton class="h-14" />
        </div>
        <div v-else class="grid gap-5 sm:grid-cols-2">
          <UFormField label="Title" required>
            <UInput v-model="form.title" aria-label="Links page title" maxlength="160" />
          </UFormField>
          <UFormField label="Robots">
            <USelect v-model="form.robots" :items="robotsOptions" />
          </UFormField>
          <UFormField label="SEO title">
            <UInput v-model="form.seo_title" maxlength="200" />
          </UFormField>
          <UFormField label="SEO description">
            <UInput v-model="form.seo_description" maxlength="500" />
          </UFormField>
        </div>
      </UCard>

      <UCard v-else-if="translationLocale">
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">Page details</h2>
        </template>
        <div>
          <UFormField label="Title">
            <UInput v-model="translationFields.title" data-testid="links-translation-title" />
          </UFormField>
        </div>
        <p v-if="translationError" class="mt-2 text-sm text-error">{{ translationError }}</p>
        <UButton data-testid="links-save-page-translation" class="mt-3" size="sm" :loading="translationSaving" :disabled="translationUnavailable || !translationLocale" @click="saveTranslation">Save</UButton>

        <div v-if="items.length" class="mt-6 space-y-4 border-t border-default pt-4">
          <div v-for="item in items" :key="item.id" :data-testid="`links-item-translation-${item.id}`">
            <p class="text-sm text-muted">Source: {{ sourceLabel(item.label, 'Untitled link') }}</p>
            <UFormField label="Label" class="mt-2">
              <UInput v-model="itemTranslationLabels[item.id]" data-testid="links-item-translation-label" />
            </UFormField>
            <UButton data-testid="links-save-item-translation" class="mt-3" size="sm" variant="soft" :loading="itemTranslationSavingId === item.id" :disabled="translationUnavailable" @click="saveItemTranslation(item)">Save</UButton>
          </div>
          <p v-if="itemTranslationError" class="text-sm text-error">{{ itemTranslationError }}</p>
        </div>
      </UCard>

      <DashboardListEditor v-if="isPrimaryLanguage"
        v-model:editing="editing"
        title="Links"
        description="Add, hide, and reorder the buttons shown on /links."
        :items="listItems"
        empty-title="No links yet"
        empty-icon="i-lucide-link"
        add-label="Add a link"
        reorderable
        @add="openNew"
        @open="openExisting"
        @remove="removeItem"
        @move="move"
      >
        <template #item="{ item }">
          <div class="flex items-center gap-2">
            <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
            <UBadge v-if="item.row.status === 'hidden'" color="neutral" variant="soft" size="sm">hidden</UBadge>
          </div>
          <p class="mt-1 truncate text-sm text-muted">{{ item.row.destination || 'No destination yet' }}</p>
        </template>
      </DashboardListEditor>

      <DashboardListItemDialog
        v-model:open="dialogOpen"
        :title="editingId ? 'Edit link' : 'Add a link'"
        :removable="Boolean(editingId)"
        :save-disabled="!itemForm.label.trim() || !itemForm.destination.trim()"
        @save="applyItem"
        @remove="removeEditing"
      >
        <UFormField label="Label" required>
          <UInput v-model="itemForm.label" maxlength="120" autofocus class="w-full" />
        </UFormField>
        <UFormField label="Destination" required>
          <UInput v-model="itemForm.destination" placeholder="/reservations or https://example.com" maxlength="2048" class="w-full" />
        </UFormField>
        <UFormField label="Status">
          <USelect v-model="itemForm.status" :items="itemStatusOptions" class="w-full" />
        </UFormField>
      </DashboardListItemDialog>
    </div>

    <aside class="xl:sticky xl:top-4 xl:self-start">
      <div class="overflow-hidden rounded-lg border border-default bg-elevated">
        <div class="border-b border-default px-4 py-3">
          <h2 class="text-sm font-semibold text-highlighted">Preview</h2>
        </div>
        <div class="px-4 py-6">
          <div class="mx-auto max-w-xs text-center">
            <h3 class="mt-4 truncate text-xl font-semibold text-highlighted">{{ previewTitle }}</h3>
            <div class="mt-5 space-y-2 text-left">
              <div
                v-for="item in activePreviewItems"
                :key="item.id"
                class="flex min-h-12 items-center rounded-lg border border-default bg-default px-3 py-2 text-center"
              >
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-highlighted">{{ item.label }}</span>
                </span>
              </div>
              <p v-if="activePreviewItems.length === 0" class="text-center text-sm text-muted">No active links to preview.</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
  </div>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'

const dashboardApi = useDashboardApi()
definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.links' })

useSeoMeta({ title: 'Links page | KrabiClaw Dashboard', robots: 'noindex, nofollow' })

type ItemStatus = 'active' | 'hidden'

interface LinksPage {
  id: string
  title: string
  robots: string
  seo_title: string
  seo_description: string
}

interface LinkItem {
  id: string
  label: string
  destination: string
  sort_order: number
  status: ItemStatus
}

interface ApiLinksPage extends Omit<LinksPage, 'seo_title' | 'seo_description'> {
  seo_title: string | null
  seo_description: string | null
}

type ApiLinkItem = LinkItem

const isLinksResponse = (
  value: unknown,
): value is { page: ApiLinksPage; items: ApiLinkItem[] } =>
  isRecord(value)
  && isRecord(value.page)
  && typeof value.page.title === 'string'
  && Array.isArray(value.items)
  && value.items.every(item =>
    isRecord(item)
    && typeof item.id === 'string'
    && typeof item.label === 'string'
    && typeof item.destination === 'string'
    && typeof item.sort_order === 'number'
    && typeof item.status === 'string',
  )

const siteId = await useDashboardSiteId()
const dashboard = useDashboardSite()
const toast = useToast()
const saving = ref(false)
const errorMessage = ref('')
const savedSnapshot = ref('')
const mounted = ref(false)

const itemStatusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Hidden', value: 'hidden' },
]
const robotsOptions = [
  { label: 'No index, follow', value: 'noindex,follow' },
  { label: 'Index, follow', value: 'index,follow' },
  { label: 'Index, no follow', value: 'index,nofollow' },
  { label: 'No index, no follow', value: 'noindex,nofollow' },
]
const form = reactive<LinksPage>({
  id: '',
  title: '',
  robots: 'noindex,follow',
  seo_title: '',
  seo_description: '',
})
const items = ref<LinkItem[]>([])

const listItems = computed(() => items.value.map(row => ({
  id: row.id,
  title: row.label || 'Untitled link',
  row,
})))

const itemForm = reactive({ label: '', destination: '', status: 'active' as ItemStatus })

// The dialog edits the draft, not the server: this page saves its details and its
// links together through one endpoint, so "Save" here means "apply to the
// document" and the navbar's Save is what persists it.
const { editing, dialogOpen, editingId, openNew, openExisting, close, removeItem, removeEditing } = useListEditor<LinkItem>({
  find: id => items.value.find(item => item.id === id) ?? null,
  fill: (row) => {
    itemForm.label = row.label
    itemForm.destination = row.destination
    itemForm.status = row.status
  },
  clear: () => {
    itemForm.label = ''
    itemForm.destination = ''
    itemForm.status = 'active'
  },
  destroy: async (id) => {
    items.value = items.value
      .filter(item => item.id !== id)
      .map((entry, sortOrder) => ({ ...entry, sort_order: sortOrder }))
  },
})

function applyItem() {
  if (editingId.value) {
    items.value = items.value.map(item => item.id === editingId.value
      ? { ...item, label: itemForm.label, destination: itemForm.destination, status: itemForm.status }
      : item)
  } else {
    items.value = [...items.value, {
      id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      label: itemForm.label,
      destination: itemForm.destination,
      sort_order: items.value.length,
      status: itemForm.status,
    }]
  }
  close()
}

function move(item: { id: string }, direction: -1 | 1) {
  const index = items.value.findIndex(entry => entry.id === item.id)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= items.value.length) return
  const next = [...items.value]
  const [moved] = next.splice(index, 1)
  if (!moved) return
  next.splice(nextIndex, 0, moved)
  items.value = next.map((entry, sortOrder) => ({ ...entry, sort_order: sortOrder }))
}

const { data, pending, refresh } = await useAsyncData(
  `links-page-editor-${siteId}`,
  () => dashboardApi<{ page: ApiLinksPage; items: ApiLinkItem[] }>(
    `/api/editor/sites/${siteId}/links-page`,
    { validate: isLinksResponse },
  ),
  { server: false },
)

watch(data, (value) => {
  if (!value) return
  Object.assign(form, {
    ...value.page,
    seo_title: value.page.seo_title ?? '',
    seo_description: value.page.seo_description ?? '',
  })
  items.value = value.items
  savedSnapshot.value = serializeState()
}, { immediate: true })

const dirty = computed(() => savedSnapshot.value !== serializeState())
const editorReady = computed(() => mounted.value && !pending.value)
const activePreviewItems = computed(() => items.value
  .filter(item => item.status === 'active')
  .map(item => ({
    ...item,
    label: isPrimaryLanguage.value ? item.label : (itemTranslationLabels[item.id]?.trim() ? itemTranslationLabels[item.id]!.trim() : 'Not translated'),
  })))
function sourceLabel(value: string, empty: string): string {
  const text = value.trim()
  return text ? text : empty
}
const previewTitle = computed(() => isPrimaryLanguage.value
  ? sourceLabel(form.title, 'Links')
  : (translationFields.title.trim() ? translationFields.title.trim() : 'Not translated'))
const publicLinksUrl = computed(() => {
  const base = dashboard.site.value?.public_url || ''
  if (!base) return ''
  const root = base.replace(/\/+$/, '')
  return isPrimaryLanguage.value ? `${root}/links` : `${root}/${translationLocale.value}/links`
})

function serializeState() {
  return JSON.stringify({
    page: {
      title: form.title,
      robots: form.robots,
      seo_title: form.seo_title,
      seo_description: form.seo_description,
    },
    items: items.value.map((item, index) => ({
      id: item.id,
      label: item.label,
      destination: item.destination,
      sort_order: index,
      status: item.status,
    })),
  })
}




async function copyPublicUrl() {
  if (!publicLinksUrl.value) return
  try {
    await navigator.clipboard.writeText(publicLinksUrl.value)
    toast.add({ description: 'Links page URL copied', color: 'success' })
  } catch {
    toast.add({ description: 'Unable to copy the links page URL', color: 'error' })
  }
}

async function save() {
  saving.value = true
  errorMessage.value = ''
  try {
    const payload = {
      page: {
        title: form.title,
        robots: form.robots,
        seo_title: form.seo_title,
        seo_description: form.seo_description,
      },
      items: items.value.map((item, index) => ({
        id: item.id,
        label: item.label,
        destination: item.destination,
        sort_order: index,
        status: item.status,
      })),
    }
    const response = await dashboardApi<{ page: ApiLinksPage; items: ApiLinkItem[] }>(`/api/editor/sites/${siteId}/links-page`, {
      method: 'PATCH',
      body: payload,
      validate: isLinksResponse,
    })
    data.value = response
    await refresh()
    savedSnapshot.value = serializeState()
    toast.add({ description: 'Links page saved', color: 'success' })
  } catch (error) {
    errorMessage.value = error instanceof ApiClientError
      ? error.message
      : error instanceof Error ? error.message : 'Unable to save links page'
    toast.add({ description: errorMessage.value, color: 'error' })
  } finally {
    saving.value = false
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return
  event.preventDefault()
}

if (import.meta.client) {
  onMounted(() => {
    mounted.value = true
    window.addEventListener('beforeunload', handleBeforeUnload)
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', handleBeforeUnload))
}

onBeforeRouteLeave(() => {
  if (!dirty.value || !import.meta.client) return true
  return window.confirm('Discard unsaved links page changes?')
})

// ── Translations (resource_localizations, same API as the editor CRUD) ──
const contentLanguage = useDashboardContentLanguage()
await contentLanguage.load(siteId)
const translationLocale = contentLanguage.locale
const sourceLocale = contentLanguage.sourceLocale
const isPrimaryLanguage = computed(() => translationLocale.value === sourceLocale.value)
const translationFields = reactive({ title: '' })
const translationError = ref<string | null>(null)
const translationSaving = ref(false)
const itemTranslationLabels = reactive<Record<string, string>>({})
const itemTranslationError = ref<string | null>(null)
const itemTranslationSavingId = ref<string | null>(null)
const translationUnavailable = computed(() => Boolean(translationError.value || itemTranslationError.value))

function isTranslationResponse(value: unknown): value is { localization: { values: Record<string, unknown> } } {
  return isRecord(value) && isRecord(value.localization) && isRecord(value.localization.values)
}
async function loadTranslationFields() {
  translationError.value = null
  translationFields.title = ''
  if (!form.id || !translationLocale.value || isPrimaryLanguage.value) return
  try {
    const response = await dashboardApi<{ localization: { values: Record<string, unknown> } }>(
      `/api/editor/sites/${siteId}/localization/site_link_page/${form.id}/${encodeURIComponent(translationLocale.value)}`,
      { validate: isTranslationResponse },
    )
    const values = response.localization.values
    translationFields.title = typeof values.title === 'string' ? values.title : ''
  } catch (cause) {
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode !== 404) translationError.value = cause instanceof Error ? cause.message : 'Failed to load translation'
  }
}
async function loadItemTranslations() {
  itemTranslationError.value = null
  for (const key of Object.keys(itemTranslationLabels)) itemTranslationLabels[key] = ''
  if (!translationLocale.value || isPrimaryLanguage.value) return
  for (const item of items.value) {
    itemTranslationLabels[item.id] = ''
    try {
      const response = await dashboardApi<{ localization: { values: Record<string, unknown> } }>(
        `/api/editor/sites/${siteId}/localization/site_link_item/${item.id}/${encodeURIComponent(translationLocale.value)}`,
        { validate: isTranslationResponse },
      )
      const value = response.localization.values.label
      itemTranslationLabels[item.id] = typeof value === 'string' ? value : ''
    } catch (cause) {
      const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
      if (statusCode !== 404) {
        itemTranslationError.value = cause instanceof Error ? cause.message : 'Failed to load link translations'
        return
      }
    }
  }
}
watch(translationLocale, () => { void loadTranslationFields(); void loadItemTranslations() }, { immediate: true })
watch(() => form.id, () => {
  if (!form.id) return
  if (!translationLocale.value || isPrimaryLanguage.value) return
  void loadTranslationFields()
  void loadItemTranslations()
})
watch(() => items.value.map(item => item.id).join(','), () => { if (translationLocale.value) void loadItemTranslations() })

async function saveTranslation() {
  if (!form.id || !translationLocale.value) return
  translationSaving.value = true
  translationError.value = null
  try {
    const values: Record<string, string> = {}
    if (translationFields.title.trim()) values.title = translationFields.title.trim()
    await dashboardApi(`/api/editor/sites/${siteId}/localization/site_link_page/${form.id}/${encodeURIComponent(translationLocale.value)}`, {
      method: 'PUT',
      body: { values, route_path: `/${translationLocale.value}/links` },
      validate: isRecord,
    })
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    translationError.value = cause instanceof Error ? cause.message : 'Failed to save translation'
  } finally {
    translationSaving.value = false
  }
}

async function saveItemTranslation(item: LinkItem) {
  const label = itemTranslationLabels[item.id]?.trim()
  if (!translationLocale.value || !label) return
  itemTranslationSavingId.value = item.id
  itemTranslationError.value = null
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/localization/site_link_item/${item.id}/${encodeURIComponent(translationLocale.value)}`, {
      method: 'PUT',
      body: { values: { label } },
      validate: isRecord,
    })
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    itemTranslationError.value = cause instanceof Error ? cause.message : 'Failed to save translation'
  } finally {
    itemTranslationSavingId.value = null
  }
}
</script>
