<template>
  <NuxtPage v-if="frame.mode.value === 'yield'" />

  <UDashboardPanel
    v-else
    id="organization-settings"
    :ui="{ body: 'min-h-0 gap-0! overflow-hidden! p-0! sm:p-0!' }"
  >
    <template #header>
      <UDashboardNavbar title="Organization Settings" :toggle="false">
        <template #leading>
          <DashboardNavbarLeading :to="menuPath" label="Menu" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell
        :has-detail="frame.mode.value === 'pair'"
        :detail-title="detailTitle"
        :dismiss-to="settingsPath"
        :wide-detail="wideDetail"
      >
        <template #index>
          <EditorNavigationList :groups="groups" :active-item="activeItem" />
        </template>

        <template #detail>
          <NuxtPage />
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'

definePageMeta({ layout: 'dashboard' })

const route = useRoute()

// The frame comes first, and before any `await`: `useEditorFrame` provides and
// injects, which Vue binds only while setup is still synchronous.
const settingsPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/settings`)
const frame = useEditorFrame(settingsPath)

const dashboard = useDashboardSite()
if (!dashboard.state.value) await dashboard.refresh()

const { groups, activeItem } = useOrganizationSettingsNavigation()

const menuPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/menu`)

/**
 * The open section names itself from the same list the index renders, so a
 * renamed section changes in one place. A section that wants the wider pane
 * says so in its own `definePageMeta`, the way `ownsChrome` is declared, rather
 * than this level keeping a list of which sections are special.
 */
const detailTitle = computed(() => {
  const open = frame.childSegment.value
  if (!open) return undefined
  for (const group of groups.value) {
    const item = group.items.find(candidate => candidate.id === open)
    if (item) return item.label
  }
  return undefined
})

const wideDetail = computed(() => route.meta.wideDetail === true)
</script>
