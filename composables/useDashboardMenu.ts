import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import { dashboardScopeHeaderModelKey } from '~/lib/components/workspace/dashboard/dashboardScopeHeaderContext'

// The one description of "what is in the menu". The desktop slideover and the
// mobile menu page are two containers for this single model — neither builds a
// list of its own, so they cannot drift apart. The admin surface swaps the
// content here rather than anywhere downstream, for the same reason.
//
// Admin keeps four links in the bar and the rest in the menu: ten will not fit a
// centred bar, and splitting them is what lets admin share the tenant chrome
// instead of earning a second layout.
const ADMIN_PRIMARY = ['/admin/organizations', '/admin/users', '/admin/content', '/admin/analytics']

export function useAdminNavigationGroups(managedServiceEnabled: Ref<boolean>) {
  return computed<EditorNavigationGroup[]>(() => [
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
}

export function useDashboardMenu() {
  const route = useRoute()
  const dashboard = useDashboardSite()
  const adminNavigationGroups = useAdminNavigationGroups(dashboard.managedServiceEnabled)
  const scopeHeaderModel = inject(dashboardScopeHeaderModelKey, null)
  const organizationSettings = useOrganizationSettingsNavigation()

  const isAdminRoute = computed(() => typeof route.name === 'string' && route.name.startsWith('admin'))

  const orgBase = computed(() => {
    const slug = typeof route.params.orgSlug === 'string' ? route.params.orgSlug : null
    return slug ? `/dashboard/${encodeURIComponent(slug)}` : null
  })

  function isActivePath(path: string, exact = false) {
    return route.path === path || (!exact && route.path.startsWith(`${path}/`))
  }

  const adminItems = computed(() => adminNavigationGroups.value.flatMap(group => group.items))

  /** Links shown in the top nav and the bottom bar. */
  const primaryNavItems = computed(() => {
    if (!isAdminRoute.value) return null
    return adminItems.value
      .filter(item => ADMIN_PRIMARY.includes(item.to))
      .map(item => ({ key: item.id, label: item.label, icon: 'i-lucide-square', to: item.to, active: isActivePath(item.to) }))
  })

  /** Where the bottom bar's Menu item navigates on mobile. */
  const menuPageTo = computed(() => isAdminRoute.value ? '/admin' : orgBase.value ? `${orgBase.value}/menu` : '/dashboard')

  const notificationsTo = computed(() => isAdminRoute.value || !orgBase.value ? null : `${orgBase.value}/notifications`)

  const groups = computed<EditorNavigationGroup[]>(() => {
    if (isAdminRoute.value) {
      return [{ id: 'admin', label: 'Platform admin', items: adminItems.value.filter(item => !ADMIN_PRIMARY.includes(item.to)) }]
    }
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
