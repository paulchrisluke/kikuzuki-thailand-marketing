<template>
  <NuxtLayout :name="isPlatform ? 'platform' : 'saya'">
    <LazyPlatformExperiencesPage v-if="isPlatform" />
    <LazySayaExperiencesPage v-else />
  </NuxtLayout>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
const { isPlatform } = useTenantSite()
</script>
