import { splitLocalePrefix } from '~/utils/tenant-locale-path'

export default defineNuxtRouteMiddleware(async (to) => {
  const state = useState<string>('public-locale', () => 'en')
  const setAppLocale = (locale: string, messages: Record<string, string> | null) => {
    const { $setAppLocale } = useNuxtApp() as {
      $setAppLocale?: (value: string, catalog: Record<string, string> | null) => void
    }
    if (!$setAppLocale) throw new Error('Application locale setter is unavailable')
    $setAppLocale(locale, messages)
  }
  // The tenant's localized routes are handled by the catch-all page, so Nuxt
  // exposes `tenantPath` rather than a named `locale` param. On the server,
  // resolve the first path segment against this site's published locales before
  // layouts request the shared shell. On the client, use the route's published
  // representations to distinguish a locale prefix from a source path.
  if (import.meta.client) {
    const representations = useState<Array<{ locale: string }>>('public-locale-representations', () => [])
    if (!representations.value.length) return
    const candidate = splitLocalePrefix(to.path).localeSegment
    const locale = candidate && representations.value.some(item => item.locale === candidate)
      ? candidate
      : 'en'
    state.value = locale
    const messages = locale === 'en'
      ? null
      : useState<Record<string, string> | null>('platform-locale-messages', () => null).value
    setAppLocale(locale, messages)
    return
  }

  state.value = 'en'
  const candidate = splitLocalePrefix(to.path).localeSegment
  if (!candidate || candidate === 'en') return

  const event = useRequestEvent()
  const siteId = event?.context.siteId as string | null | undefined
  if (!event || !siteId) return
  const [{ cloudflareEnv }, { queryFirst }, { assertPublicSiteLanguageEntitlement }] = await Promise.all([
    import('~/server/utils/api-response'),
    import('~/server/db'),
    import('~/server/utils/localization'),
  ])
  const db = cloudflareEnv(event).db
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const locale = await queryFirst<{ locale: string; organization_id: string }>(db, `
    SELECT sl.locale, s.organization_id
      FROM site_locales sl
      JOIN sites s ON s.id = sl.site_id AND s.organization_id = sl.organization_id
     WHERE s.id = ? AND s.status = 'active'
       AND sl.locale = ? AND sl.is_source = 0 AND sl.status = 'published'
     LIMIT 1
  `, [siteId, candidate])
  if (!locale) return
  const entitlement = await assertPublicSiteLanguageEntitlement(db, locale.organization_id, siteId, locale.locale)
  const messages = entitlement.platform_messages ?? {}
  state.value = locale.locale
  useState<Record<string, string> | null>('platform-locale-messages', () => null).value = messages
  setAppLocale(locale.locale, messages)
})
