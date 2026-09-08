<template>
  <BlogPostList />
</template>

<script setup lang="ts">
import BlogPostList from '~/components/dashboard/BlogPostList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.blog' })

useSeoMeta({ title: 'Blog | Dashboard' })
</script>
