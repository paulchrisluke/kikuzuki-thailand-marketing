import type { EditorNavigationGroup, EditorNavigationItem } from '~/components/dashboard/EditorNavigationList.vue'
import { dashboardScopeHeaderModelKey } from '~/lib/components/workspace/dashboard/dashboardScopeHeaderContext'

interface AdminNavigationItem extends EditorNavigationItem { to: string; primary?: boolean }
interface AdminNavigationGroup extends Omit<EditorNavigationGroup, 'items'> { items: AdminNavigationItem[] }

// The one description of "what is in the platform admin". The admin hub page,
// the desktop slideover, the top nav and the mobile bottom bar are containers
// for this single model — none builds a list of its own, so they cannot drift.
//
// Admin keeps four `primary` links in the bar and the rest in the menu: the
// full list will not fit a centred bar, and splitting it is what lets admin
// share the tenant chrome instead of earning a second layout.
//
// KrabiClaw's own blog and sharing image are not here: the platform site is an
// ordinary organization/site, edited through the same dashboard CMS as every
// tenant. Only genuinely platform-level operations belong in this list.
export function useAdminNavigationGroups() {
  const dashboard = useDashboardSite()
  return computed<AdminNavigationGroup[]>(() => [
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'organizations', label: 'Organizations', summary: 'Sites, locations, billing, and transfers', to: '/admin/organizations', primary: true },
        ...(dashboard.managedServiceEnabled.value ? [{ id: 'work', label: 'Work Queue', summary: 'Managed service requests', to: '/admin/work' }] : []),
        { id: 'domains', label: 'Domains', summary: 'Custom domain status and sync history', to: '/admin/domains' },
      ],
    },
    {
      id: 'people',
      label: 'People & access',
      items: [
        { id: 'users', label: 'Users', summary: 'Accounts and impersonation', to: '/admin/users', primary: true },
        { id: 'members', label: 'Team Members', summary: 'Platform staff access', to: '/admin/members' },
      ],
    },
    {
      id: 'publishing',
      label: 'Publishing',
      items: [
        { id: 'docs', label: 'Documentation', summary: 'Help pages and their navigation', to: '/admin/docs', primary: true },
      ],
    },
    {
      id: 'insights',
      label: 'Insights',
      items: [
        { id: 'analytics', label: 'Analytics', summary: 'Platform-wide usage and activity', to: '/admin/analytics', primary: true },
      ],
    },
  ])
}

export function useDashboardMenu() {
  const route = useRoute()
  const adminNavigationGroups = useAdminNavigationGroups()
  const scopeHeaderModel = inject(dashboardScopeHeaderModelKey, null)
  const organizationSettings = useOrganizationSettingsNavigation()

  const isAdminRoute = computed(() => typeof route.name === 'string' && route.name.startsWith('admin'))
  const orgBase = computed(() => {
    const slug = route.params.orgSlug
    return typeof slug === 'string' && slug ? `/dashboard/${slug}` : null
  })

  function isActivePath(path: string, exact = false) {
    return route.path === path || (!exact && route.path.startsWith(`${path}/`))
  }

  const adminItems = computed(() => adminNavigationGroups.value.flatMap(group => group.items))

  /** Links shown in the top nav and the bottom bar. */
  const primaryNavItems = computed(() => {
    if (!isAdminRoute.value) return null
    return adminItems.value
      .filter(item => item.primary)
      .map(item => ({ key: item.id, label: item.label, icon: 'i-lucide-square', to: item.to, active: isActivePath(item.to) }))
  })

  /** Where the bottom bar's Menu item navigates on mobile. */
  const menuPageTo = computed(() => isAdminRoute.value ? '/admin' : orgBase.value ? `${orgBase.value}/menu` : '/dashboard')

  const notificationsTo = computed(() => isAdminRoute.value || !orgBase.value ? null : `${orgBase.value}/notifications`)

  const groups = computed<EditorNavigationGroup[]>(() => {
    if (isAdminRoute.value) return adminNavigationGroups.value
      .map(group => ({ ...group, items: group.items.filter(item => !item.primary) }))
      .filter(group => group.items.length > 0)
    return organizationSettings.groups.value
  })

  const activeItem = computed(() => {
    if (isAdminRoute.value) return adminItems.value.find(item => isActivePath(item.to))?.id ?? null
    return organizationSettings.activeItem.value
  })

  /** Organization/site switcher. Null on surfaces with no scope, e.g. admin. */
  const scopeModel = computed(() => isAdminRoute.value ? null : scopeHeaderModel?.value ?? null)

  return { isAdminRoute, primaryNavItems, menuPageTo, notificationsTo, groups, activeItem, scopeModel }
}
