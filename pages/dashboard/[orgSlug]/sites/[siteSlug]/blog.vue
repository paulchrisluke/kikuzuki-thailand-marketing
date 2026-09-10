<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- A post is open: my list is the index column, the post is the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="site-blog">
    <template #header>
      <UDashboardNavbar title="Blog" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="sitePath" label="Site" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        :dismiss-to="blogPath"
        detail-title="Post"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <BlogPostList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <BlogPostList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import BlogPostList from '~/components/dashboard/BlogPostList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.blog' })

const route = useRoute()
const { sitePaths } = useDashboardSiteLinks()

const sitePath = computed(() => sitePaths.value?.site ?? '')
const blogPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/blog`)
const frame = useEditorFrame(blogPath)
</script>
