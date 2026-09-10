<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- A service is open: the list is the index column, the record the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="site-professional-services">
    <template #header>
      <UDashboardNavbar title="Services" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="sitePath" label="Site" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        :dismiss-to="servicesPath"
        detail-title="Service"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <ProfessionalServiceList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <ProfessionalServiceList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import ProfessionalServiceList from '~/components/dashboard/ProfessionalServiceList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.services' })

const route = useRoute()

// Both paths come from the route this page is mounted on, so the back link
// cannot end up pointing nowhere while the page itself renders.
const sitePath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}`)
const servicesPath = computed(() => `${sitePath.value}/professional-services`)
const frame = useEditorFrame(servicesPath)

useSeoMeta({ title: 'Services | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
