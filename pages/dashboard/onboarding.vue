<template>
  <div class="flex size-full min-h-0 flex-col overflow-hidden bg-muted text-highlighted">

    <div class="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(24rem,45%)_1fr]">
      <OnboardingWizard
        mode="new-site"
        @site-created="onSiteCreated"
        @draft-saved="onDraftSaved"
        @preview-requested="openMobilePreview"
        @draft-cleared="onDraftCleared"
        @vertical-selected="selectedVertical = $event"
        @step-changed="activeStep = $event"
      />
      <OnboardingPreviewPane
        v-if="!isMobilePreviewViewport"
        class="hidden lg:flex"
        :iframe-src="iframeSrc"
        :site-locations="previewLocations"
        :selected-location-id="selectedLocationId"
        selected-page="home"
        :site-status="siteStatus"
        :site-domain="siteDomain"
        :vertical="selectedVertical"
        :empty-visual-url="preDraftVisual.url"
        :empty-visual-alt="preDraftVisual.alt"
        home-only
        @select-location="onSelectLocation"
      />
    </div>

    <USlideover
      v-if="isMobilePreviewViewport"
      v-model:open="mobilePreviewOpenForViewport"
      title="Site preview"
      description="Close to keep answering."
      side="bottom"
      :ui="{ content: 'h-[82vh] overflow-hidden rounded-t-2xl', body: 'flex min-h-0 p-0 sm:p-0' }"
    >
      <template #body>
        <OnboardingPreviewPane
          class="min-h-0 flex-1"
          :iframe-src="iframeSrc"
          :site-locations="previewLocations"
          :selected-location-id="selectedLocationId"
          selected-page="home"
          :site-status="siteStatus"
          :site-domain="siteDomain"
          :vertical="selectedVertical"
          :empty-visual-url="preDraftVisual.url"
          :empty-visual-alt="preDraftVisual.alt"
          home-only
          @select-location="onSelectLocation"
        />
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
import type { SiteVertical } from '~/utils/vertical-copy'
import { tenantSiteOrigin } from '~/utils/tenant-site-origin'

// This route creates a new site, so it has no org or site of its own yet:
// there is no orgSlug segment and nothing dashboard-scoped to load. The
// dashboard layout honours skipDashboardContext and renders the shared header
// (wordmark and account menu) without org nav; middleware/dashboard.global.ts
// still gates the route on a session.
definePageMeta({ layout: 'dashboard', skipDashboardContext: true })

const route = useRoute()
const config = useRuntimeConfig()
const toast = useToast()

// ─── State ────────────────────────────────────────────────────────────────────
const selectedVertical = ref<SiteVertical>('restaurant')
const activeStep = ref('welcome')
const draftPreview = ref<{
  draftId: string
  siteId: string
  previewToken: string
  draftName: string
  subdomainCandidate: string
} | null>(null)
// Set once the draft is committed: the pane then shows the live site itself.
const createdSite = ref<{ siteSlug: string } | null>(null)
const mobilePreviewOpen = ref(false)
const hasAutoOpenedMobilePreview = ref(false)
const isMobilePreviewViewport = ref(false)
const selectedLocationId = ref<string | null>(null)
const previewReloadToken = ref(0)

// ─── Preview target ───────────────────────────────────────────────────────────
const siteOriginFor = (subdomain: string) => tenantSiteOrigin({
  platformDomain: String(config.public.platformDomain),
  freeSiteDomain: String(config.public.freeSiteDomain),
  subdomain,
})

const previewLocations = computed(() => {
  if (draftPreview.value) return [{
    id: draftPreview.value.siteId,
    slug: draftPreview.value.subdomainCandidate,
    title: draftPreview.value.draftName,
  }]
  return []
})

