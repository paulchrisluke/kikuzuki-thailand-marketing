<template>
  <div class="space-y-6">
  <DashboardListEditor
    v-model:editing="editing"
    title="Q&A"
    description="Add common guest questions, then answer them once."
    :items="listItems"
    :pending="loading"
    :error="loadError"
    empty-title="No Q&A yet"
    empty-icon="i-lucide-circle-help"
    add-label="Add a question"
    :addable="translationLocale === sourceLocale"
    :removable="translationLocale === sourceLocale"
    :reorderable="translationLocale === sourceLocale"
    :removing-id="removingId"
    @add="openNew"
    @open="openExisting"
    @remove="removeItem"
    @move="moveQa"
  >
    <template #item="{ item }">
      <div class="flex flex-wrap items-center gap-2">
        <UBadge :color="item.row.status === 'published' ? 'success' : 'neutral'" variant="soft">{{ item.row.status }}</UBadge>
        <span class="text-xs text-muted">{{ item.row.upvote_count }} upvotes</span>
      </div>
      <p class="mt-2 text-sm font-semibold text-highlighted">
        {{ translationLocale === sourceLocale ? item.row.question : `Source: ${item.row.question}` }}
      </p>
      <p class="mt-1 line-clamp-2 text-sm text-muted" :class="item.row.answer ? '' : 'italic'">
        {{ translationLocale === sourceLocale ? (item.row.answer || 'No answer yet.') : 'Open to translate' }}
      </p>
    </template>
  </DashboardListEditor>

  <DashboardListItemDialog
    v-model:open="dialogOpen"
    :title="editingId ? 'Edit question' : 'Add a question'"
    :removable="Boolean(editingId) && translationLocale === sourceLocale"
    :saving="translationLocale === sourceLocale ? saving : translationSaving"
    :removing="removingId === editingId"
    :save-disabled="!locationId || (translationLocale === sourceLocale ? !form.question.trim() : translationSaving)"
    @save="translationLocale === sourceLocale ? saveQa() : saveTranslation()"
    @remove="removeEditing"
  >
    <template v-if="translationLocale === sourceLocale">
      <UFormField label="Question">
        <UTextarea v-model="form.question" :rows="3" placeholder="Do you accept walk-ins?" autofocus class="w-full" />
      </UFormField>
      <UFormField label="Answer">
        <UTextarea v-model="form.answer" :rows="4" placeholder="Yes, walk-ins are welcome when seats are available." class="w-full" />
      </UFormField>
      <UCheckbox v-if="editingId" v-model="form.published" label="Published" />
    </template>
    <template v-else>
      <p class="text-xs text-muted">Primary ({{ sourceLocale }}): {{ form.question }}</p>
      <UFormField label="Question">
        <UTextarea v-model="translationFields.question" :rows="3" class="w-full" />
      </UFormField>
      <UFormField label="Answer">
        <UTextarea v-model="translationFields.answer" :rows="4" class="w-full" />
      </UFormField>
      <p v-if="translationError" class="text-sm text-error">{{ translationError }}</p>
    </template>
  </DashboardListItemDialog>
  </div>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'

const dashboardApi = useDashboardApi()
definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.qa' })


interface QaRow {
  id: string
  question: string
  answer: string | null
  status: string
  source: string
  upvote_count: number
  sort_order: number
}

const siteId = await useDashboardSiteId()
const contentLanguage = useDashboardContentLanguage()
await contentLanguage.load(siteId)
const dashboardLocation = useDashboardLocation()
const toast = useToast()
const locationId = computed(() => dashboardLocation.currentLocationId.value)
const qaRows = ref<QaRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const saving = ref(false)
const form = reactive({ question: '', answer: '', published: true })

const listItems = computed(() => qaRows.value.map(row => ({ id: row.id, title: row.question, row })))

