<template>
  <div>
    <!-- Hero Section -->
    <AppHero
      title="Photo Gallery"
      subtitle="Visual Journey Through Our Restaurant"
      size="page"
    />

    <!-- Photo Gallery -->
    <UContainer class="py-12">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Real photos -->
        <UCard 
          v-for="media in googleMedia" 
          :key="media.name" 
          class="group overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
        >
          <div class="relative">
            <img 
              :src="media.googleUrl" 
              :alt="media.description || 'Restaurant photo'"
              class="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            >
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity duration-300 flex items-end p-4">
              <div class="text-white">
                <p v-if="media.description" class="text-sm font-medium">{{ media.description }}</p>
                <p class="text-xs opacity-75">{{ formatDate(media.createTime) }}</p>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Placeholder cards when no photos -->
        <template v-if="googleMedia.length === 0">
          <UCard v-for="i in 9" :key="`placeholder-${i}`" class="aspect-square flex items-center justify-center">
            <span class="text-stone-300 text-xs font-medium text-center px-4">Photo from<br>Google Business</span>
          </UCard>
        </template>
      </div>
    </UContainer>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'tenant' })
import AppHero from '~/components/ui/AppHero.vue'
const { data: googleBusiness } = await useFetch('/api/google-business/public', {
  key: 'google-business-public',
  default: () => ({
    business: null,
    reviews: [],
    media: [],
    posts: [],
    errors: [],
    syncedAt: null
  })
})

const googleMedia = computed(() => googleBusiness.value?.media || [])

const formatDate = (dateString) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

// SEO Meta
useSeoMeta({
  title: 'Photos | Restaurant Website | Restaurant Gallery',
  description: 'Browse photos of our restaurant. See our restaurant interior, food, dishes, and atmosphere through our photo gallery.',
  ogTitle: 'Photos | Restaurant Website',
  ogDescription: 'Photo gallery of our authentic restaurant.',
  ogImage: '/og-image.jpg',
  ogUrl: '/photos',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Photos - Restaurant Website',
  twitterDescription: 'Browse photos of our Japanese restaurant.',
  twitterImage: '/og-image.jpg'
})

useSchemaOrg([
  computed(() => ({
    '@type': 'Restaurant',
    name: 'Your Restaurant',
    photo: googleMedia.value.map(media => ({
      '@type': 'Photograph',
      url: media.googleUrl,
      description: media.description || 'Restaurant photo'
    }))
  }))
])
</script>
