<template>
  <UDashboardPanel id="admin-blog-editor">
    <template #header>
      <UDashboardNavbar title="New Post" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading to="/admin/blog" label="Posts" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <BlogPostEditor
        :repository="repository"
        title="New Blog Post"
        back-url="/admin/blog"
        back-label="Posts"
        :is-edit="false"
      />
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import { platformBlogRepository } from '~/lib/components/workspace/blog/platformBlogRepository'
import BlogPostEditor from '~/lib/components/workspace/blog/BlogPostEditor.vue'

definePageMeta({ layout: 'dashboard' })

const repository = platformBlogRepository()

useSeoMeta({ title: 'New Post | Admin' })
</script>
