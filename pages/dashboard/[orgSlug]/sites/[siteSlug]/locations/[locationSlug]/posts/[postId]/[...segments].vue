<template>
  <PostEditorPage />
</template>

<script setup lang="ts">
import PostEditorPage from '~/components/dashboard/PostEditorPage.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.posts' })
</script>
