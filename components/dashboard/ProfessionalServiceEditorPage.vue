<template>
  <!--
    With no section open this record is the list's detail column, so it renders
    its rows and nothing else. It becomes the index column only once a section
    is open and the list above yields.
  -->
  <div v-if="frame.mode.value === 'index'" class="space-y-6">
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      :description="errorMessage"
    />
    <div v-if="isNew" class="flex justify-end">
      <UButton :label="createActionLabel" :loading="saving" @click="startOrCreate" />
    </div>
    <EditorNavigationList :groups="navigationGroups" />
  </div>

  <UDashboardPanel v-else id="site-professional-service" :ui="{ body: 'min-h-0 gap-0! overflow-hidden! p-0! sm:p-0!' }">
    <template #header>
      <UDashboardNavbar :title="isNew ? 'New service' : form.name || 'Service'" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="servicesPath" label="Services" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="frame.mode.value === 'pair'"
        show-desktop-detail
        :detail-title="SECTION_LABELS[openKey]"
        :dismiss-to="recordPath"
        show-actions
        :saving="saving"
        :save-disabled="saveDisabled"
        :save-label="saveLabel"
        @cancel="closeDetail"
        @save="saveOpenSection"
      >
        <template #index>
          <UAlert
            v-if="errorMessage"
            class="mb-6"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :description="errorMessage"
          />
          <EditorNavigationList :groups="navigationGroups" :active-item="openKey" />
        </template>

        <template #detail>
          <UFormField v-if="openKey === 'name'" label="Name" required>
            <UInput v-model="form.name" size="xl" maxlength="200" autofocus class="w-full" />
          </UFormField>

          <UFormField
            v-else-if="openKey === 'slug'"
            label="Slug"
            description="The address this service is published at. Left empty, it is derived from the name."
          >
            <UInput v-model="form.slug" size="xl" maxlength="180" autofocus class="w-full" />
          </UFormField>

          <UFormField v-else-if="openKey === 'summary'" label="Summary" description="One line, shown wherever the service is listed.">
            <UTextarea v-model="form.summary" :rows="3" maxlength="500" autoresize autofocus class="w-full" />
          </UFormField>

          <UFormField v-else-if="openKey === 'description'" label="Description">
            <UTextarea v-model="form.short_description" :rows="10" maxlength="1000" autoresize autofocus class="w-full" />
          </UFormField>

          <div v-else-if="openKey === 'ordering'" class="space-y-6">
            <p class="text-base text-muted">Where this service sits among the others, and whether it is singled out.</p>
            <UFormField label="Sort order" description="Lower numbers appear first.">
              <UInputNumber v-model="form.sort_order" :min="0" size="xl" class="w-full" />
            </UFormField>
            <UFormField label="Featured">
              <USwitch v-model="form.featured" />
            </UFormField>
          </div>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import EditorNavigationList, { type EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import { getErrorMessage } from '~/utils/errors'
import {
  isProfessionalServicesResponse,
  professionalServiceCreateBlockers,
  serviceCanonicalPath,
  serviceWritableMedia,
  slugifyServiceName,
  type ProfessionalServiceRow,
} from '~/utils/site-services'

const route = useRoute()
const toast = useToast()
const dashboardApi = useDashboardApi()

// The frame comes first, and before any `await`: `useEditorFrame` provides and
// injects, which Vue binds only while setup is still synchronous.
const serviceId = computed(() => String(route.params.serviceId ?? ''))
const servicesPath = computed(() =>
  `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/professional-services`)
const recordPath = computed(() => `${servicesPath.value}/${serviceId.value}`)
const frame = useEditorFrame(recordPath)

const siteId = await useDashboardSiteId()
const isNew = computed(() => serviceId.value === 'new')

const SECTION_LABELS = {
  name: 'Name',
  slug: 'Slug',
  summary: 'Summary',
  description: 'Description',
  ordering: 'Ordering',
} as const
type SectionKey = keyof typeof SECTION_LABELS

const detailKey = computed(() => frame.childSegment.value)
/** With nothing open the pane still shows the first section rather than empty space. */
const openKey = computed<SectionKey>(() => (detailKey.value ?? 'name') as SectionKey)

watchEffect(() => {
  if (frame.rest.value.length > 1 || (detailKey.value && !(detailKey.value in SECTION_LABELS))) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})

/**
 * The draft outlives any one leaf. Moving between sections remounts this
 * component, so a plain `reactive` here loses the name on the way to the
 * summary. `useState` is keyed to the record, so a half-filled new service
 * survives the walk between its own sections and is discarded when a different
 * record is opened.
 */
const form = useState(`professional-service-draft-${siteId}-${serviceId.value}`, () => ({
  name: '',
  slug: '',
  summary: '',
  short_description: '',
  sort_order: 0,
  featured: false,
})).value

const saving = ref(false)
const errorMessage = ref('')

/**
 * There is no per-record endpoint: the list is read whole and written whole.
 * The record shares the list's cache key, not a key of its own — in pair mode
 * both are mounted at once, so a second key would leave the index column
 * showing the name and summary this screen has just replaced.
 */
const { data, refresh } = await useAsyncData(
  `dashboard-professional-services-${siteId}`,
  () => dashboardApi(`/api/editor/sites/${siteId}/professional-services`, { validate: isProfessionalServicesResponse }),
  { server: false },
)

/**
 * The API representation is kept exactly as loaded. Saving sends every row
 * back, so coercing null to '' here would rewrite the untouched rows' nulls as
 * empty strings the first time any one service is saved. Only the row this
 * screen has open is coerced, and only onto its own form.
 */
const offerings = computed<ProfessionalServiceRow[]>(() => data.value?.offerings ?? [])
const record = computed(() => offerings.value.find(row => row.id === serviceId.value) ?? null)

watch(record, (row) => {
  if (!row) return
  Object.assign(form, {
    name: row.name,
    slug: row.slug,
    summary: row.summary ?? '',
    short_description: row.short_description ?? '',
    sort_order: row.sort_order,
    featured: row.featured,
  })
}, { immediate: true })

/**
 * A new service lands after the ones already filed rather than at the top. It
 * is seeded once, when the list arrives, so a position the owner then chose is
 * not overwritten by the next refresh.
 */
const orderSeeded = useState(`professional-service-order-${siteId}-${serviceId.value}`, () => false)
watch(data, (loaded) => {
  if (!isNew.value || orderSeeded.value || !loaded) return
  form.sort_order = loaded.offerings.length
  orderSeeded.value = true
}, { immediate: true })

const blockers = computed(() => professionalServiceCreateBlockers(form))

function summaryOf(value: string, empty: string) {
  return value.trim() || empty
}

const navigationGroups = computed<EditorNavigationGroup[]>(() => [
  {
    id: 'service',
    label: 'Service',
    items: [
      { id: 'name', label: 'Name', summary: summaryOf(form.name, 'Not named yet'), icon: 'i-lucide-briefcase', to: `${recordPath.value}/name` },
      { id: 'slug', label: 'Slug', summary: summaryOf(form.slug, `Derived from the name${form.name.trim() ? `: ${slugifyServiceName(form.name)}` : ''}`), icon: 'i-lucide-link', to: `${recordPath.value}/slug` },
      { id: 'summary', label: 'Summary', summary: summaryOf(form.summary, 'No summary yet'), icon: 'i-lucide-text', to: `${recordPath.value}/summary` },
      { id: 'description', label: 'Description', summary: summaryOf(form.short_description, 'Nothing written yet'), icon: 'i-lucide-align-left', to: `${recordPath.value}/description` },
    ],
  },
  {
    id: 'placement',
    label: 'Placement',
    items: [
      { id: 'ordering', label: 'Ordering', summary: `${form.featured ? 'Featured' : 'Not featured'} · position ${form.sort_order}`, icon: 'i-lucide-arrow-up-down', to: `${recordPath.value}/ordering` },
    ],
  },
])

/**
 * Creating walks the sections the endpoint will not accept empty, naming where
 * it is going, and writes once nothing is outstanding. Slug is in the order but
 * is usually walked straight through: an empty one is derived from the name,
 * and it is asked for only when there is nothing to derive. Only this level
 * walks an order, because only this level creates.
 */
const REQUIRED_ORDER: SectionKey[] = ['name', 'slug']
const outstanding = computed(() => {
  const names = new Set(blockers.value)
  return REQUIRED_ORDER.filter(key => names.has(SECTION_LABELS[key]))
})
const nextOutstanding = computed(() => outstanding.value.find(key => key !== openKey.value) ?? null)

const createActionLabel = computed(() => {
  const next = outstanding.value[0]
  return next ? `Start with ${SECTION_LABELS[next]}` : 'Create service'
})

function startOrCreate() {
  const next = outstanding.value[0]
  if (next) return void navigateTo(`${recordPath.value}/${next}`)
  void saveOpenSection()
}

/**
 * The open section's own value is the only thing that can block its commit —
 * and it blocks an existing record as well as a new one, because a name can be
 * emptied, and a slug the endpoint cannot accept can be typed, long after the
 * service was created.
 */
const openSectionIncomplete = computed(() => outstanding.value.includes(openKey.value))
const saveDisabled = computed(() => saving.value || openSectionIncomplete.value)

const saveLabel = computed(() => {
  if (!isNew.value) return undefined
  return nextOutstanding.value ? `Next: ${SECTION_LABELS[nextOutstanding.value]}` : 'Create service'
})

/**
 * The endpoint takes the whole list and upserts it, so the edited row is merged
 * back into it and the rest is sent exactly as it was loaded — same fields,
 * same nulls. A row whose slug does not exist yet is inserted, which is how
 * creating here needs no second endpoint.
 */
async function saveOpenSection() {
  if (saveDisabled.value) return
  if (isNew.value && nextOutstanding.value) {
    await navigateTo(`${recordPath.value}/${nextOutstanding.value}`)
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    const name = form.name.trim()
    const slug = form.slug.trim() || slugifyServiceName(name)
    const edited = {
      name,
      slug,
      summary: form.summary,
      short_description: form.short_description,
      sort_order: form.sort_order,
      featured: form.featured,
    }
    const next = isNew.value
      ? [...offerings.value, { ...edited, id: '' } as ProfessionalServiceRow]
      : offerings.value.map(row => row.id === serviceId.value ? { ...row, ...edited } : row)
    await dashboardApi(`/api/editor/sites/${siteId}/professional-services`, {
      method: 'PATCH',
      body: {
        // A new row carries no id; the upsert mints one for an unseen slug.
        // `schema_type`, `canonical_path` and `source` are required by the upsert
        // and belong to the record, so every row carries its own back unchanged
        // — including the rows this screen did not touch. Media rides along for
        // the same reason: omitting it clears an offering's placements.
        offerings: next.map(row => ({
          ...(row.id ? { id: row.id } : {}),
          name: row.name,
          slug: row.slug,
          summary: row.summary,
          short_description: row.short_description,
          sort_order: row.sort_order,
          featured: row.featured,
          schema_type: row.schema_type,
          canonical_path: row.canonical_path ?? serviceCanonicalPath(row.slug),
          source: row.source ?? 'dashboard',
          ...(serviceWritableMedia(row.media).length ? { media: serviceWritableMedia(row.media) } : {}),
        })),
      },
      validate: (value): value is Record<string, unknown> => isRecord(value),
    })
    if (isNew.value) {
      await refresh()
      const created = offerings.value.find(row => row.slug === slug)
      // The draft is keyed to `new`, so it would greet the next service with
      // this one's answers if it were left behind.
      Object.assign(form, { name: '', slug: '', summary: '', short_description: '', sort_order: 0, featured: false })
      orderSeeded.value = false
      toast.add({ description: 'Service created', color: 'success' })
      await navigateTo(created ? `${servicesPath.value}/${created.id}` : servicesPath.value)
      return
    }
    await refresh()
    toast.add({ description: `${SECTION_LABELS[openKey.value]} saved`, color: 'success' })
    await navigateTo(recordPath.value)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Unable to save services')
  } finally {
    saving.value = false
  }
}

function closeDetail() {
  const row = record.value
  if (row) {
    Object.assign(form, {
      name: row.name,
      slug: row.slug,
      summary: row.summary ?? '',
      short_description: row.short_description ?? '',
      sort_order: row.sort_order,
      featured: row.featured,
    })
  }
  void navigateTo(recordPath.value)
}

useSeoMeta({ title: 'Service | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
