<template>
  <div class="min-h-screen bg-stone-50">
    <!-- Tenant Header -->
    <div class="bg-white border-b border-stone-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <NuxtLink
              to="/locations"
              class="text-stone-600 hover:text-stone-900 mr-4"
            >
              ← All Locations
            </NuxtLink>
            <h1 class="text-xl font-semibold text-stone-900">
              {{ location?.title || 'Location' }}
            </h1>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
        <p class="mt-2 text-stone-600">Loading location...</p>
      </div>

      <!-- Location Content -->
      <div v-else-if="location" class="space-y-8">
        <!-- Location Header -->
        <UCard>
          <div class="flex items-start justify-between">
            <div>
              <h2 class="text-2xl font-bold text-stone-900 mb-2">
                {{ location.title }}
              </h2>
              <div v-if="location.is_primary" class="mb-4">
                <UBadge color="info" variant="soft">Primary Location</UBadge>
              </div>
            </div>
            
            <!-- Rating -->
            <div v-if="location.rating" class="text-right">
              <div class="flex items-center">
                <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <span class="ml-2 text-lg font-medium text-stone-900">{{ location.rating }}</span>
              </div>
              <p v-if="location.review_count" class="text-sm text-stone-500">
                {{ location.review_count }} reviews
              </p>
            </div>
          </div>

          <!-- Contact Information -->
          <div class="mt-6 space-y-4">
            <!-- Address -->
            <div v-if="location.address" class="flex items-start">
              <svg class="w-5 h-5 text-stone-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
              </svg>
              <div>
                <h3 class="text-sm font-medium text-stone-900">Address</h3>
                <p class="text-sm text-stone-600">{{ formatAddress(location.address) }}</p>
                <a
                  v-if="location.maps_url"
                  :href="location.maps_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-blue-600 hover:text-blue-800"
                >
                  Get Directions
                </a>
              </div>
            </div>

            <!-- Phone -->
            <div v-if="location.phone" class="flex items-center">
              <svg class="w-5 h-5 text-stone-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
              <div>
                <h3 class="text-sm font-medium text-stone-900">Phone</h3>
                <a
                  :href="`tel:${location.phone}`"
                  class="text-sm text-blue-600 hover:text-blue-800"
                >
                  {{ location.phone }}
                </a>
              </div>
            </div>

            <!-- Website -->
            <div v-if="location.website_url" class="flex items-center">
              <svg class="w-5 h-5 text-stone-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9 9m9-9H3m9 9a9 9 0 01-9 9m9-9c-2.5 0-4.8-1.1-6.3-2.9"></path>
              </svg>
              <div>
                <h3 class="text-sm font-medium text-stone-900">Website</h3>
                <a
                  :href="location.website_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-blue-600 hover:text-blue-800"
                >
                  Visit Website
                </a>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Opening Hours -->
        <UCard v-if="location.opening_hours">
          <h3 class="text-lg font-semibold text-stone-900 mb-4">Opening Hours</h3>
          <div class="space-y-2">
            <div
              v-for="(day, index) in formatHours(location.opening_hours)"
              :key="index"
              class="flex justify-between py-2 border-b border-stone-100 last:border-0"
            >
              <span class="text-sm font-medium text-stone-900">{{ day.day }}</span>
              <span class="text-sm text-stone-600">{{ day.hours }}</span>
            </div>
          </div>
        </UCard>

        <!-- Actions -->
        <UCard>
          <div class="flex space-x-4">
            <UButton
              :to="`/locations/${location.slug}/menu`"
              color="primary"
              class="flex-1"
            >
              View Menu
            </UButton>
            <UButton
              v-if="location.maps_url"
              :to="location.maps_url"
              variant="ghost"
              class="flex-1"
            >
              Get Directions
            </UButton>
          </div>
        </UCard>

        <!-- Sync Info -->
        <div v-if="location.google_location_id" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-blue-400 mr-3 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
            </svg>
            <div>
              <h4 class="text-sm font-medium text-blue-900">Google Business Connected</h4>
              <p class="text-sm text-blue-700 mt-1">
                This location is synced with Google Business Profile. Last updated: {{ formatDate(location.last_synced_at) }}
              </p>
            </div>
          </div>
        </div>

      <!-- Location Not Found -->
      <div v-if="!loading && !location" class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h3 class="mt-2 text-lg font-medium text-stone-900">Location not found</h3>
        <p class="mt-1 text-stone-500">The requested location could not be found.</p>
        <NuxtLink
          to="/locations"
          class="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-stone-700 bg-stone-100 hover:bg-stone-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-500"
        >
          View All Locations
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'tenant' })
// Get site context and location slug from route
const { site } = useTenant()
const route = useRoute()
const slug = route.params.slug

const loading = ref(true)
const location = ref(null)

// Load specific location
async function loadLocation() {
  if (!site.value) {
    loading.value = false
    return
  }

  try {
    const response = await $fetch(`/api/sites/${site.value.id}/locations`)
    const locations = response.locations || []
    location.value = locations.find(loc => loc.slug === slug) || null
  } catch (error) {
    console.error('Failed to load location:', error)
    location.value = null
  } finally {
    loading.value = false
  }
}

// Format address for display
function formatAddress(address) {
  if (!address) return ''
  
  const parts = [
    address.streetAddress,
    address.locality,
    address.region,
    address.postalCode
  ].filter(Boolean)
  
  return parts.join(', ')
}

// Format opening hours
function formatHours(hours) {
  if (!hours) return []
  
  // Handle different hour formats
  if (typeof hours === 'string') {
    try {
      hours = JSON.parse(hours)
    } catch {
      return []
    }
  }
  
  if (!hours.periods) return []
  
  return hours.periods.map(period => ({
    day: period.openDay || 'Unknown',
    hours: `${period.openTime || 'N/A'} - ${period.closeTime || 'N/A'}`
  }))
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Unknown'
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

// Load on mount
onMounted(() => {
  loadLocation()
})
</script>
