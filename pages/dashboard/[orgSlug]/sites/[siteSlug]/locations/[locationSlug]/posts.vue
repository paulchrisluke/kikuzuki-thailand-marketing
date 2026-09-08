<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- A post is open: my list is the index column, the post is the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="location-posts">
    <template #header>
      <UDashboardNavbar title="Posts" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="locationPath" label="Location" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        show-desktop-detail
        :dismiss-to="postsPath"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <PostList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <PostList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import PostList from '~/components/dashboard/PostList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'location.posts' })

const route = useRoute()
const { locationPaths } = useDashboardSiteLinks()

const postsPath = computed(() => locationPaths.value?.posts ?? '')
const locationPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/locations/${String(route.params.locationSlug)}`)
const frame = useEditorFrame(postsPath)
</script>
