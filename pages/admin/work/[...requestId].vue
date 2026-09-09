<template>
  <UDashboardPanel id="admin-work" :ui="{ body: 'min-h-0 gap-0! overflow-hidden! p-0! sm:p-0!' }">
    <template #header>
      <UDashboardNavbar title="Work Queue">
        <template #trailing><UButton icon="i-lucide-refresh-cw" aria-label="Refresh work queue" color="neutral" variant="ghost" size="xs" :loading="loading" @click="loadWorkRequests" /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="Boolean(selectedRequest)"
        :detail-title="selectedRequest?.title"
        :dismiss-to="workDismissUrl"
        :show-actions="Boolean(selectedRequest)"
        :saving="saving"
        @cancel="closeRequest"
        @save="saveRequest"
      >
        <template #index>
          <div class="space-y-5">
            <UCheckbox v-model="showDone" label="Show completed" @update:model-value="updateDoneFilter" />
            <UCard v-if="loading" variant="subtle"><div class="space-y-3"><USkeleton v-for="index in 5" :key="index" class="h-16 rounded-lg" /></div></UCard>
            <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />
            <UCard v-else-if="requests.length === 0" variant="subtle">
              <div class="py-4 text-center"><UIcon name="i-lucide-list-todo" class="mx-auto mb-3 size-10 text-muted" /><p class="font-semibold text-highlighted">No work requests</p><p class="mt-1 text-sm text-muted">Growth clients submit priority-support requests from their dashboard or ChowBot.</p></div>
            </UCard>
            <EditorNavigationList v-else :groups="navigationGroups" :active-item="selectedRequest?.id" variant="rows" />
          </div>
        </template>

        <template #detail>
          <div v-if="selectedRequest" class="space-y-6">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="selectedRequest.priority" :color="priorityColor(selectedRequest.priority)" variant="soft" class="capitalize" />
              <UBadge :label="selectedRequest.source" color="neutral" variant="soft" />
              <span class="text-xs text-muted">{{ formatDate(selectedRequest.created_at) }}</span>
            </div>
            <div>
              <p class="font-medium text-highlighted">{{ selectedRequest.org_name }}</p>
              <p v-if="selectedRequest.brand_name" class="mt-1 text-sm text-muted">{{ selectedRequest.brand_name }}</p>
              <p v-if="selectedRequest.description" class="mt-2 whitespace-pre-wrap text-sm text-default">{{ selectedRequest.description }}</p>
            </div>
            <UFormField label="Status">
              <USelect v-model="draftStatus" :items="statusItems" class="w-full" />
            </UFormField>
            <UFormField label="Internal notes">
              <UTextarea v-model="draftNotes" :rows="7" placeholder="Add operational context for the next person." />
            </UFormField>
            <UButton v-if="selectedRequest.org_slug" label="Open workspace" icon="i-lucide-external-link" color="neutral" variant="soft" :to="`/dashboard/${selectedRequest.org_slug}`" target="_blank" />
          </div>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'
import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
const { formatDate } = useLocaleDate()

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Work Queue | KrabiClaw Admin', robots: 'noindex, nofollow' })

interface WorkRequest {
  id: string; type: string; title: string; description: string | null
  status: string; priority: string; source: string; notes: string | null
  org_name: string; org_slug: string | null; brand_name: string | null
  created_at: string; completed_at: string | null
}

const isWorkRequestsResponse = (value: unknown): value is { requests: WorkRequest[] } =>
  isRecord(value) && Array.isArray(value.requests) && value.requests.every(request =>
    isRecord(request) && typeof request.id === 'string' && typeof request.type === 'string'
    && typeof request.title === 'string' && (request.description === null || typeof request.description === 'string')
    && typeof request.status === 'string' && typeof request.priority === 'string' && typeof request.source === 'string'
    && (request.notes === null || typeof request.notes === 'string') && typeof request.org_name === 'string'
    && (request.org_slug === null || typeof request.org_slug === 'string')
    && (request.brand_name === null || typeof request.brand_name === 'string')
    && typeof request.created_at === 'string' && (request.completed_at === null || typeof request.completed_at === 'string'),
  )

