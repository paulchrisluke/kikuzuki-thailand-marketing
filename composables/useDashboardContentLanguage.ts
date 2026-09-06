import { platformLocale } from '~/shared/platform-locales'

interface DashboardContentLanguageRow {
  locale: string
  label: string
  is_source: boolean | number
  locale_status: string
  license_status: string | null
}

interface DashboardContentLanguageState {
  siteId: string | null
  locale: string | null
  sourceLocale: string | null
  languages: Array<{ locale: string; label: string; source: boolean }>
  loading: boolean
  loaded: boolean
  error: string | null
}

function isLanguageResponse(value: unknown): value is { languages: DashboardContentLanguageRow[] } {
  return isRecord(value) && Array.isArray(value.languages)
    && value.languages.every(language => isRecord(language)
      && typeof language.locale === 'string'
      && typeof language.label === 'string'
      && (typeof language.is_source === 'boolean' || typeof language.is_source === 'number')
      && typeof language.locale_status === 'string'
      && (language.license_status === null || typeof language.license_status === 'string'))
}

export function useDashboardContentLanguage() {
  const dashboardApi = useDashboardApi()
  const state = useState<DashboardContentLanguageState>('dashboard-content-language', () => ({
    siteId: null,
    locale: null,
    sourceLocale: null,
    languages: [],
    loading: false,
    loaded: false,
    error: null,
  }))

  async function load(siteId: string, force = false): Promise<void> {
    if (!force && state.value.siteId === siteId && state.value.loaded) return
    state.value = { siteId, locale: null, sourceLocale: null, languages: [], loading: true, loaded: false, error: null }
    try {
      const response = await dashboardApi<{ languages: DashboardContentLanguageRow[] }>(
        `/api/editor/sites/${siteId}/locales`,
        { validate: isLanguageResponse },
      )
      const published = response.languages.filter(language => language.locale_status === 'published'
        && (Boolean(language.is_source) || language.license_status === 'active'))
      const sources = published.filter(language => Boolean(language.is_source))
      if (sources.length !== 1) throw new Error('This site does not have exactly one published primary language')
      const source = sources[0]!
      const languages = published.map((language) => {
        const catalog = platformLocale(language.locale)
        if (!catalog) throw new Error(`The ${language.locale} interface catalog is unavailable`)
        return { locale: language.locale, label: catalog.label, source: Boolean(language.is_source) }
      })
      const cookie = useCookie<string | null>(`kc-content-language-${siteId}`, { sameSite: 'lax' })
      let selectedLocale = source.locale
      if (cookie.value && languages.some(language => language.locale === cookie.value)) selectedLocale = cookie.value
      if (state.value.siteId !== siteId) return
      state.value = {
        siteId,
        locale: selectedLocale,
        sourceLocale: source.locale,
        languages,
        loading: false,
        loaded: true,
        error: null,
      }
    } catch (cause) {
      if (state.value.siteId !== siteId) return
      state.value = {
        siteId,
        locale: null,
        sourceLocale: null,
        languages: [],
        loading: false,
        loaded: false,
        error: cause instanceof Error ? cause.message : 'Site languages could not be loaded',
      }
    }
  }

  function select(siteId: string, locale: string): void {
    if (state.value.siteId !== siteId || !state.value.languages.some(language => language.locale === locale)) {
      throw new Error('Choose a published language for this site')
    }
    state.value.locale = locale
    useCookie<string | null>(`kc-content-language-${siteId}`, { sameSite: 'lax' }).value = locale
  }

  return {
    state: readonly(state),
    locale: computed(() => state.value.locale),
    sourceLocale: computed(() => state.value.sourceLocale),
    languages: computed(() => state.value.languages),
    loading: computed(() => state.value.loading),
    error: computed(() => state.value.error),
    load,
    select,
  }
}
