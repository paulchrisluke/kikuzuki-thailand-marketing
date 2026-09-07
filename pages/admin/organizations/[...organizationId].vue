<template>
  <UDashboardPanel id="admin-organizations">
    <template #header>
      <UDashboardNavbar title="Organizations">
        <template #leading>
          <DashboardNavbarLeading to="/admin" label="Admin" />
        </template>
        <template #trailing>
          <UButton icon="i-lucide-refresh-cw" aria-label="Refresh organizations" color="neutral" variant="ghost" size="xs" :loading="loading" @click="loadOrganizations" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="Boolean(selectedOrganization)"
        :detail-title="selectedOrganization?.name"
        dismiss-to="/admin/organizations"
      >
        <template #index>
          <div class="space-y-5">
            <div class="flex flex-wrap items-center gap-2">
              <UButton label="All" size="sm" :variant="clientView ? 'ghost' : 'soft'" :color="clientView ? 'neutral' : 'primary'" to="/admin/organizations" />
              <UButton label="Clients" size="sm" :variant="clientView ? 'soft' : 'ghost'" :color="clientView ? 'primary' : 'neutral'" to="/admin/organizations?view=clients" />
            </div>

            <UInput v-model="search" icon="i-lucide-search" placeholder="Search organizations, sites, or locations" class="w-full" />

            <UCard v-if="loading" variant="subtle">
              <div class="space-y-3">
                <USkeleton v-for="index in 5" :key="index" class="h-16 rounded-lg" />
              </div>
            </UCard>

            <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />

            <UCard v-else-if="navigationGroups[0]?.items.length === 0" variant="subtle">
              <p class="text-sm text-muted">{{ clientView ? 'No client organizations match your search.' : 'No organizations match your search.' }}</p>
            </UCard>

            <EditorNavigationList v-else :groups="navigationGroups" :active-item="selectedOrganization?.id" variant="rows" />
          </div>
        </template>

        <template #detail>
          <div v-if="selectedOrganization" class="space-y-8">
            <section class="space-y-3">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="neutral" variant="soft" :label="`${selectedOrganization.sites.length} ${selectedOrganization.sites.length === 1 ? 'site' : 'sites'}`" />
                <UBadge v-if="selectedClient" :color="planColor(selectedClient.plan)" variant="soft" :label="planLabel(selectedClient.plan)" />
              </div>
              <p class="text-sm text-muted">{{ selectedOrganization.slug || selectedOrganization.id }}</p>
              <UButton
                label="Open workspace"
                icon="i-lucide-log-in"
                :disabled="!selectedOrganization.slug || !selectedOrganization.impersonationUserId"
                :loading="impersonatingId === selectedOrganization.id"
                @click="enterOrganization(selectedOrganization)"
              />
            </section>

            <div class="flex flex-wrap gap-2 border-b border-default pb-4">
              <UButton label="Overview" size="sm" :variant="detailSection === 'overview' ? 'soft' : 'ghost'" :color="detailSection === 'overview' ? 'primary' : 'neutral'" :to="organizationSectionUrl('overview')" />
              <UButton v-if="selectedClient" label="Billing" size="sm" :variant="detailSection === 'billing' ? 'soft' : 'ghost'" :color="detailSection === 'billing' ? 'primary' : 'neutral'" :to="organizationSectionUrl('billing')" />
              <UButton v-if="selectedClient?.site_id" label="Handoff" size="sm" :variant="detailSection === 'handoff' ? 'soft' : 'ghost'" :color="detailSection === 'handoff' ? 'primary' : 'neutral'" :to="organizationSectionUrl('handoff')" />
            </div>

            <section v-if="detailSection === 'overview'" class="space-y-3">
              <h3 class="text-sm font-semibold text-highlighted">Sites and locations</h3>
              <UCard v-if="selectedOrganization.sites.length === 0" variant="subtle">
                <p class="text-sm text-muted">No sites.</p>
              </UCard>
              <UCard v-for="site in selectedOrganization.sites" :key="site.id" variant="subtle">
                <div class="space-y-3">
                  <div class="flex items-start justify-between gap-3">
                    <div>
                      <p class="font-medium text-highlighted">{{ site.name }}</p>
                      <p class="text-xs text-muted">{{ site.subdomain || site.slug }}</p>
                    </div>
                    <UBadge :color="site.status === 'active' ? 'success' : 'neutral'" variant="soft" :label="site.status || 'unknown'" />
                  </div>
                  <div v-if="site.locations.length" class="divide-y divide-default border-t border-default">
                    <div v-for="location in site.locations" :key="location.id" class="flex items-center gap-3 py-3 last:pb-0">
                      <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
                      <div class="min-w-0">
                        <p class="truncate text-sm text-default">{{ location.title }}</p>
                        <p class="truncate text-xs text-muted">{{ location.city || location.slug }}</p>
                      </div>
                    </div>
                  </div>
                  <p v-else class="text-xs text-muted">No locations.</p>
                </div>
              </UCard>
            </section>

            <section v-if="detailSection === 'overview' && selectedClient" class="space-y-3">
              <h3 class="text-sm font-semibold text-highlighted">Client status</h3>
              <div class="divide-y divide-default overflow-hidden rounded-xl border border-default text-sm">
                <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Subscription</span><span class="text-default">{{ selectedClient.subscription_status || 'Not active' }}</span></div>
                <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Domain</span><span class="break-all text-right text-default">{{ selectedClient.custom_domain || 'Subdomain only' }}</span></div>
                <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Handoff</span><span class="break-all text-right text-default">{{ selectedClient.pending_transfer_email || 'No pending transfer' }}</span></div>
              </div>
            </section>

            <section v-if="detailSection === 'billing' && selectedClient" class="space-y-4">
              <div v-if="billingLoading" class="space-y-3"><USkeleton v-for="index in 5" :key="index" class="h-10 rounded-lg" /></div>
              <UAlert v-else-if="billingError" color="error" variant="soft" :description="billingError" />
              <template v-else-if="billingStatus">
                <div class="divide-y divide-default overflow-hidden rounded-xl border border-default text-sm">
                  <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Plan</span><span class="text-highlighted">{{ planLabel(billingStatus.plan) }}</span></div>
                  <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Status</span><span class="text-highlighted">{{ billingStatus.status || 'Not set' }}</span></div>
                  <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Renews</span><span class="text-highlighted">{{ billingStatus.current_period_end ? formatDate(billingStatus.current_period_end) : '—' }}</span></div>
                  <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Stripe customer</span><a v-if="billingStatus.stripe_customer_id" class="break-all text-right font-mono text-xs text-primary hover:underline" :href="`https://dashboard.stripe.com/customers/${billingStatus.stripe_customer_id}`" target="_blank">{{ billingStatus.stripe_customer_id }}</a><span v-else class="text-muted">Not created</span></div>
                  <div class="flex justify-between gap-4 px-4 py-3"><span class="text-muted">Subscription</span><a v-if="billingStatus.stripe_subscription_id" class="break-all text-right font-mono text-xs text-primary hover:underline" :href="`https://dashboard.stripe.com/subscriptions/${billingStatus.stripe_subscription_id}`" target="_blank">{{ billingStatus.stripe_subscription_id }}</a><span v-else class="text-muted">None</span></div>
                </div>
                <div v-if="billingStatus.pending_transfer" class="space-y-3 rounded-xl border border-default p-4">
                  <h3 class="font-semibold text-highlighted">Pending transfer</h3>
                  <p class="text-sm text-muted">Recipient: <span class="text-highlighted">{{ billingStatus.pending_transfer.to_email }}</span></p>
                  <UAlert v-if="!billingStatus.pending_transfer.recipient_ready" color="warning" variant="soft" description="The recipient must create an account and an organization before the transfer can be completed here." />
                  <template v-else>
                    <UFormField label="Recipient organization">
                      <USelect v-model="recipientOrganizationId" :items="recipientOrganizationItems" class="w-full" />
                    </UFormField>
                    <UAlert v-if="forceAcceptError" color="error" variant="soft" :description="forceAcceptError" />
                    <UButton label="Force transfer site now" icon="i-lucide-send" color="success" :loading="forceAccepting" :disabled="!recipientOrganizationId" @click="forceAcceptTransfer" />
                  </template>
                </div>
                <UCard v-else variant="subtle"><p class="text-sm text-muted">No pending handoff.</p></UCard>
              </template>
            </section>

            <section v-if="detailSection === 'handoff' && selectedClient?.site_id" class="space-y-4">
              <UAlert v-if="selectedClient.pending_transfer_email" color="warning" variant="soft" title="Handoff already pending" :description="`An invitation is pending for ${selectedClient.pending_transfer_email}. Billing shows the durable transfer state.`" />
              <UFormField label="Client email" required><UInput v-model="handoffEmail" type="email" placeholder="owner@restaurant.com" class="w-full" /></UFormField>
              <UFormField label="Their domain" hint="Optional"><UInput v-model="handoffDomain" placeholder="restaurant.com" class="w-full" /></UFormField>
              <UFormField label="Plan"><USelect v-model="handoffPlan" :items="planOptions" class="w-full" /></UFormField>
              <UAlert v-if="handoffDomainNeedsPlan" color="error" variant="soft" description="A paid plan is required when inviting a client with a custom domain." />
              <UFormField label="Stripe coupon code" hint="Optional"><UInput v-model="handoffCoupon" class="w-full" /></UFormField>
              <UFormField label="Personal note" hint="Optional"><UTextarea v-model="handoffMessage" :rows="3" class="w-full" /></UFormField>
              <UAlert v-if="handoffError" color="error" variant="soft" :description="handoffError" />
              <UAlert v-if="handoffResult" color="success" variant="soft" :title="`Invite sent to ${handoffResult.to_email}`" :description="handoffResult.transfer_url" />
              <div class="flex flex-wrap gap-2">
                <UButton label="Send invite email" icon="i-lucide-send" :loading="handoffSending" :disabled="!handoffEmail.trim() || handoffDomainNeedsPlan" @click="sendHandoff" />
                <UButton v-if="handoffResult" label="Copy transfer link" color="neutral" variant="soft" icon="i-lucide-copy" @click="copyHandoffLink" />
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
import { NEW_SALE_PAID_PLAN_IDS } from '~/shared/billing-model'
import { getErrorMessage } from '~/utils/errors'
import { formatDate } from '~/utils/formatters'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Organizations | KrabiClaw Admin', robots: 'noindex, nofollow' })

