<template>
  <header class="sticky top-0 z-40 border-b border-default bg-default text-default backdrop-blur">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="inline-flex min-w-0 items-center">
        <span class="truncate text-xl font-bold tracking-tight uppercase">{{ restaurantName }}</span>
      </NuxtLink>

      <nav class="hidden items-center gap-1 lg:flex" aria-label="Saya navigation">
        <NuxtLink
          to="/"
          class="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-muted hover:text-default"
        >
          Home
        </NuxtLink>

        <!-- Menu: single location → direct link; 2+ → dropdown per location -->
        <NuxtLink
          v-if="menuLinks.length === 1"
          :to="menuLinks[0].to"
          class="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-muted hover:text-default"
        >
          Menu
        </NuxtLink>
        <UDropdownMenu v-else-if="menuLinks.length > 1" :items="menuDropdownItems">
          <button class="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-muted hover:text-default">
            Menu
            <UIcon name="i-heroicons-chevron-down" class="size-3.5" />
          </button>
        </UDropdownMenu>

        <NuxtLink
          v-for="link in sayaNavLinks.slice(1)"
          :key="link.to"
          :to="link.to"
          class="rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-muted hover:text-default"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-2">
        <UDropdownMenu :items="languageItems">
          <UButton variant="ghost" color="neutral" size="sm">
            <span>{{ getCurrentLocaleFlag() }}</span>
            <span>{{ currentLocale }}</span>
          </UButton>
        </UDropdownMenu>
        <UColorModeButton variant="ghost" color="neutral" size="sm" />
        <UButton to="/reservations" color="neutral" variant="solid" size="xl">Reserve</UButton>
        <UButton
          icon="i-heroicons-bars-3"
          color="neutral"
          variant="ghost"
          size="sm"
          class="lg:hidden"
          :aria-label="mobileMenuOpen ? 'Close navigation' : 'Open navigation'"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        />
      </div>

      <div
        v-if="mobileMenuOpen"
        class="absolute inset-x-0 top-16 border-b border-default bg-default p-4 shadow-sm lg:hidden"
      >
        <nav class="grid gap-1" aria-label="Saya mobile navigation">
          <NuxtLink
            v-for="link in mobileNavLinks"
            :key="link.to"
            :to="link.to"
            class="rounded-full px-4 py-3 text-sm font-medium text-default hover:bg-muted"
            @click="mobileMenuOpen = false"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>
    </div>
  </header>
</template>

<script setup>
import { sayaNavLinks } from '~/config/saya-theme'

const { isPlatform, siteId, site } = useTenantSite()
const { locale, locales, setLocale } = useI18n()
const mobileMenuOpen = ref(false)

const currentLocale = computed(() => locale.value)
const availableLocales = computed(() => locales.value.map(l => ({ code: l.code, name: l.name })))
const switchLocale = (code) => { setLocale(code) }
const getLocaleFlag = (code) => ({ en: '🇺🇸', th: '🇹🇭', ja: '🇯🇵', ar: '🇸🇦' }[code] || '🌐')
const getCurrentLocaleFlag = () => getLocaleFlag(currentLocale.value)
const restaurantName = computed(() => site?.name || 'Saya Kitchen')
const languageItems = computed(() =>
  availableLocales.value.map(l => ({ label: `${getLocaleFlag(l.code)} ${l.name}`, onSelect: () => switchLocale(l.code) }))
)

// Fetch locations to build the Menu nav entry
const { data: locationsData } = siteId
  ? await useFetch(`/api/public/sites/${siteId}/locations`, { key: `header-locs-${siteId}`, default: () => ({ locations: [] }) })
  : { data: ref({ locations: [] }) }

const locations = computed(() => locationsData.value?.locations ?? [])

// One entry per location linking to its menu; falls back to nothing if no locations
const menuLinks = computed(() =>
  locations.value.map(loc => ({ label: loc.title, to: `/locations/${loc.slug}/menu` }))
)

// UDropdownMenu items format
const menuDropdownItems = computed(() =>
  menuLinks.value.map(l => ({ label: l.label, to: l.to }))
)

// Mobile nav: Home + menu links + remaining static links
const mobileNavLinks = computed(() => [
  { label: 'Home', to: '/' },
  ...menuLinks.value.map(l => ({ label: `${l.label} Menu`, to: l.to })),
  ...sayaNavLinks.slice(1),
])
</script>