const siteDomain = computed(() => {
  const slug = createdSite.value?.siteSlug ?? draftPreview.value?.subdomainCandidate
  return slug ? siteOriginFor(slug).replace(/^https?:\/\//, '') : ''
})

// The preview is the site itself, on its own subdomain: the same host, the
// same templates and the same navigation the public gets. Before activation the
// site is pending, so the first load carries its preview token — the tenant host
// turns that into a preview cookie for the rest of the visit.
const iframeSrc = computed(() => {
  const slug = createdSite.value?.siteSlug ?? draftPreview.value?.subdomainCandidate
  const origin = slug ? siteOriginFor(slug) : ''
  if (!origin) return ''
  const url = new URL(`${origin}/`)
  if (!createdSite.value && draftPreview.value) {
    url.searchParams.set('preview_token', draftPreview.value.previewToken)
  }
  if (previewReloadToken.value) url.searchParams.set('t', String(previewReloadToken.value))
  return url.toString()
})

const PRE_DRAFT_VISUALS = {
  welcome: {
    url: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/b9f925eb-0b91-4b62-d0e6-8db5df900700/w=800',
    alt: 'Start building your KrabiClaw site',
  },
  vertical: {
    url: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/9c594a4f-41c8-4c81-3545-fe08d9a70c00/w=800',
    alt: 'Choose your business type',
  },
  source: {
    url: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/3c0e50cb-6390-46e9-4143-e8e68fa89900/w=800',
    alt: 'Choose how to add business details',
  },
  businessName: {
    url: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/8be9a754-ef8f-4452-3fc0-90bfa24f2600/w=800',
    alt: 'Add your business name',
  },
  google: {
    url: 'https://imagedelivery.net/Frxyb2_d_vGyiaXhS5xqCg/1952e5fa-e460-46f0-e50a-057dce7e8a00/w=800',
    alt: 'Add business details from Google Maps',
  },
} as const
// The pane swaps between these as the owner steps through the wizard; preloading
// all of them makes each swap instant instead of a blank pane while the next
// image downloads.
useHead({
  link: Object.values(PRE_DRAFT_VISUALS).map(visual => ({ rel: 'preload', as: 'image', href: visual.url })),
})
const preDraftVisual = computed(() => {
  if (iframeSrc.value) return { url: '', alt: '' }
  if (activeStep.value === 'awaiting_manual_name') return PRE_DRAFT_VISUALS.businessName
  if (activeStep.value === 'awaiting_url') return PRE_DRAFT_VISUALS.google
  if (activeStep.value === 'source') return PRE_DRAFT_VISUALS.source
  if (activeStep.value === 'vertical') return PRE_DRAFT_VISUALS.vertical
  if (activeStep.value === 'welcome') return PRE_DRAFT_VISUALS.welcome
  return { url: '', alt: '' }
})

const siteStatus = computed((): 'setup' | 'progress' | 'live' => {
  if (createdSite.value) return 'live'
  if (draftPreview.value) return 'progress'
  return 'setup'
})

const mobilePreviewOpenForViewport = computed({
  get: () => isMobilePreviewViewport.value && mobilePreviewOpen.value,
  set: value => {
    mobilePreviewOpen.value = value
  },
})

let stopMobilePreviewViewportListener: (() => void) | null = null

// ─── Wizard events ────────────────────────────────────────────────────────────
const onSelectLocation = (id: string) => {
  selectedLocationId.value = id
}

const onSiteCreated = ({ siteSlug }: { siteSlug: string | null }) => {
  draftPreview.value = null
  selectedLocationId.value = null
  // The commit response names the live subdomain; without it there is no live
  // site to show, so the pane shows nothing rather than a guess.
  createdSite.value = siteSlug ? { siteSlug } : null
  previewReloadToken.value = Date.now()
}

const onDraftSaved = (draft: {
  draftId: string
  siteId: string
  previewToken: string
  draftName: string
  subdomainCandidate: string
}) => {
  draftPreview.value = draft
  selectedLocationId.value = draft.siteId
  previewReloadToken.value = Date.now()
  // Every wizard step saves the draft again. The slideover covers the wizard, so
  // it opens itself only the first time there is something to preview — after
  // that it is opened on request from the wizard's preview controls.
  if (isMobilePreviewViewport.value && !hasAutoOpenedMobilePreview.value) {
    hasAutoOpenedMobilePreview.value = true
    mobilePreviewOpen.value = true
  }
}

// The wizard's preview controls. On mobile the slideover has to be opened; on
// desktop the pane is already on screen, so refresh it against the saved draft.
const openMobilePreview = () => {
  previewReloadToken.value = Date.now()
  if (isMobilePreviewViewport.value) mobilePreviewOpen.value = true
}

const onDraftCleared = () => {
  draftPreview.value = null
  selectedLocationId.value = null
  previewReloadToken.value = Date.now()
}

// ─── Toast from query params ──────────────────────────────────────────────────
onMounted(() => {
  const mobilePreviewQuery = window.matchMedia('(max-width: 1023.98px)')
  const updateMobilePreviewViewport = () => {
    isMobilePreviewViewport.value = mobilePreviewQuery.matches
    if (!mobilePreviewQuery.matches) mobilePreviewOpen.value = false
  }
  updateMobilePreviewViewport()
  mobilePreviewQuery.addEventListener('change', updateMobilePreviewViewport)
  stopMobilePreviewViewportListener = () => mobilePreviewQuery.removeEventListener('change', updateMobilePreviewViewport)

  if (route.query.payment === 'cancelled') {
    toast.add({ title: 'Payment cancelled', description: 'Your subscription was not completed.', color: 'warning' })
  }
})

onUnmounted(() => {
  stopMobilePreviewViewportListener?.()
  stopMobilePreviewViewportListener = null
})
</script>