interface AdminLocation { id: string; slug: string; title: string; city: string | null }
interface AdminSite { id: string; slug: string; name: string; subdomain: string | null; status: string | null; locations: AdminLocation[] }
interface AdminOrganization { id: string; name: string; slug: string | null; impersonationUserId: string | null; sites: AdminSite[] }
interface AdminClient { org_id: string; plan: string | null; site_id: string | null; subscription_status: string | null; custom_domain: string | null; pending_transfer_email: string | null }
interface BillingStatus {
  stripe_customer_id: string | null; stripe_subscription_id: string | null; plan: string | null; status: string | null; current_period_end: string | null
  pending_transfer: null | { site_id: string; to_email: string; recipient_ready: boolean; recipient_organizations: Array<{ id: string; name: string; slug: string }> }
}
interface HandoffResult { transfer_url: string; to_email: string; site_name: string; invited_plan: string | null }

const isOrganizationsResponse = (value: unknown): value is { organizations: AdminOrganization[] } =>
  isRecord(value) && Array.isArray(value.organizations)

const isClientsResponse = (value: unknown): value is { clients: AdminClient[] } =>
  isRecord(value) && Array.isArray(value.clients) && value.clients.every(client => isRecord(client) && typeof client.org_id === 'string')

const route = useRoute()
const toast = useToast()
const { refreshSession } = useAuth()
const organizations = ref<AdminOrganization[]>([])
const clients = ref<AdminClient[]>([])
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const impersonatingId = ref<string | null>(null)
const billingStatus = ref<BillingStatus | null>(null)
const billingLoading = ref(false)
const billingError = ref('')
const recipientOrganizationId = ref('')
const forceAccepting = ref(false)
const forceAcceptError = ref('')
const handoffEmail = ref('')
const handoffDomain = ref('')
const handoffPlan = ref('')
const handoffCoupon = ref('')
const handoffMessage = ref('')
const handoffSending = ref(false)
const handoffError = ref('')
const handoffResult = ref<HandoffResult | null>(null)
const planOptions = [{ label: 'No plan (they choose later)', value: '' }, ...NEW_SALE_PAID_PLAN_IDS.map(value => ({ label: 'Growth — $49/mo', value }))]

