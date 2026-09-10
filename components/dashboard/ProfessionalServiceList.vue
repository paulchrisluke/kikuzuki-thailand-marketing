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
  </div>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import { getErrorMessage } from '~/utils/errors'
import { isProfessionalServicesResponse, type ProfessionalServiceRow } from '~/utils/site-services'

const route = useRoute()
const dashboardApi = useDashboardApi()
const siteId = await useDashboardSiteId()

// `useAsyncData`, not `onMounted(load)`. The hook this replaces was registered
// after the `await` above, so Vue never bound it to this instance: it never
// fired, `pending` stayed true, and the page showed its skeletons forever while
// the tenant's offerings sat one request away.
const { data, pending, error: loadRequestError } = await useAsyncData(
  `dashboard-professional-services-${siteId}`,
  () => dashboardApi(`/api/editor/sites/${siteId}/professional-services`, { validate: isProfessionalServicesResponse }),
  { server: false },
)

const editing = ref(false)

const loadError = computed(() =>
  loadRequestError.value ? getErrorMessage(loadRequestError.value, 'Unable to load services') : '')

const offerings = computed<ProfessionalServiceRow[]>(() => data.value?.offerings ?? [])
const listItems = computed(() => offerings.value.map(row => ({ id: row.id, title: row.name, row })))

const servicesPath = computed(() =>
  `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/professional-services`)

// A service opens its own level rather than a sheet over the list, so the
// record has a URL and adding and editing are the same screen.
function openNew() {
  void navigateTo(`${servicesPath.value}/new`)
}

function openExisting(item: { id: string }) {
  void navigateTo(`${servicesPath.value}/${item.id}`)
}
</script>
