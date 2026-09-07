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
import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Platform Admin | KrabiClaw', robots: 'noindex, nofollow' })

const { managedServiceEnabled } = useDashboardSite()

const groups = computed<EditorNavigationGroup[]>(() => [
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { id: 'organizations', label: 'Organizations', summary: 'Sites, locations, billing, and transfers', to: '/admin/organizations' },
      ...(managedServiceEnabled.value
        ? [{ id: 'work', label: 'Work Queue', summary: 'Priority support requests', to: '/admin/work' }]
        : []),
      { id: 'domains', label: 'Domains', summary: 'Custom domain status and sync history', to: '/admin/domains' },
    ],
  },
  {
    id: 'people',
    label: 'People & access',
    items: [
      { id: 'users', label: 'Users', summary: 'Accounts and impersonation', to: '/admin/users' },
      { id: 'members', label: 'Team Members', summary: 'Platform staff access', to: '/admin/members' },
    ],
  },
  {
    id: 'publishing',
    label: 'Publishing',
    items: [
      { id: 'content', label: 'Platform Content', summary: 'Default social sharing media', to: '/admin/content' },
      { id: 'blog', label: 'Blog', summary: 'Platform blog posts', to: '/admin/blog' },
      { id: 'docs', label: 'Documentation', summary: 'Documentation pages and navigation', to: '/admin/docs' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { id: 'analytics', label: 'Analytics', summary: 'Platform-wide usage and activity', to: '/admin/analytics' },
    ],
  },
])
</script>
