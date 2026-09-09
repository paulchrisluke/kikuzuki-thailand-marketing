<template>
  <UDashboardPanel id="admin-hub">
    <template #header>
      <UDashboardNavbar title="Platform Admin" />
    </template>

    <template #body>
      <div class="w-full max-w-[var(--ws-page-narrow,45rem)]">
        <EditorNavigationList :groups="groups" variant="rows" />
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Platform Admin | KrabiClaw', robots: 'noindex, nofollow' })

const groups = useAdminNavigationGroups()
</script>
