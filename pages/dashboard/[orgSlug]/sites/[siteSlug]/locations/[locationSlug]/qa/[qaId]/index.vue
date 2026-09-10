<template>
  <QaEditorPage :location-id="locationId" />
</template>

<script setup lang="ts">
import QaEditorPage from '~/components/dashboard/QaEditorPage.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.qa', ownsChrome: true })

const dashboardLocation = useDashboardLocation()
const locationId = computed(() => {
  const value = dashboardLocation.currentLocationId.value
  if (!value) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
  return value
})
</script>
