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

          <UFormField
            v-else-if="openKey === 'schema_type'"
            label="Schema.org type"
            description="The type search engines are told this service is, written as schema.org spells it — LegalService, AccountingService, MedicalBusiness."
            required
          >
            <UInput v-model="form.schema_type" size="xl" maxlength="120" autofocus class="w-full" />
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
  derivedServiceSlug,
  isProfessionalServicesResponse,
  isProfessionalServiceWriteResponse,
  professionalServicesKey,
  professionalServiceCreateBlockers,
  type ProfessionalServiceRow,
} from '~/utils/site-services'

const route = useRoute()
const toast = useToast()
const dashboardApi = useDashboardApi()

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
  schema_type: 'Schema type',
  ordering: 'Ordering',
} as const
type SectionKey = keyof typeof SECTION_LABELS

const detailKey = computed(() => frame.childSegment.value)
/** With nothing open the pane still shows the first section rather than empty space. */
const openKey = computed<SectionKey>(() => (detailKey.value ?? 'name') as SectionKey)

watchEffect(() => {
  if (frame.rest.value.length > 1 || (detailKey.value && !(detailKey.value in SECTION_LABELS)) || (isNew.value && detailKey.value === 'ordering')) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})

function emptyDraft() {
  return { name: '', slug: '', summary: '', short_description: '', schema_type: '', sort_order: 0, featured: false }
}

// Keyed to the record so the draft survives the remount between sections.
const form = useState(`professional-service-draft-${siteId}-${serviceId.value}`, emptyDraft).value

const saving = ref(false)
const errorMessage = ref('')

// Its own key: two useAsyncData on one key leave the second's `pending` stuck.
// A save refreshes the list's entry as well, so the index column follows.
const { data, refresh } = await useAsyncData(
  () => `dashboard-professional-service-${siteId}-${serviceId.value}`,
  () => dashboardApi(`/api/editor/sites/${siteId}/professional-services`, { validate: isProfessionalServicesResponse }),
  { server: false },
)

const offerings = computed<ProfessionalServiceRow[]>(() => data.value?.offerings ?? [])
const record = computed(() => offerings.value.find(row => row.id === serviceId.value) ?? null)

function loadForm(row: ProfessionalServiceRow) {
  Object.assign(form, {
    name: row.name,
    slug: row.slug,
    summary: row.summary ?? '',
    short_description: row.short_description ?? '',
    schema_type: row.schema_type ?? '',
    sort_order: row.sort_order,
    featured: row.featured,
  })
}
watch(record, (row) => { if (row) loadForm(row) }, { immediate: true })

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
      { id: 'slug', label: 'Slug', summary: summaryOf(form.slug, `Derived from the name${form.name.trim() ? `: ${derivedServiceSlug(form.name)}` : ''}`), icon: 'i-lucide-link', to: `${recordPath.value}/slug` },
      { id: 'summary', label: 'Summary', summary: summaryOf(form.summary, 'No summary yet'), icon: 'i-lucide-text', to: `${recordPath.value}/summary` },
      { id: 'description', label: 'Description', summary: summaryOf(form.short_description, 'Nothing written yet'), icon: 'i-lucide-align-left', to: `${recordPath.value}/description` },
    ],
  },
  {
    id: 'placement',
    label: 'Placement',
    items: [
      { id: 'schema_type', label: 'Schema type', summary: summaryOf(form.schema_type, 'Not set'), icon: 'i-lucide-tag', to: `${recordPath.value}/schema_type` },
      // A new service is filed after the existing ones by the endpoint; its position is a section once it exists.
      ...(isNew.value ? [] : [{ id: 'ordering', label: 'Ordering', summary: `${form.featured ? 'Featured' : 'Not featured'} · position ${form.sort_order}`, icon: 'i-lucide-arrow-up-down', to: `${recordPath.value}/ordering` }]),
    ],
  },
])

const { createActionLabel, saveLabel, saveDisabled, save: saveOpenSection, startOrCreate } = useCreateWalk({
  recordPath,
  isNew,
  openKey,
  labels: SECTION_LABELS,
  order: ['name', 'slug', 'schema_type'],
  missing: key => blockers.value.some(section => section === key),
  noun: 'service',
  saving,
  commit,
})

async function commit() {
  // The form holds the row it was loaded from; with no row it holds blank
  // defaults, and saving would write those over the stored service.
  if (!isNew.value && !record.value) {
    errorMessage.value = 'This service could not be loaded, so it cannot be saved.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    // Only the fields this screen edits; the endpoint keeps every other column.
    const written = await dashboardApi(`/api/editor/sites/${siteId}/professional-services`, {
      method: 'PATCH',
      body: {
        offerings: [{
          ...(isNew.value ? {} : { id: serviceId.value }),
          name: form.name.trim(),
          ...(form.slug.trim() ? { slug: form.slug.trim() } : {}),
          summary: form.summary,
          short_description: form.short_description,
          schema_type: form.schema_type.trim(),
          ...(isNew.value ? {} : { featured: form.featured, sort_order: form.sort_order }),
        }],
      },
      validate: isProfessionalServiceWriteResponse,
    })
    await Promise.all([refresh(), refreshNuxtData(professionalServicesKey(siteId))])
    if (isNew.value) {
      const [createdId] = written.offering_ids
      if (!createdId) throw new Error('The service was not created.')
      Object.assign(form, emptyDraft())
      toast.add({ description: 'Service created', color: 'success' })
      await navigateTo(`${servicesPath.value}/${createdId}`)
      return
    }
    toast.add({ description: `${SECTION_LABELS[openKey.value]} saved`, color: 'success' })
    await navigateTo(recordPath.value)
  } catch (error) {
    errorMessage.value = getErrorMessage(error, 'Unable to save services')
  } finally {
    saving.value = false
  }
}

function closeDetail() {
  if (record.value) loadForm(record.value)
  void navigateTo(recordPath.value)
}

useSeoMeta({ title: 'Service | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
