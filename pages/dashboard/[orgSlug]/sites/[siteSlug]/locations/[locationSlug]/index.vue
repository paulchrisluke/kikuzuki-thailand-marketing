<template>
  <UDashboardPanel id="location-overview">
    <template #header>
      <UDashboardNavbar :title="location?.title || 'Location'" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="locationsPath" label="Locations" />
        </template>
        <template #right>
          <UButton
            :to="settingsPath"
            icon="i-lucide-settings"
            color="neutral"
            variant="ghost"
            square
            aria-label="Location settings"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UPage>
        <UPageBody>
          <div class="mx-auto w-full max-w-[var(--ws-page-narrow,45rem)] pb-20">
            <div v-if="loading" class="space-y-5">
              <USkeleton class="aspect-[16/9] w-full rounded-2xl" />
              <USkeleton v-for="index in 3" :key="index" class="h-44 rounded-2xl" />
            </div>

            <UAlert
              v-else-if="error"
              color="error"
              variant="soft"
              icon="i-lucide-triangle-alert"
              :description="error"
            />

            <div v-else-if="location" class="space-y-8">
              <!--
                The location itself, then everything you edit on it. Profile,
                Hours and Discovery used to sit here as cards that linked into
                Settings, where they are already listed with the same summaries
                — a tab that mirrored the cog. They live in the cog only.
              -->
              <NuxtLink :to="`${settingsPath}/profile`" class="group block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                <UCard
                  variant="subtle"
                  class="overflow-hidden rounded-2xl transition-colors group-hover:bg-elevated"
                  :ui="{ body: 'p-0! sm:p-0!' }"
                >
                  <img
                    v-if="locationImage"
                    :src="locationImage"
                    :alt="`${location.title} preview`"
                    class="aspect-[40/21] w-full object-cover"
                  />
                  <div class="space-y-2 px-5 py-5 sm:px-6">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <h1 class="text-xl font-semibold text-highlighted">{{ location.title }}</h1>
                        <p class="mt-1 text-sm text-muted">{{ addressSummary }}</p>
                      </div>
                      <UBadge :color="location.status === 'active' ? 'success' : 'neutral'" variant="soft" class="capitalize">
                        {{ location.status }}
                      </UBadge>
                    </div>
                    <p class="text-sm text-muted">{{ currentOpeningState }}</p>
                  </div>
                </UCard>
              </NuxtLink>

              <EditorNavigationList :groups="contentGroups" variant="cards" />
            </div>
          </div>
        </UPageBody>
      </UPage>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'
import { parseCmsFeatureOverrideDelta, resolveCmsCapabilities, type ProductFeature } from '~/config/cms-registry'
import { resolvePublicTemplate } from '~/utils/template-registry'
import { getTodayGoogleHours } from '~/utils/formatters'
import { normalizeVertical, type SiteVertical } from '~/utils/vertical-copy'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Location Overview | KrabiClaw', robots: 'noindex, nofollow' })

interface LocationOverview {
  id: string
  title: string
  status: string
  is_primary: boolean
  phone: string | null
  email: string | null
  city: string | null
  address: { addressLines?: string[] } | null
  rating: number | null
  google_place_id: string | null
  timezone?: string | null
  opening_hours?: Parameters<typeof getTodayGoogleHours>[0]
}

interface InboxSummary {
  openThreads: number
  unreadThreads: number
}

interface LocationContentCounts {
  photos: number
  experiences: number
  posts: number
  qa: number
  upcomingReservations: number
}

interface LocationOverviewResource {
  location: { success: boolean; location: LocationOverview }
  products: { success: boolean; products: ApiRecord[] }
  threads: { summary: InboxSummary }
  counts: LocationContentCounts
}

