<template>
  <div class="min-h-screen bg-white">
    <AppHero
      title="Customer Reviews"
      subtitle="What Our Guests Say About Our Restaurant"
      size="page"
    />

    <RestaurantReviews
      :reviews="googleReviews"
      :rating-summary="googleReviewSummary"
      bg="white"
      padding="default"
      :show-title="false"
    />
  </div>
</template>

<script setup>
definePageMeta({ layout: 'tenant' })
import AppHero from '~/components/ui/AppHero.vue'
import RestaurantReviews from '~/components/google/RestaurantReviews.vue'
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

const starRatingMap = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5
}

const googleReviews = computed(() => googleBusiness.value?.reviews ?? [])
const googleReviewRating = review => starRatingMap[review.starRating] ?? Number(review.starRating ?? 0)
const googleReviewText = review => typeof review.comment === 'string'
  ? review.comment
  : review.comment?.text ?? ''

const googleReviewSummary = computed(() => {
  const summary = googleBusiness.value?.business?.reviewSummary
  if (!summary) {
    // Fallback to calculation if official summary is missing
    const ratings = googleReviews.value.map(googleReviewRating).filter(Boolean)
    if (ratings.length === 0) return null
    return {
      average: (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1),
      count: ratings.length
    }
  }

  return {
    average: Number(summary.averageRating).toFixed(1),
    count: summary.totalReviewCount
  }
})

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
  title: 'Reviews | Your Restaurant | Customer Testimonials',
  description: 'Read authentic customer reviews and testimonials for Your Restaurant in your city. See what our guests say about our authentic restaurant.',
  ogTitle: 'Reviews | Your Restaurant',
  ogDescription: 'Customer reviews and testimonials for our authentic restaurant in your city.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/reviews',
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterTitle: 'Reviews - Your Restaurant',
  twitterDescription: 'Customer reviews for our Japanese restaurant in your city.',
  twitterImage: '/og-image.jpg'
})

useSchemaOrg([
  computed(() => ({
    '@type': 'Restaurant',
    name: 'Your Restaurant',
    review: googleReviews.value.map(review => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: review.reviewer?.displayName || 'Google guest'
      },
      datePublished: review.createTime,
      reviewBody: googleReviewText(review),
      reviewRating: {
        '@type': 'Rating',
        ratingValue: googleReviewRating(review),
        bestRating: 5
      }
    }))
  }))
])
</script>
