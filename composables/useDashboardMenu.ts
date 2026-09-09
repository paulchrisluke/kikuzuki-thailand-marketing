import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import { dashboardScopeHeaderModelKey } from '~/lib/components/workspace/dashboard/dashboardScopeHeaderContext'

export function useDashboardMenu() {
  const route = useRoute()
  const scopeHeaderModel = inject(dashboardScopeHeaderModelKey, null)
  const organizationSettings = useOrganizationSettingsNavigation()

  const orgBase = computed(() => {
    const slug = route.params.orgSlug
    return typeof slug === 'string' && slug ? `/dashboard/${slug}` : null
  })

  /** Links shown in the top nav and the bottom bar; the organization surfaces build their own. */
  const primaryNavItems = computed<Array<{ key: string; label: string; icon: string; to: string; active: boolean }> | null>(() => null)

  /** Where the bottom bar's Menu item navigates on mobile. */
  const menuPageTo = computed(() => orgBase.value ? `${orgBase.value}/menu` : '/dashboard')

  const notificationsTo = computed(() => orgBase.value ? `${orgBase.value}/notifications` : null)

  const groups = computed<EditorNavigationGroup[]>(() => organizationSettings.groups.value)
  const activeItem = computed(() => organizationSettings.activeItem.value)

  /** Organization/site switcher. */
  const scopeModel = computed(() => scopeHeaderModel?.value ?? null)

  return { primaryNavItems, menuPageTo, notificationsTo, groups, activeItem, scopeModel }
}
