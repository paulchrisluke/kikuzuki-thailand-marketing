<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <!-- A question is open: the list is the index column, the record the detail. -->
  <UDashboardPanel v-else-if="frame.mode.value === 'pair'" id="site-qa">
    <template #header>
      <UDashboardNavbar title="Q&A" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="sitePath" label="Site" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        has-detail
        :dismiss-to="qaPath"
        detail-title="Question"
        wide-detail
        hide-detail-heading
      >
        <template #index>
          <QaList />
        </template>
        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>

  <QaList v-else />
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import QaList from '~/components/dashboard/QaList.vue'

definePageMeta({ layout: 'dashboard', cmsCapabilityKey: 'site.qa' })

const route = useRoute()
const { sitePaths } = useDashboardSiteLinks()

const sitePath = computed(() => sitePaths.value?.site ?? '')
const qaPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/sites/${String(route.params.siteSlug)}/qa`)
const frame = useEditorFrame(qaPath)

useSeoMeta({ title: 'Site Q&A | KrabiClaw Dashboard', robots: 'noindex, nofollow' })
</script>