const selectedOrganizationId = computed(() => {
  const value = route.params.organizationId
  return Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null
})
const detailSection = computed(() => {
  const value = route.params.organizationId
  const section = Array.isArray(value) ? value[1] : null
  return section === 'billing' || section === 'handoff' ? section : 'overview'
})
const clientView = computed(() => route.query.view === 'clients')
const clientIds = computed(() => new Set(clients.value.map(client => client.org_id)))
const filteredOrganizations = computed(() => {
  const query = search.value.trim().toLowerCase()
  return organizations.value.filter((organization) => {
    if (clientView.value && !clientIds.value.has(organization.id)) return false
    if (!query) return true
    return [
      organization.name,
      organization.slug,
      ...organization.sites.flatMap(site => [site.name, site.slug, site.subdomain, ...site.locations.flatMap(location => [location.title, location.slug, location.city])]),
    ].some(value => value?.toLowerCase().includes(query))
  })
})
const navigationGroups = computed<EditorNavigationGroup[]>(() => [{
  id: 'organizations',
  items: filteredOrganizations.value.map(organization => ({
    id: organization.id,
    label: organization.name,
    summary: `${organization.sites.length} ${organization.sites.length === 1 ? 'site' : 'sites'} · ${organization.slug || organization.id}`,
    to: `/admin/organizations/${encodeURIComponent(organization.id)}${clientView.value ? '?view=clients' : ''}`,
  })),
}])
const selectedOrganization = computed(() => organizations.value.find(organization => organization.id === selectedOrganizationId.value) ?? null)
const selectedClient = computed(() => clients.value.find(client => client.org_id === selectedOrganizationId.value) ?? null)
const recipientOrganizationItems = computed(() => billingStatus.value?.pending_transfer?.recipient_organizations.map(organization => ({ label: `${organization.name} (${organization.slug})`, value: organization.id })) ?? [])
const handoffDomainNeedsPlan = computed(() => Boolean(handoffDomain.value.trim()) && !handoffPlan.value)

