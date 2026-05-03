<template>
  <div class="min-h-screen bg-white">
    <AppHero
      title="Questions & Answers"
      subtitle="Customer Inquiries About KIKUZUKI"
      size="page"
    />

    <RestaurantQA
      :qa="googleQA"
      bg="white"
      padding="default"
      :show-title="false"
    />
  </div>
</template>

<script setup>
import AppHero from '~/components/ui/AppHero.vue'
import RestaurantQA from '~/components/google/RestaurantQA.vue'
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

const googleQA = computed(() => googleBusiness.value?.qa || [])

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
  title: 'Q&A | Take Me Away by KIKUZUKI | Customer Questions',
  description: 'Find answers to frequently asked questions about Take Me Away by KIKUZUKI in Krabi, Thailand. Browse customer inquiries and our responses about Japanese robatayaki dining.',
  ogTitle: 'Q&A | Take Me Away by KIKUZUKI',
  ogDescription: 'Customer questions and answers about our Japanese robatayaki restaurant in Krabi, Thailand.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/qa',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Q&A - Take Me Away by KIKUZUKI',
  twitterDescription: 'Customer questions and answers about our Japanese restaurant in Krabi, Thailand.',
  twitterImage: '/og-image.jpg'
})

useSchemaOrg([
  computed(() => ({
    '@type': 'Restaurant',
    name: 'Take Me Away by KIKUZUKI',
    mainEntity: {
      '@type': 'FAQPage',
      mainEntity: {
        '@type': 'Question',
        name: 'Customer Questions About KIKUZUKI',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Find answers to common questions about our Japanese robatayaki restaurant, menu, and services.'
        }
      }
    }
  }))
])
</script>
