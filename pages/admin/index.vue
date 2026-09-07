<template>
  <UDashboardPanel id="admin-hub">
    <template #header>
      <UDashboardNavbar title="Platform Admin" />
    </template>

    <template #body>
      <UPage>
        <UPageBody>
          <EditorNavigationList :groups="groups" variant="rows" />
        </UPageBody>
      </UPage>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Platform Admin | KrabiClaw', robots: 'noindex, nofollow' })

const { managedServiceEnabled } = useDashboardSite()

const groups = useAdminNavigationGroups(managedServiceEnabled)
</script>
