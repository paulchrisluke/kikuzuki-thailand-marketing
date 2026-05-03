<template>
  <div>
    <AppHero
      id="section-hero"
      :title="getField('hero.title', 'Take Me Away by KIKUZUKI')"
      :subtitle="getField('hero.subtitle', 'Authentic Japanese Robatayaki Experience in Krabi')"
      size="home"
      :video="getFieldStr('hero.video', '/videos/hero-video.mp4')"
      :establishment-year="googleBusiness.value?.business?.establishmentYear"
    >
      <template #cta>
        <div class="flex flex-col sm:flex-row gap-4 justify-center">
          <AppButton to="/menu" variant="white" size="lg">View Menu</AppButton>
          <AppButton to="/reservations" variant="black" size="lg">Reserve a Table</AppButton>
        </div>
      </template>
    </AppHero>

    <ClientOnly>
      <RestaurantPosts :posts="googlePosts" :limit="3" show-view-more description="News, events and special offers from KIKUZUKI" />
    </ClientOnly>
    <ClientOnly>
      <RestaurantReviews :reviews="googleReviews" :rating-summary="googleReviewSummary" :limit="3" show-view-more />
    </ClientOnly>

    <!-- About teaser -->
    <ClientOnly>
      <RestaurantAbout
        :title="getField('about-teaser-title', businessTitle)"
        :image="businessPrimaryPhoto?.googleUrl"
        is-teaser
        bg="black"
        padding="xl"
      >
        <p class="text-white/80 text-lg font-light leading-relaxed">
          {{ getField('cta.description', businessSubtitle) }}
        </p>
      </RestaurantAbout>
    </ClientOnly>

    <!-- Gallery -->
    <AppSection bg="white" padding="default">
      <div class="flex items-center justify-between mb-8">
        <h2 class="text-3xl font-bold text-gray-900 italic">Gallery</h2>
        <NuxtLink to="/photos" class="text-black font-semibold hover:underline">View All Photos →</NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <!-- Loaded photos -->
        <template v-if="googleMedia.length">
          <div v-for="media in googleMedia.slice(0, 4)" :key="media.name" class="aspect-square overflow-hidden rounded-2xl shadow-sm">
            <img :src="media.googleUrl" :alt="media.description || 'KIKUZUKI'" class="w-full h-full object-cover hover:scale-110 transition-transform duration-500">
          </div>
        </template>
        <!-- Empty state placeholders -->
        <template v-else>
          <div v-for="i in 4" :key="i" class="aspect-square bg-stone-100 rounded-2xl flex items-center justify-center">
            <span class="text-stone-300 text-xs font-medium text-center px-2">Photo from<br>Google Business</span>
          </div>
        </template>
      </div>
    </AppSection>

    <!-- Location & Hours -->
    <AppSection id="section-google" bg="gray" padding="default">
      <div class="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <h2 class="text-3xl font-bold text-gray-900 mb-4 italic">
            Find Us{{ businessCity ? ` in ${businessCity}` : ' in Krabi' }}
          </h2>
          <div class="space-y-4 text-gray-600 mb-8">
            <!-- Address placeholder if not yet synced -->
            <div v-if="businessAddress">
              <p>{{ businessAddress }}</p>
            </div>
            <div v-else class="h-5 bg-stone-200 rounded animate-pulse w-64" />

            <div v-if="specialHoursNotice" class="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
              <span class="text-2xl">🗓️</span>
              <div>
                <h3 class="font-bold text-amber-900 text-sm uppercase tracking-wider mb-1">Holiday Update</h3>
                <p class="text-amber-800 text-sm font-medium">{{ specialHoursNotice }}</p>
              </div>
            </div>

            <p v-if="businessHours">{{ businessHours }}</p>
            <div v-else class="h-5 bg-stone-200 rounded animate-pulse w-48" />

            <p v-if="businessPhone">{{ businessPhone }}</p>
            <div v-else class="h-5 bg-stone-200 rounded animate-pulse w-36" />
          </div>
          <div class="flex gap-4">
            <AppButton to="/location" variant="primary" size="md">Full Location Details</AppButton>
            <AppButton to="/reservations" variant="secondary" size="md">Reserve a Table →</AppButton>
          </div>
        </div>
        <div class="rounded-3xl h-80 overflow-hidden shadow-2xl bg-stone-100">
          <iframe
            v-if="businessCoordinates"
            :src="`https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3950.432413181305!2d${businessCoordinates.lng}!3d${businessCoordinates.lat}!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x305195cf958f130b%3A0xd8ce9d779ecb9325!2sTake%20Me%20Away%20by%20KIKUZUKI!5e0!3m2!1sen!2sth!4v1777770384431!5m2!1sen!2sth`"
            width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <p class="text-stone-400 text-sm text-center px-4">Map will appear once<br>Google Business is linked</p>
          </div>
        </div>
      </div>
    </AppSection>

    <!-- CTA -->
    <AppSection id="section-cta" bg="black" padding="xl">
      <div class="text-center">
        <h2 class="text-3xl md:text-5xl font-bold text-white mb-6 italic">
          {{ getField('cta.title', 'Ready to Experience KIKUZUKI?') }}
        </h2>
        <p class="text-white/60 mb-10 max-w-2xl mx-auto font-light">
          {{ getField('cta.description', "Whether you're joining us for a casual dinner or a special celebration, we look forward to serving you the finest Japanese cuisine in Krabi.") }}
        </p>
        <div class="flex flex-col md:flex-row items-center justify-center gap-6">
          <NuxtLink to="/reservations" class="bg-white text-black px-10 py-4 rounded-full font-bold text-lg hover:bg-stone-200 transition-all transform hover:scale-105">Book Now</NuxtLink>
          <NuxtLink to="/contact" class="text-white border-2 border-white/20 px-10 py-4 rounded-full font-bold text-lg hover:bg-white/10 transition-all">Contact Us</NuxtLink>
        </div>
      </div>
    </AppSection>
  </div>