const dashboardApi = useDashboardApi()
const route = useRoute()
const dashboard = useDashboardSite()
const dashboardLocation = useDashboardLocation()
const siteId = await useDashboardSiteId()
const locationId = computed(() => dashboardLocation.currentLocationId.value ?? '')
const sitePath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}`)
const locationPath = computed(() => `${sitePath.value}/locations/${String(route.params.locationSlug)}`)
const settingsPath = computed(() => `${locationPath.value}/settings`)
const locationsPath = computed(() => `${sitePath.value}/locations`)
const location = ref<LocationOverview | null>(null)
const products = ref<ApiRecord[]>([])
const inboxSummary = ref<InboxSummary>({ openThreads: 0, unreadThreads: 0 })
const counts = ref<LocationContentCounts>({ photos: 0, experiences: 0, posts: 0, qa: 0, upcomingReservations: 0 })
const loading = ref(true)
const error = ref<string | null>(null)

const dashboardLocationRow = computed(() => dashboard.locations.value.find(candidate => candidate.id === locationId.value) ?? null)
const locationImage = computed(() =>
  dashboardLocationRow.value?.media.find(item => item.slot === 'social_card')?.public_url ?? '')
// Reads `address` and only `address`. Falling through to `city` made this line
// mean two different things depending on data the reader cannot see.
const addressSummary = computed(() => location.value?.address?.addressLines?.join(', ') || 'Address not set')

const capabilities = computed(() => {
  const vertical = dashboard.site.value?.vertical
  if (!vertical) return null
  try {
    const normalizedVertical = normalizeVertical(vertical) as SiteVertical
    const template = resolvePublicTemplate({ vertical }).slug
    return resolveCmsCapabilities(normalizedVertical, template, {
      site: parseCmsFeatureOverrideDelta(dashboard.site.value?.feature_overrides),
      location: parseCmsFeatureOverrideDelta(dashboardLocationRow.value?.feature_overrides),
    })
  } catch {
    return null
  }
})

const featureSet = computed(() => new Set<ProductFeature>([
  ...(capabilities.value?.pages.map(page => page.feature) ?? []),
  ...(capabilities.value?.managers.map(manager => manager.id) ?? []),
]))
const hasFeature = (feature: ProductFeature) => featureSet.value.has(feature)
const includeProducts = computed(() => hasFeature('products'))

const currentOpeningState = computed(() => {
  const hours = location.value?.opening_hours
  if (!hours) return 'Hours not set'
  const timezone = location.value?.timezone || null
  let today = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()]
  if (timezone) {
    try {
      today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(new Date()).toUpperCase()
    } catch {
      // Use the local day when the configured timezone is invalid.
    }
  }
  return getTodayGoogleHours(hours, today) || 'Hours synced'
})


/** Plural-aware count, or the empty state that says what to do instead. */
function countSummary(total: number, noun: string, empty: string): string {
  if (!total) return empty
  return `${total} ${total === 1 ? noun : `${noun}s`}`
}

/**
 * Every row states what it holds. A row reading "Manage bookable experiences"
 * tells a tenant nothing they did not already know from its label, and makes
 * them open it to find out whether there is anything in there.
 *
 * Ordered by what gets edited: the menu and experiences are daily work, the
 * location's own details are set up once and live in Settings.
 */
const contentGroups = computed(() => {
  const items = [
    {
      id: 'products',
      label: dashboard.site.value?.vertical === 'restaurant' ? 'Menu' : 'Products',
      summary: countSummary(products.value.length, 'item', 'Add your first item'),
      to: `${locationPath.value}/products`,
      visible: hasFeature('products'),
    },
    {
      id: 'experiences',
      label: 'Experiences',
      summary: countSummary(counts.value.experiences, 'experience', 'Add your first experience'),
      to: `${locationPath.value}/experiences`,
      visible: hasFeature('experiences'),
    },
    {
      id: 'photos',
      label: 'Photos',
      summary: countSummary(counts.value.photos, 'photo', 'Add photos'),
      to: `${locationPath.value}/photos`,
      visible: hasFeature('photos'),
    },
    {
      id: 'posts',
      label: 'Posts',
      summary: countSummary(counts.value.posts, 'published post', 'Write your first post'),
      to: `${locationPath.value}/posts`,
      visible: hasFeature('posts'),
    },
    {
      id: 'qa',
      label: 'Q&A',
      summary: countSummary(counts.value.qa, 'question', 'Answer your first question'),
      to: `${locationPath.value}/qa`,
      visible: hasFeature('qa'),
    },
  ].filter(item => item.visible !== false)

  const operations = [
    {
      id: 'reservations',
      label: 'Reservations',
      summary: countSummary(counts.value.upcomingReservations, 'upcoming booking', 'No upcoming bookings'),
      to: `${locationPath.value}/reservations`,
      visible: hasFeature('reservations'),
    },
    {
      id: 'inbox',
      label: 'Guest activity',
      summary: inboxSummary.value.unreadThreads
        ? `${inboxSummary.value.unreadThreads} unread · ${inboxSummary.value.openThreads} open`
        : countSummary(inboxSummary.value.openThreads, 'open request', 'Nothing waiting'),
      to: `${locationPath.value}/inbox`,
      visible: true,
    },
  ].filter(item => item.visible !== false)

  return [
    { id: 'public-content', items },
    { id: 'operations', label: 'Manage', items: operations },
  ].filter(group => group.items.length > 0)
})

const isLocationResponse = (value: unknown): value is { success: boolean; location: LocationOverview } =>
  isRecord(value)
  && typeof value.success === 'boolean'
  && isRecord(value.location)
  && typeof value.location.id === 'string'
  && typeof value.location.title === 'string'
  && typeof value.location.status === 'string'

const isProductsResponse = (value: unknown): value is { success: boolean; products: ApiRecord[] } =>
  isRecord(value)
  && typeof value.success === 'boolean'
  && Array.isArray(value.products)
  && value.products.every(product => isRecord(product) && typeof product.id === 'string')

const isOverviewResponse = (value: unknown): value is LocationOverviewResource =>
  isRecord(value)
  && isRecord(value.location) && isLocationResponse(value.location)
  && isRecord(value.products) && isProductsResponse(value.products)
  && isRecord(value.threads) && isRecord(value.threads.summary)
  && typeof value.threads.summary.openThreads === 'number'
  && typeof value.threads.summary.unreadThreads === 'number'
  && isRecord(value.counts)
  && typeof value.counts.photos === 'number'
  && typeof value.counts.experiences === 'number'

const requestEvent = useRequestEvent()
const overviewKey = computed(() => `dashboard-location-overview:${siteId}:${locationId.value}:${includeProducts.value ? 'products' : 'no-products'}`)
const { data: overview, pending: overviewPending, error: overviewError } = await useAsyncData<LocationOverviewResource>(overviewKey, async () => {
  if (!locationId.value) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  const shouldIncludeProducts = includeProducts.value
  if (import.meta.server) {
    if (!requestEvent) throw createError({ statusCode: 500, statusMessage: 'Request context unavailable' })
    const { loadDashboardLocationOverview } = await import('~/server/utils/dashboard-editor-resources')
    return await loadDashboardLocationOverview(requestEvent, siteId, locationId.value, {
      includeProducts: shouldIncludeProducts,
    }) as LocationOverviewResource
  }

  return await dashboardApi<LocationOverviewResource>(
    `/api/dashboard/sites/${siteId}/locations/${locationId.value}/overview`,
    {
      query: { includeProducts: String(shouldIncludeProducts) },
      validate: isOverviewResponse,
    },
  )
}, { lazy: import.meta.client })

watch([overview, overviewPending, overviewError], ([resource, pending, cause]) => {
  loading.value = pending
  if (cause) {
    error.value = cause instanceof Error ? cause.message : 'Failed to load location overview'
    return
  }
  if (!resource) return
  location.value = resource.location.location
  products.value = resource.products.products
  inboxSummary.value = resource.threads.summary
  counts.value = resource.counts
  error.value = null
}, { immediate: true })
</script>
