import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'

// Single source of truth for the organization settings index. Both the full
// settings editor (components/dashboard/OrganizationSettingsShell.vue) and the
// dashboard menu slideover render this same list, so an added or renamed
// settings section shows up in both without touching either component.
export function useOrganizationSettingsNavigation() {
  const route = useRoute()
  const dashboard = useDashboardSite()
  const { preference } = usePlatformTheme()

  const organization = dashboard.organization
  const settingsPath = computed(() => `/dashboard/${String(route.params.orgSlug)}/settings`)

  const items = computed(() => [
    { id: 'general', label: 'General', summary: organization.value?.name || 'Organization details', to: `${settingsPath.value}/general` },
    { id: 'appearance', label: 'Appearance', summary: `${preference.value.charAt(0).toUpperCase()}${preference.value.slice(1)} theme`, to: `${settingsPath.value}/appearance` },
    { id: 'members', label: 'Members', summary: 'People and organization access', to: `${settingsPath.value}/members` },
    { id: 'billing', label: 'Billing', summary: 'Plans and payments', to: `${settingsPath.value}/billing` },
    // Named for what it is — connecting Google's tools — so it does not read as
    // a second copy of Insights, which is where the figures actually live.
    { id: 'analytics', label: 'Google Analytics', summary: 'Connect Google Analytics and Search Console', to: `${settingsPath.value}/analytics` },
    { id: 'chatgpt', label: 'ChatGPT', summary: 'Organization ChatGPT connection', to: `${settingsPath.value}/chatgpt` },
  ])

  const groups = computed<EditorNavigationGroup[]>(() => [
    { id: 'organization', label: 'Organization', items: items.value.slice(0, 3) },
    { id: 'account', label: 'Account and connections', items: items.value.slice(3) },
  ])

  const activeItem = computed(() => {
    const segment = route.path.slice(`${settingsPath.value}/`.length).split('/')[0]
    return route.path === settingsPath.value ? null : segment
  })

  return { settingsPath, groups, activeItem }
}
