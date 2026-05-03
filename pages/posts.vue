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
  title: 'Posts | Take Me Away by KIKUZUKI | Business Updates',
  description: 'Read the latest news, updates, and announcements from Take Me Away by KIKUZUKI in Krabi, Thailand. Stay informed about events, special offers, and restaurant news.',
  ogTitle: 'Posts | Take Me Away by KIKUZUKI',
  ogDescription: 'Business updates and news from our Japanese robatayaki restaurant in Krabi, Thailand.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/posts',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Posts - Take Me Away by KIKUZUKI',
  twitterDescription: 'Latest updates from our Japanese restaurant in Krabi, Thailand.',
  twitterImage: '/og-image.jpg'
})

useSchemaOrg([{
  '@type': 'Restaurant',
  name: 'Take Me Away by KIKUZUKI',
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: googlePosts.value.map(post => ({
      '@type': 'Article',
      headline: post.title,
      datePublished: post.createTime,
      author: {
        '@type': 'Organization',
        name: 'Take Me Away by KIKUZUKI'
      },
      image: post.media?.[0]?.googleUrl || '/og-image.jpg'
    }))
  }
}])
</script>
