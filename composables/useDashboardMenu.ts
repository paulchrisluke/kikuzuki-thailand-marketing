import type { EditorNavigationGroup, EditorNavigationItem } from '~/components/dashboard/EditorNavigationList.vue'
import { dashboardScopeHeaderModelKey } from '~/lib/components/workspace/dashboard/dashboardScopeHeaderContext'

interface AdminNavigationItem extends EditorNavigationItem { primary?: boolean }
interface AdminNavigationGroup extends Omit<EditorNavigationGroup, 'items'> { items: AdminNavigationItem[] }

export function useAdminNavigationGroups() {
  return computed<AdminNavigationGroup[]>(() => [
    {
      id: 'operations',
      label: 'Operations',
      items: [
        { id: 'organizations', label: 'Organizations', summary: 'Sites, locations, billing, and transfers', to: '/admin/organizations', primary: true },
        { id: 'work', label: 'Work Queue', summary: 'Priority support requests', to: '/admin/work' },
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
        { id: 'content', label: 'Platform Content', summary: 'Default social sharing media', to: '/admin/content', primary: true },
        { id: 'blog', label: 'Blog', summary: 'Platform blog posts', to: '/admin/blog' },
        { id: 'docs', label: 'Documentation', summary: 'Documentation pages and navigation', to: '/admin/docs' },
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
    const slug = typeof route.params.orgSlug === 'string' ? route.params.orgSlug : null
    return slug ? `/dashboard/${encodeURIComponent(slug)}` : null
  })

  function isActivePath(path: string, exact = false) {
    return route.path === path || (!exact && route.path.startsWith(`${path}/`))
  }

  const adminItems = computed(() => adminNavigationGroups.value.flatMap(group => group.items))

  const primaryNavItems = computed(() => {
    if (!isAdminRoute.value) return null
    return adminItems.value
      .filter(item => item.primary)
      .map(item => ({ key: item.id, label: item.label, icon: 'i-lucide-square', to: item.to, active: isActivePath(item.to) }))
  })

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

  const scopeModel = computed(() => isAdminRoute.value ? null : scopeHeaderModel?.value ?? null)

  return { isAdminRoute, primaryNavItems, menuPageTo, notificationsTo, groups, activeItem, scopeModel }
}