function organizationSectionUrl(section: 'overview' | 'billing' | 'handoff') {
  const base = `/admin/organizations/${encodeURIComponent(selectedOrganizationId.value || '')}`
  const suffix = section === 'overview' ? '' : `/${section}`
  return `${base}${suffix}${clientView.value ? '?view=clients' : ''}`
}

function planLabel(plan: string | null) {
  return plan === 'growth' ? 'Growth' : 'Starter'
}

function planColor(plan: string | null): 'primary' | 'neutral' {
  return plan === 'growth' ? 'primary' : 'neutral'
}

async function loadOrganizations() {
  loading.value = true
  loadError.value = ''
  try {
    const [overview, clientResponse] = await Promise.all([
      applicationFetch<{ organizations: AdminOrganization[] }>('/api/admin/overview', { validate: isOrganizationsResponse }),
      applicationFetch<{ clients: AdminClient[] }>('/api/admin/clients', { validate: isClientsResponse }),
    ])
    organizations.value = overview.organizations
    clients.value = clientResponse.clients
    if (selectedOrganizationId.value && !selectedOrganization.value) {
      throw createError({ statusCode: 404, statusMessage: 'Organization not found' })
    }
    if (detailSection.value === 'billing' && selectedClient.value) await loadBilling()
  } catch (error) {
    if (isNuxtError(error)) throw error
    loadError.value = 'Failed to load organizations.'
  } finally {
    loading.value = false
  }
}