</template>

<script setup>
import { getTodayGoogleHours, getSpecialHoursNotice } from '~/utils/formatters'
import { usePageContent } from '~/composables/usePageContent'

definePageMeta({ layout: 'home' })

const { getField, getFieldStr } = usePageContent('home')

const { data: googleBusiness } = await useFetch('/api/google-business/public', {
  key: 'google-business-public',
  default: () => ({ business: null, reviews: [], media: [], posts: [] })
})

const starRatingMap = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }

const businessTitle = computed(() => googleBusiness.value?.business?.title || 'Take Me Away by KIKUZUKI')
const businessSubtitle = computed(() => googleBusiness.value?.business?.profile?.description || 'Authentic Japanese Robatayaki Experience in Krabi')
const businessPrimaryPhoto = computed(() => googleBusiness.value?.media?.[0])
const businessAddress = computed(() => {
  const addr = googleBusiness.value?.business?.storefrontAddress
  if (!addr) return ''
  return `${addr.addressLines?.[0] || ''}, ${addr.locality || ''}, ${addr.administrativeArea || ''} ${addr.postalCode || ''}`.replace(/^,\s*/, '')
})
const businessCity = computed(() => googleBusiness.value?.business?.storefrontAddress?.locality || '')
const businessPhone = computed(() => googleBusiness.value?.business?.phoneNumbers?.[0]?.phoneNumber || '')
const businessHours = computed(() => getTodayGoogleHours(googleBusiness.value?.business?.regularHours))
const specialHoursNotice = computed(() => getSpecialHoursNotice(googleBusiness.value?.business?.specialHours))
const googlePosts = computed(() => googleBusiness.value?.posts || [])
const googleMedia = computed(() => googleBusiness.value?.media || [])
const businessCoordinates = computed(() => {
  const coords = googleBusiness.value?.business?.latlng
  return coords ? { lat: coords.latitude, lng: coords.longitude } : null
})
const googleReviews = computed(() => googleBusiness.value?.reviews ?? [])
const googleReviewRating = (review) => starRatingMap[review.starRating] ?? Number(review.starRating ?? 0)
const googleReviewSummary = computed(() => {
  const summary = googleBusiness.value?.business?.reviewSummary
  if (!summary) {
    const ratings = googleReviews.value.map(googleReviewRating).filter(Boolean)
    if (ratings.length === 0) return null
    return { average: (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1), count: ratings.length }
  }
  return { average: Number(summary.averageRating).toFixed(1), count: summary.totalReviewCount }
})

useSeoMeta({
  title: 'Take Me Away by KIKUZUKI | Japanese Robatayaki Izakaya in Krabi',
  description: 'Experience authentic Japanese robatayaki at Take Me Away by KIKUZUKI in Krabi, Thailand.',
  ogTitle: 'Take Me Away by KIKUZUKI | Japanese Robatayaki Izakaya in Krabi',
  ogDescription: 'Authentic Japanese robatayaki izakaya in Krabi, Thailand.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com',
  ogType: 'website'
})
</script>
