import { splitLocalePrefix } from '~/utils/tenant-locale-path'
import { platformLocale } from '~/shared/platform-locales'

export default defineNuxtRouteMiddleware(async (to) => {
  const state = useState<string>('public-locale', () => 'en')
  const setAppLocale = (locale: string, messages: Record<string, string> | null) => {
    const { $setAppLocale } = useNuxtApp() as {
      $setAppLocale?: (value: string, catalog: Record<string, string> | null) => void
    }
    if (!$setAppLocale) throw new Error('Application locale setter is unavailable')
    $setAppLocale(locale, messages)
  }
  const explicitLocale = typeof to.params.locale === 'string' ? to.params.locale : null
  if (import.meta.client) {
    const representations = useState<Array<{ locale: string; source: 'source' | 'localized' }>>('public-locale-representations', () => [])
    let locale: string
    if (explicitLocale) {
      locale = explicitLocale
    }
    else {
      if (!representations.value.length) return
      const candidate = splitLocalePrefix(to.path).localeSegment
      const source = representations.value.find(item => item.source === 'source')
      if (!source) throw createError({ statusCode: 500, statusMessage: 'Site primary language is unavailable' })
      const destinationCatalog = candidate ? platformLocale(candidate) : null
      locale = destinationCatalog ? destinationCatalog.locale : source.locale
      }
    state.value = locale
    const catalog = platformLocale(locale)
    if (!catalog) throw createError({ statusCode: 500, statusMessage: 'Application language catalog is unavailable' })
    setAppLocale(locale, { ...catalog.messages })
    return
  }

  const candidate = splitLocalePrefix(to.path).localeSegment

  const event = useRequestEvent()
  const siteId = event?.context.siteId as string | null | undefined
  if (!event || !siteId) return
  const [{ cloudflareEnv }, { queryFirst }, { assertPublicSiteLanguageEntitlement, getPersistedSourceLocale }] = await Promise.all([
    import('~/server/utils/api-response'),
    import('~/server/db'),
    import('~/server/utils/localization'),
  ])
  const db = cloudflareEnv(event).db
  if (!db) throw createError({ statusCode: 503, statusMessage: 'Database unavailable' })
  const currentSite = await queryFirst<{ organization_id: string }>(db, `
    SELECT organization_id FROM sites WHERE id = ? AND status = 'active' LIMIT 1
  `, [siteId])
  if (!currentSite) throw createError({ statusCode: 404, statusMessage: 'Site not found' })
  const source = await getPersistedSourceLocale(db, currentSite.organization_id, siteId)
  const sourceCatalog = platformLocale(source.locale)
  if (!sourceCatalog) throw createError({ statusCode: 500, statusMessage: 'Site primary language is unavailable' })
  state.value = source.locale
  setAppLocale(source.locale, { ...sourceCatalog.messages })
  if (!candidate || !platformLocale(candidate)) return
  if (candidate === source.locale) throw createError({ statusCode: 404, statusMessage: 'Primary language routes are unprefixed' })
  const locale = await queryFirst<{ locale: string; organization_id: string }>(db, `
    SELECT sl.locale, s.organization_id
      FROM site_locales sl
      JOIN sites s ON s.id = sl.site_id AND s.organization_id = sl.organization_id
     WHERE s.id = ? AND s.status = 'active'
       AND sl.locale = ? AND sl.is_source = 0 AND sl.status = 'published'
     LIMIT 1
  `, [siteId, candidate])
  if (!locale) throw createError({ statusCode: 404, statusMessage: 'Language is not enabled for this site' })
  const entitlement = await assertPublicSiteLanguageEntitlement(db, locale.organization_id, siteId, locale.locale)
  if (!entitlement.platform_messages) {
    throw createError({ statusCode: 503, statusMessage: 'Published platform locale messages are unavailable' })
  }
  const messages = entitlement.platform_messages
  state.value = locale.locale
  useState<Record<string, string> | null>('platform-locale-messages', () => null).value = messages
  setAppLocale(locale.locale, messages)
})
