import { computed } from 'vue'

/**
 * Where a site-level page row goes when opened.
 *
 * Menu, reservations and experiences are edited per location, and a site row
 * cannot know which location the user means, so it opens the locations list and
 * they choose. It previously resolved a "primary" location and opened that one
 * directly, which silently picked for multi-location tenants.
 */
export function resolveDashboardSitePageDestination(
  path: string,
  sitePath: string,
  locationsPath: string,
): string {
  if (path === '/blog') return `${sitePath}/blog`
  if (path === '/order') return `${sitePath}/orders`
  if (['/services', '/pricing', '/donate', '/schedule'].includes(path)) return `${sitePath}/professional-services`
  if (['/menu', '/products', '/reservations', '/experiences'].includes(path)) return locationsPath
  return `${sitePath}/pages`
}

export function useDashboardSiteLinks() {
  const dashboard = useDashboardSite()
  const dashboardLocation = useDashboardLocation()

  const orgPaths = computed(() => {
    const base = '/dashboard'
    const organizationSlug = dashboard.scope.value?.orgSlug
    const org = organizationSlug ? `${base}/${organizationSlug}` : base
    const settings = `${org}/settings`

    return {
      base,
      org,
      settings,
      settingsGeneral: `${settings}/general`,
      settingsBilling: `${settings}/billing`,
      accountProfile: `${base}/account/profile`,
    }
  })

  const sitePaths = computed(() => {
    const scope = dashboard.scope.value
    if (!scope?.siteSlug) return null

    const site = `/dashboard/${scope.orgSlug}/sites/${scope.siteSlug}`
    const settings = `${site}/settings`

    return {
      site,
      pages: `${site}/pages`,
      qa: `${site}/qa`,
      testimonials: `${site}/testimonials`,
      analytics: `${site}/analytics`,
      blog: `${site}/blog`,
      links: `${site}/links`,
      inbox: `${site}/inbox`,
      order: `${site}/orders`,
      media: `${site}/media`,
      locations: `${site}/locations`,
      domains: `${settings}/domains`,
      settings,
    }
  })

  const locationPaths = computed(() => {
    const site = sitePaths.value
    const locationSlug = dashboardLocation.currentLocationSlug.value
    if (!site || !locationSlug) return null

    const location = `${site.locations}/${locationSlug}`

    return {
      location,
      products: `${location}/products`,
      experiences: `${location}/experiences`,
      posts: `${location}/posts`,
      photos: `${location}/photos`,
      qa: `${location}/qa`,
      inbox: `${location}/inbox`,
      reservations: `${location}/reservations`,
      settings: `${location}/settings`,
    }
  })

  return {
    orgPaths,
    sitePaths,
    locationPaths,
  }
}
