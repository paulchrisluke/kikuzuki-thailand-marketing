<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- An experience is open: my list is the index column, it is the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="location-experiences">
    <template #header>
      <UDashboardNavbar title="Experiences" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="locationPath" label="Location" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        :dismiss-to="experiencesPath"
        detail-title="Experience"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <ExperienceList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <ExperienceList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import ExperienceList from '~/components/dashboard/ExperienceList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.experiences' })

const route = useRoute()

// The path comes from the route this screen is mounted on, not from the
// location selector: an unresolved selector left it empty, and an empty path is
// a link to nowhere and, where it roots the editor frame, a frame rooted at ''.
const locationPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/locations/${String(route.params.locationSlug)}`)
const experiencesPath = computed(() => `${locationPath.value}/experiences`)
const frame = useEditorFrame(experiencesPath)
</script>
