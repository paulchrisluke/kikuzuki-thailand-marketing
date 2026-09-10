<template>
  <QaEditorPage :location-id="locationId" />
</template>

<script setup lang="ts">
import QaEditorPage from '~/components/dashboard/QaEditorPage.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.qa', ownsChrome: true })

const locationId = useDashboardLocation().currentLocationId.value
if (!locationId) throw createError({ statusCode: 404, statusMessage: 'Location not found' })
</script>