async function loadBilling() {
  if (!selectedOrganizationId.value) return
  billingLoading.value = true
  billingError.value = ''
  try {
    billingStatus.value = await applicationFetch<BillingStatus>(`/api/admin/organizations/${selectedOrganizationId.value}/billing`, {
      validate: (value): value is BillingStatus => isRecord(value) && Array.isArray(value.sites_billing),
    })
    const organizations = billingStatus.value.pending_transfer?.recipient_organizations ?? []
    recipientOrganizationId.value = organizations.length === 1 ? organizations[0]!.id : ''
  } catch (error) {
    billingError.value = getErrorMessage(error, 'Failed to load billing info')
  } finally {
    billingLoading.value = false
  }
}

async function forceAcceptTransfer() {
  const transfer = billingStatus.value?.pending_transfer
  if (!transfer || !recipientOrganizationId.value) return
  forceAccepting.value = true
  forceAcceptError.value = ''
  try {
    await applicationFetch(`/api/admin/sites/${transfer.site_id}/transfer/force-accept`, {
      method: 'POST', body: { organizationId: recipientOrganizationId.value },
      validate: (value): value is { success: boolean } => isRecord(value) && value.success === true,
    })
    toast.add({ title: 'Site transferred', color: 'success' })
    await loadOrganizations()
  } catch (error) {
    forceAcceptError.value = getErrorMessage(error, 'Failed to transfer site')
  } finally {
    forceAccepting.value = false
  }
}

async function sendHandoff() {
  if (!selectedClient.value?.site_id || !handoffEmail.value.trim() || handoffDomainNeedsPlan.value) return
  handoffSending.value = true
  handoffError.value = ''
  handoffResult.value = null
  try {
    handoffResult.value = await applicationFetch<HandoffResult>(`/api/admin/sites/${selectedClient.value.site_id}/transfer`, {
      method: 'POST',
      body: { email: handoffEmail.value.trim(), domain: handoffDomain.value.trim() || undefined, plan: handoffPlan.value || undefined, coupon: handoffCoupon.value.trim() || undefined, message: handoffMessage.value.trim() || undefined },
      validate: (value): value is HandoffResult => isRecord(value) && typeof value.transfer_url === 'string' && typeof value.to_email === 'string',
    })
    await loadOrganizations()
  } catch (error) {
    handoffError.value = getErrorMessage(error, 'Failed to send handoff')
  } finally {
    handoffSending.value = false
  }
}

async function copyHandoffLink() {
  if (!handoffResult.value) return
  try {
    await navigator.clipboard.writeText(handoffResult.value.transfer_url)
    toast.add({ title: 'Link copied', color: 'success' })
  } catch {
    toast.add({ title: 'Failed to copy link', color: 'error' })
  }
}

async function enterOrganization(organization: AdminOrganization) {
  if (!organization.slug || !organization.impersonationUserId || impersonatingId.value) return
  impersonatingId.value = organization.id
  try {
    const { authClient } = await import('~/lib/auth-client')
    const result = await authClient.admin.impersonateUser({ userId: organization.impersonationUserId })
    if (result.error) throw new Error(result.error.message)
    await refreshSession()
    await navigateTo(`/dashboard/${organization.slug}`)
  } catch {
    toast.add({ title: 'Failed to enter organization workspace', color: 'error' })
  } finally {
    impersonatingId.value = null
  }
}

onMounted(loadOrganizations)
</script>