const statusItems = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Cancelled', value: 'cancelled' },
]
const priorityColors: Record<string, 'error' | 'warning' | 'neutral' | 'success'> = { urgent: 'error', high: 'warning', normal: 'neutral', low: 'success' }

const route = useRoute()
if (Array.isArray(route.params.requestId) && route.params.requestId.length > 1) {
  throw createError({ statusCode: 404, statusMessage: 'Work request route not found' })
}
const toast = useToast()
const requests = ref<WorkRequest[]>([])
const loading = ref(true)
const loadError = ref('')
const saving = ref(false)
const showDone = ref(false)
const draftStatus = ref('pending')
const draftNotes = ref('')

const selectedRequestId = computed(() => {
  const value = route.params.requestId
  return Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null
})
const selectedRequest = computed(() => requests.value.find(request => request.id === selectedRequestId.value) ?? null)
const workDismissUrl = computed(() => showDone.value ? '/admin/work?done=1' : '/admin/work')
const navigationGroups = computed<EditorNavigationGroup[]>(() => [{
  id: 'work',
  items: requests.value.map(request => ({
    id: request.id,
    label: request.title,
    summary: `${request.org_name} · ${request.priority} · ${request.status.replaceAll('_', ' ')}`,
    to: `/admin/work/${encodeURIComponent(request.id)}${showDone.value ? '?done=1' : ''}`,
  })),
}])

watch(selectedRequest, (request) => {
  if (!request) return
  draftStatus.value = request.status
  draftNotes.value = request.notes || ''
}, { immediate: true })

function priorityColor(priority: string) {
  return priorityColors[priority] ?? 'neutral'
}

let requestToken = 0
async function loadWorkRequests() {
  const token = ++requestToken
  loading.value = true
  loadError.value = ''
  try {
    const [response, detailResponse] = await Promise.all([
      applicationFetch<{ requests: WorkRequest[] }>(`/api/admin/work-requests?done=${showDone.value ? '1' : '0'}`, { validate: isWorkRequestsResponse }),
      selectedRequestId.value
        ? applicationFetch<{ requests: WorkRequest[] }>(`/api/admin/work-requests?id=${encodeURIComponent(selectedRequestId.value)}`, { validate: isWorkRequestsResponse })
        : Promise.resolve({ requests: [] }),
    ])
    if (token !== requestToken) return
    requests.value = [...new Map([...response.requests, ...detailResponse.requests].map(request => [request.id, request])).values()]
    if (selectedRequestId.value && !selectedRequest.value) throw createError({ statusCode: 404, statusMessage: 'Work request not found' })
  } catch (error) {
    if (isNuxtError(error)) throw error
    if (token === requestToken) loadError.value = 'Failed to load work requests.'
  } finally {
    if (token === requestToken) loading.value = false
  }
}

async function saveRequest() {
  if (!selectedRequest.value) return
  saving.value = true
  try {
    await applicationFetch(`/api/admin/work-requests/${selectedRequest.value.id}`, {
      method: 'PATCH',
      body: { status: draftStatus.value, notes: draftNotes.value },
      validate: (value): value is { success: true } => isRecord(value) && value.success === true,
    })
    toast.add({ title: 'Request updated', color: 'success' })
    await loadWorkRequests()
  } catch {
    toast.add({ title: 'Failed to update request', color: 'error' })
  } finally {
    saving.value = false
  }
}

function closeRequest() {
  navigateTo(workDismissUrl.value)
}

function updateDoneFilter() {
  navigateTo({ path: route.path, query: showDone.value ? { done: '1' } : {} })
}

watch([selectedRequestId, () => route.query.done], () => {
  showDone.value = route.query.done === '1'
  void loadWorkRequests()
}, { immediate: true })
</script>
