<template>
  <ProfessionalServiceEditorPage />
</template>

<script setup lang="ts">
import ProfessionalServiceEditorPage from '~/components/dashboard/ProfessionalServiceEditorPage.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.services', ownsChrome: true })
</script>
