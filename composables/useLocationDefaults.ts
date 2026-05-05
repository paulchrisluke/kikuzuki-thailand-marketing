import { computed } from 'vue'
import { useRoute } from '#app'
import { useEditorContext } from './useEditorContext'

export const useLocationDefaults = (siteId?: string) => {
  const route = useRoute()
  const { context, setScope, loading } = useEditorContext(siteId)

  // Determine default scope based on current page
  const defaultScope = computed(() => {
    if (!context.value || loading.value) return null

    const path = route.path
    
    // Location pages: /locations/[slug]
    const locationMatch = path.match(/^\/locations\/([^\/]+)$/)
    if (locationMatch) {
      const slug = locationMatch[1]
      const location = context.value.locations.find(loc => loc.slug === slug)
      if (location) {
        return {
          id: location.id,
          label: location.title,
          type: 'location' as const
        }
      }
    }

    // Brand pages: /, /about, /menu, /contact, etc.
    // Default to brand-wide
    return {
      id: null,
      label: 'Brand-wide',
      type: 'brand' as const
    }
  })

  // Auto-set default scope when context loads
  const applyDefaultScope = () => {
    if (defaultScope.value && context.value) {
      const matchingScope = context.value.scopes.find(s => s.id === defaultScope.value?.id)
      if (matchingScope) {
        setScope(matchingScope)
      }
    }
  }

  // Watch for context changes and apply default
  watch(() => context.value, (newContext) => {
    if (newContext && !loading.value) {
      applyDefaultScope()
    }
  }, { immediate: true })

  // Watch for route changes and apply default
  watch(() => route.path, () => {
    if (context.value && !loading.value) {
      applyDefaultScope()
    }
  })

  return {
    defaultScope,
    applyDefaultScope
  }
}
