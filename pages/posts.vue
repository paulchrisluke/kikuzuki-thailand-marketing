<template>
  <div>
    <!-- Hero Section -->
    <AppHero
      title="Business Updates"
      subtitle="Latest News & Announcements"
      size="page"
    />



    <RestaurantPosts
      :posts="googlePosts"
      bg="white"
      padding="default"
      :show-title="false"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'tenant' })
import AppHero from '~/components/ui/AppHero.vue'
import RestaurantPosts from '~/components/google/RestaurantPosts.vue'

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

const googlePosts = computed(() => googleBusiness.value?.posts || [])

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
  title: 'Posts | Restaurant Website | Business Updates',
  description: 'Read the latest news, updates, and announcements from our restaurant. Stay informed about events, special offers, and restaurant news.',
  ogTitle: 'Posts | Restaurant Website',
  ogDescription: 'Business updates and news from our authentic restaurant.',
  ogImage: '/og-image.jpg',
  ogUrl: '/posts',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Posts - Restaurant Website',
  twitterDescription: 'Latest updates from our Japanese restaurant.',
  twitterImage: '/og-image.jpg'
})

useSchemaOrg([
  computed(() => ({
    '@type': 'Restaurant',
    name: 'Your Restaurant',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: googlePosts.value.map(post => ({
        '@type': 'Article',
        headline: post.title,
        datePublished: post.createTime,
        author: {
          '@type': 'Organization',
          name: 'Your Restaurant'
        },
        image: post.media?.[0]?.googleUrl || '/og-image.jpg'
      }))
    }
  }))
])
</script>