const { editing, dialogOpen, editingId, removingId, openNew: openPrimaryQuestion, openExisting, close, removeItem, removeEditing } = useListEditor<QaRow>({
  find: id => qaRows.value.find(row => row.id === id) ?? null,
  fill: (row) => {
    form.question = row.question
    form.answer = row.answer ?? ''
    form.published = row.status === 'published'
  },
  clear: () => {
    form.question = ''
    form.answer = ''
    form.published = true
  },
  destroy: async (id) => {
    if (!locationId.value) return
    try {
      await dashboardApi(`/api/editor/sites/${siteId}/locations/${locationId.value}/qa/${id}`, {
        method: 'DELETE',
        validate: (value): value is { deleted: true } => isRecord(value) && value.deleted === true,
      })
      await loadQa()
    } catch (error) {
      toast.add({ description: error instanceof Error ? error.message : 'Failed to remove question', color: 'error' })
      // Rethrow so the sheet stays open on the record that is still there.
      // Swallowing it here let useListEditor treat the delete as done and close
      // over a row the server had refused to remove.
      throw error
    }
  },
})

function openNew() {
  if (translationLocale.value !== sourceLocale.value) {
    toast.add({ description: `Switch to ${sourceLocale.value} to add a new question`, color: 'warning' })
    return
  }
  openPrimaryQuestion()
}
const requestEvent = useRequestEvent()
const {
  data: qaResource,
  error: qaResourceError,
  pending: qaPending,
  refresh: refreshQa,
} = await useAsyncData(
  computed(() => `dashboard-location-qa-${siteId}-${locationId.value ?? 'missing'}`),
  async () => {
    if (!locationId.value) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
    if (import.meta.server) {
      if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
      const { loadDashboardLocationQa } = await import('~/server/utils/dashboard-editor-resources')
      return await loadDashboardLocationQa(requestEvent, siteId, locationId.value)
    }
    return await dashboardApi<{ qa: QaRow[] }>(
      `/api/editor/sites/${siteId}/locations/${locationId.value}/qa`,
      {
        validate: (value): value is { qa: QaRow[] } =>
          isRecord(value)
          && Array.isArray(value.qa)
          && value.qa.every(row => isRecord(row) && typeof row.id === 'string'),
      },
    )
  },
)
watch(qaResource, value => {
  if (value) qaRows.value = value.qa
}, { immediate: true })
watch([qaPending, qaResourceError], () => {
  loading.value = qaPending.value
  loadError.value = qaResourceError.value?.message ?? null
}, { immediate: true })

async function loadQa() {
  if (!locationId.value) {
    qaRows.value = []
    loading.value = false
    return
  }
  loading.value = true
  loadError.value = null
  try {
    await refreshQa()
    if (qaResourceError.value) throw qaResourceError.value
    if (!qaResource.value) throw new Error('Q&A response unavailable')
    qaRows.value = qaResource.value.qa
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'Failed to load Q&A'
  } finally {
    loading.value = false
  }
}


