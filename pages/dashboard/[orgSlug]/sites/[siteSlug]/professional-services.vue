<template>
  <div class="space-y-6">
    <DashboardListEditor
      v-model:editing="editing"
      title="Services and practice areas"
      description="The structured offerings referenced by canonical tenant-page blocks."
      :items="listItems"
      empty-title="No services yet"
      empty-icon="i-lucide-briefcase"
      :pending="pending"
      :error="loadError || null"
      add-label="Add a service"
      @add="openNew"
      @open="openExisting"
    >
      <template #item="{ item }">
        <div class="flex items-center gap-2">
          <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
          <UBadge v-if="item.row.featured" color="neutral" variant="soft" size="sm">featured</UBadge>
        </div>
        <p class="mt-1 truncate text-sm text-muted">{{ item.row.summary || 'No summary yet' }}</p>
      </template>
    </DashboardListEditor>

    <!--
      The same upsert the MCP writes through: a row whose slug does not exist
      yet is inserted, so creating a service here needs no second endpoint.
    -->
    <DashboardListItemDialog
      v-model:open="dialogOpen"
      :title="editingId ? 'Edit service' : 'Add a service'"
      :save-disabled="!itemForm.name.trim()"
      :saving="saving"
      @save="saveItem"
    >
      <UFormField label="Name" required>
        <UInput v-model="itemForm.name" autofocus class="w-full" />
      </UFormField>
      <UFormField label="Slug" required>
        <UInput v-model="itemForm.slug" class="w-full" />
      </UFormField>
      <UFormField label="Summary">
        <UTextarea v-model="itemForm.summary" :rows="3" autoresize class="w-full" />
      </UFormField>
      <UFormField label="Description">
        <UTextarea v-model="itemForm.short_description" :rows="4" autoresize class="w-full" />
      </UFormField>
      <UFormField label="Sort order" description="Lower numbers appear first.">
        <UInputNumber v-model="itemForm.sort_order" :min="0" class="w-full" />
      </UFormField>
      <UFormField label="Featured">
        <USwitch v-model="itemForm.featured" />
      </UFormField>
    </DashboardListItemDialog>
  </div>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import DashboardListItemDialog from '~/components/dashboard/DashboardListItemDialog.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.services' })

useSeoMeta({ title: 'Services | KrabiClaw Dashboard', robots: 'noindex, nofollow' })

interface Offering {
  id: string
  name: string
  slug: string
  summary: string
  short_description: string
  sort_order: number
  featured: boolean
}
interface Response { offerings: Offering[] }

const dashboardApi = useDashboardApi()
const siteId = await useDashboardSiteId()
const isResponse = (value: unknown): value is Response => isRecord(value) && Array.isArray(value.offerings)

// `useAsyncData`, not `onMounted(load)`. The hook this replaces was registered
// after the `await` above, so Vue never bound it to this instance: it never
// fired, `pending` stayed true, and the page showed its skeletons forever while
// the tenant's offerings sat one request away.
const { data, pending, error: loadRequestError, refresh } = await useAsyncData(
  `professional-services-${siteId}`,
  () => dashboardApi<Response>(`/api/editor/sites/${siteId}/professional-services`, { validate: isResponse }),
  { server: false },
)

const saving = ref(false)
const saveError = ref('')
const editing = ref(false)
const dialogOpen = ref(false)
const editingId = ref<string | null>(null)

const loadError = computed(() => saveError.value
  || (loadRequestError.value ? getErrorMessage(loadRequestError.value, 'Unable to load services') : ''))

// The API representation is kept exactly as loaded. `saveItem` sends every row
// back, so coercing null to '' here would rewrite the untouched rows' nulls as
// empty strings the first time any one service is edited.
const offerings = computed<Offering[]>(() => data.value?.offerings ?? [])

const listItems = computed(() => offerings.value.map(row => ({ id: row.id, title: row.name, row })))

const itemForm = reactive({ name: '', slug: '', summary: '', short_description: '', sort_order: 0, featured: false })

/** A slug the tenant did not choose is derived from the name, as the importer does. */
function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180)
}

function openNew() {
  editingId.value = null
  Object.assign(itemForm, {
    name: '',
    slug: '',
    summary: '',
    short_description: '',
    sort_order: offerings.value.length,
    featured: false,
  })
  dialogOpen.value = true
}

function openExisting(item: { id: string; row: Offering }) {
  const row = item.row
  editingId.value = row.id
  Object.assign(itemForm, {
    name: row.name,
    slug: row.slug,
    summary: row.summary ?? '',
    short_description: row.short_description ?? '',
    sort_order: row.sort_order,
    featured: row.featured,
  })
  dialogOpen.value = true
}

/**
 * The endpoint takes the whole list, so the edited row is merged back into it
 * and the rest is sent unchanged. One row is edited at a time; nothing else on
 * screen holds unsaved state.
 */
async function saveItem() {
  saving.value = true
  saveError.value = ''
  try {
    const name = itemForm.name.trim()
    const slug = itemForm.slug.trim() || slugify(name)
    const edited = { ...itemForm, name, slug }
    const next = editingId.value
      ? offerings.value.map(row => row.id === editingId.value ? { ...row, ...edited } : row)
      : [...offerings.value, { ...edited, id: '' } as Offering]
    await dashboardApi(`/api/editor/sites/${siteId}/professional-services`, {
      method: 'PATCH',
      body: {
        // A new row carries no id; the upsert mints one for an unseen slug.
        offerings: next.map(({ id, name, slug, summary, short_description, sort_order, featured }) =>
          ({ ...(id ? { id } : {}), name, slug, summary, short_description, sort_order, featured })),
      },
      validate: (value): value is Record<string, unknown> => isRecord(value),
    })
    await refresh()
    dialogOpen.value = false
    editingId.value = null
  } catch (cause) {
    saveError.value = getErrorMessage(cause, 'Unable to save services')
  } finally {
    saving.value = false
  }
}
</script>
