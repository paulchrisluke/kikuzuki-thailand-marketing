<template>
  <UDashboardPanel id="admin-domains">
    <template #header>
      <UDashboardNavbar title="Domains">
        <template #leading><DashboardNavbarLeading to="/admin" label="Admin" /></template>
        <template #trailing><UButton icon="i-lucide-refresh-cw" aria-label="Refresh domains" color="neutral" variant="ghost" size="xs" :loading="loading" @click="loadDomains" /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell :has-detail="Boolean(selectedDomain)" :detail-title="selectedDomain?.domain" dismiss-to="/admin/domains">
        <template #index>
          <div class="space-y-5">
            <UInput v-model="search" placeholder="Search domains" icon="i-lucide-search" @keyup.enter="loadDomains" />
            <UCard v-if="loading" variant="subtle"><div class="space-y-3"><USkeleton v-for="index in 5" :key="index" class="h-16 rounded-lg" /></div></UCard>
            <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />
            <UCard v-else-if="domains.length === 0" variant="subtle"><p class="py-4 text-center text-sm text-muted">No custom domains found.</p></UCard>
            <EditorNavigationList v-else :groups="navigationGroups" :active-item="selectedDomain?.id" variant="rows" />
          </div>
        </template>

        <template #detail>
          <div v-if="selectedDomain" class="space-y-7">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :label="selectedDomain.status" :color="statusColor(selectedDomain.status)" variant="soft" class="capitalize" />
              <UBadge v-if="selectedDomain.role === 'canonical'" label="Primary" color="primary" variant="soft" />
            </div>
            <dl class="grid gap-5 sm:grid-cols-2">
              <div><dt class="text-xs font-medium uppercase tracking-wide text-muted">Organization</dt><dd class="mt-1 text-sm text-highlighted">{{ selectedDomain.organization_name || 'Unknown' }}</dd></div>
              <div><dt class="text-xs font-medium uppercase tracking-wide text-muted">Site</dt><dd class="mt-1 text-sm text-highlighted">{{ selectedDomain.site_name || 'Unknown' }}</dd></div>
              <div class="sm:col-span-2"><dt class="text-xs font-medium uppercase tracking-wide text-muted">Cloudflare hostname ID</dt><dd class="mt-1 break-all font-mono text-sm text-highlighted">{{ selectedDomain.cloudflare_hostname_id || 'Pending' }}</dd></div>
            </dl>
            <UAlert v-if="selectedDomain.error_message" color="error" variant="soft" title="Last sync error" :description="selectedDomain.error_message" />
            <UButton label="Sync domain" icon="i-lucide-refresh-cw" color="neutral" variant="soft" :loading="syncing" @click="syncDomain" />
            <section class="space-y-3">
              <h3 class="text-sm font-semibold text-highlighted">Domain activity</h3>
              <p v-if="selectedEvents.length === 0" class="text-sm text-muted">No recorded events for this domain.</p>
              <div v-else class="space-y-2">
                <div v-for="event in selectedEvents" :key="event.id" class="rounded-xl bg-elevated px-4 py-3">
                  <p class="text-sm font-medium text-highlighted">{{ event.event_type }}</p>
                  <p class="mt-1 text-sm text-muted">{{ event.message }}</p>
                  <p class="mt-2 text-xs text-dimmed">{{ formatDate(event.created_at) }}</p>
                </div>
              </div>
            </section>
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
import { formatDate } from '~/utils/formatters'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Domains | KrabiClaw Admin', robots: 'noindex, nofollow' })

interface Domain {
  id: string; domain: string; status: string; role: string
  site_name: string | null; organization_name: string | null
  cloudflare_hostname_id: string | null; error_message: string | null
}
interface DomainEvent { id: string; domain: string | null; event_type: string; message: string; created_at: string }

const isDomain = (value: unknown): value is Domain => isRecord(value)
  && typeof value.id === 'string'
  && typeof value.domain === 'string'
  && typeof value.status === 'string'
  && typeof value.role === 'string'
  && (value.site_name === null || typeof value.site_name === 'string')
  && (value.organization_name === null || typeof value.organization_name === 'string')
  && (value.cloudflare_hostname_id === null || typeof value.cloudflare_hostname_id === 'string')
  && (value.error_message === null || typeof value.error_message === 'string')
const isDomainEvent = (value: unknown): value is DomainEvent => isRecord(value)
  && typeof value.id === 'string'
  && (value.domain === null || typeof value.domain === 'string')
  && typeof value.event_type === 'string'
  && typeof value.message === 'string'
  && typeof value.created_at === 'string'
const isDomainsResponse = (value: unknown): value is { domains: Domain[]; events: DomainEvent[] } =>
  isRecord(value) && Array.isArray(value.domains) && value.domains.every(isDomain)
  && Array.isArray(value.events) && value.events.every(isDomainEvent)

const route = useRoute()
if (Array.isArray(route.params.domainId) && route.params.domainId.length > 1) {
  throw createError({ statusCode: 404, statusMessage: 'Domain route not found' })
}
const toast = useToast()
const domains = ref<Domain[]>([])
const events = ref<DomainEvent[]>([])
const search = ref('')
const loading = ref(true)
const syncing = ref(false)
const loadError = ref('')

const selectedDomainId = computed(() => {
  const value = route.params.domainId
  return Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null
})
const selectedDomain = computed(() => domains.value.find(domain => domain.id === selectedDomainId.value) ?? null)
const selectedEvents = computed(() => events.value.filter(event => event.domain === selectedDomain.value?.domain))
const navigationGroups = computed<EditorNavigationGroup[]>(() => [{
  id: 'domains',
  items: domains.value.map(domain => ({
    id: domain.id,
    label: domain.domain,
    summary: `${domain.organization_name || 'Unknown organization'} · ${domain.site_name || 'Unknown site'} · ${domain.status}`,
    to: `/admin/domains/${encodeURIComponent(domain.id)}`,
  })),
}])

function statusColor(status: string): 'success' | 'error' | 'warning' {
  if (status === 'active') return 'success'
  if (status === 'failed' || status === 'blocked') return 'error'
  return 'warning'
}

let requestToken = 0
async function loadDomains() {
  const token = ++requestToken
  loading.value = true
  loadError.value = ''
  try {
    const query = search.value.trim() ? `?q=${encodeURIComponent(search.value.trim())}` : ''
    const response = await applicationFetch<{ domains: Domain[]; events: DomainEvent[] }>(`/api/admin/domains${query}`, { validate: isDomainsResponse })
    if (token !== requestToken) return
    domains.value = response.domains
    events.value = response.events
    if (selectedDomainId.value && !selectedDomain.value) throw createError({ statusCode: 404, statusMessage: 'Domain not found' })
  } catch (error) {
    if (isNuxtError(error)) throw error
    if (token === requestToken) loadError.value = 'Failed to load domains.'
  } finally {
    if (token === requestToken) loading.value = false
  }
}

async function syncDomain() {
  if (!selectedDomain.value) return
  syncing.value = true
  try {
    await applicationFetch(`/api/admin/domains/${selectedDomain.value.id}/sync`, {
      method: 'POST',
      validate: (value): value is { success: true } => isRecord(value) && value.success === true,
    })
    toast.add({ title: 'Domain synced', color: 'success' })
    await loadDomains()
  } catch {
    toast.add({ title: 'Failed to sync domain', color: 'error' })
  } finally {
    syncing.value = false
  }
}

onMounted(loadDomains)
</script>