// ── Translations (resource_localizations, same API as the editor CRUD) ──
const translationLocale = contentLanguage.locale
const sourceLocale = contentLanguage.sourceLocale
const translationFields = reactive({ question: '', answer: '' })
const translationError = ref<string | null>(null)
const translationSaving = ref(false)
function isQaTranslationResponse(value: unknown): value is { localization: { values: Record<string, unknown> } } {
  return isRecord(value) && isRecord(value.localization) && isRecord(value.localization.values)
}
async function loadTranslationFields(qaId: string) {
  translationError.value = null
  const locale = translationLocale.value
  if (!locale || locale === sourceLocale.value) return
  try {
    const response = await dashboardApi<{ localization: { values: Record<string, unknown> } }>(
      `/api/editor/sites/${siteId}/localization/location_qa/${qaId}/${encodeURIComponent(locale)}`,
      { validate: isQaTranslationResponse },
    )
    const values = response.localization.values
    translationFields.question = typeof values.question === 'string' ? values.question : ''
    translationFields.answer = typeof values.answer === 'string' ? values.answer : ''
  } catch (cause) {
    const statusCode = isRecord(cause) && typeof cause.statusCode === 'number' ? cause.statusCode : null
    if (statusCode !== 404) translationError.value = cause instanceof Error ? cause.message : 'Failed to load translation'
    translationFields.question = ''; translationFields.answer = ''
  }
}
watch(translationLocale, () => {
  if (editingId.value && translationLocale.value && translationLocale.value !== sourceLocale.value) void loadTranslationFields(editingId.value)
})
watch(editingId, (id) => {
  if (id && translationLocale.value && translationLocale.value !== sourceLocale.value) void loadTranslationFields(id)
})
async function saveTranslation() {
  if (!editingId.value || !translationLocale.value || translationLocale.value === sourceLocale.value) return
  translationSaving.value = true; translationError.value = null
  try {
    const values: Record<string, string> = {}
    if (translationFields.question.trim()) values.question = translationFields.question.trim()
    if (translationFields.answer.trim()) values.answer = translationFields.answer.trim()
    await dashboardApi(`/api/editor/sites/${siteId}/localization/location_qa/${editingId.value}/${encodeURIComponent(translationLocale.value)}`, {
      method: 'PUT',
      body: { values },
      validate: isRecord,
    })
    toast.add({ description: 'Translation saved', color: 'success' })
  } catch (cause) {
    translationError.value = cause instanceof Error ? cause.message : 'Failed to save translation'
  } finally {
    translationSaving.value = false
  }
}

async function saveQa() {
  if (!locationId.value) return
  saving.value = true
  try {
    if (editingId.value) {
      await dashboardApi(`/api/editor/sites/${siteId}/locations/${locationId.value}/qa/${editingId.value}`, {
        method: 'PATCH',
        body: { question: form.question, answer: form.answer || null, is_owner_answer: 1, status: form.published ? 'published' : 'hidden' },
        validate: (value): value is { updated: true; qa_id: string } =>
          isRecord(value) && value.updated === true && typeof value.qa_id === 'string',
      })
      toast.add({ description: 'Q&A updated', color: 'success' })
    } else {
      await dashboardApi(`/api/editor/sites/${siteId}/locations/${locationId.value}/qa`, {
        method: 'POST',
        body: { question: form.question, answer: form.answer || null, is_owner_answer: 1 },
        validate: (value): value is QaRow =>
          isRecord(value)
          && typeof value.id === 'string'
          && typeof value.question === 'string'
          && typeof value.sort_order === 'number',
      })
      toast.add({ description: 'Q&A added', color: 'success' })
    }
    close()
    await loadQa()
  } catch (error) {
    toast.add({ description: error instanceof Error ? error.message : 'Failed to save Q&A', color: 'error' })
  } finally {
    saving.value = false
  }
}



async function moveQa(item: { id: string }, direction: -1 | 1) {
  if (!locationId.value) return
  const currentIndex = qaRows.value.findIndex(row => row.id === item.id)
  if (currentIndex === -1) return
  const current = qaRows.value[currentIndex]
  if (!current) return
  const targetIndex = currentIndex + direction
  if (targetIndex < 0 || targetIndex >= qaRows.value.length) return
  const target = qaRows.value[targetIndex]
  if (!target) return
  try {
    await dashboardApi(`/api/editor/sites/${siteId}/locations/${locationId.value}/qa/reorder`, {
      method: 'POST',
      body: {
        updates: [
          { id: current.id, sort_order: target.sort_order },
          { id: target.id, sort_order: current.sort_order }
        ]
      },
      validate: (value): value is { updated: number } =>
        isRecord(value) && typeof value.updated === 'number',
    })
    toast.add({ description: 'Q&A reordered', color: 'success' })
    await loadQa()
  } catch (error) {
    toast.add({ description: error instanceof Error ? error.message : 'Failed to reorder Q&A', color: 'error' })
  }
}


// A different location has a different list, so anything the old one had open
// goes with it. Blanking the fields while leaving the sheet up meant a Save
// would have written the previous location's draft against the new one.
watch(locationId, () => {
  editing.value = false
  close()
})

useSeoMeta({ title: 'Q&A | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
