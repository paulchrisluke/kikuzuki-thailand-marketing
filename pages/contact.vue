<template>
  <div>
    <AppHero
      :title="getField('hero.title', 'Contact Us')"
      :subtitle="getField('hero.subtitle', 'Get in Touch with KIKUZUKI')"
      size="page"
      :establishment-year="googleBusiness.value?.business?.establishmentYear"
    />
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="bg-gray-50 rounded-lg p-8 mb-12">
        <div v-html="introBody" class="prose prose-lg max-w-none text-gray-700" />
      </div>

      <div class="grid md:grid-cols-2 gap-12">
        <!-- Contact Details -->
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Contact Information</h2>
          <div class="space-y-6">
            <div v-if="businessName">
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Restaurant</h3>
              <p class="text-gray-700">{{ businessName }}</p>
            </div>
            <div v-if="businessAddress">
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Address</h3>
              <p class="text-gray-700">{{ businessAddress }}</p>
            </div>
            <div v-if="businessPhone">
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Phone</h3>
              <p class="text-gray-700">{{ businessPhone }}</p>
            </div>
            <div v-if="businessHours">
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Opening Hours</h3>
              <p class="text-gray-700">{{ businessHours }}</p>
            </div>
          </div>
          <div class="mt-8">
            <h3 class="font-semibold text-gray-900 mb-4">Follow Us</h3>
            <div class="flex space-x-4">
              <a :href="getField('social.facebook', 'https://www.facebook.com/kikuzuki-thailand')" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-900">Facebook</a>
              <a :href="getField('social.instagram', 'https://www.instagram.com/kikuzuki-thailand')" target="_blank" rel="noopener noreferrer" class="text-gray-600 hover:text-gray-900">Instagram</a>
            </div>
          </div>
        </div>

        <!-- Contact Form -->
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Send Us a Message</h2>
          <div class="bg-gray-50 rounded-lg p-6">
            <form class="space-y-4" @submit.prevent>
              <div>
                <label for="name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" id="name" name="name" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
              </div>
              <div>
                <label for="email" class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" id="email" name="email" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
              </div>
              <div>
                <label for="message" class="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea id="message" name="message" rows="4" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black" />
              </div>
              <button type="submit" class="w-full bg-black text-white py-3 px-4 rounded-md font-semibold hover:bg-gray-800 transition-colors">
                Send Message
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="mt-12 grid md:grid-cols-2 gap-6">
        <NuxtLink to="/reservations" class="block bg-gray-100 rounded-lg p-6 hover:bg-gray-200 transition-colors">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Make a Reservation</h3>
          <p class="text-gray-700">Book your table online or call us directly</p>
        </NuxtLink>
        <NuxtLink to="/location" class="block bg-gray-100 rounded-lg p-6 hover:bg-gray-200 transition-colors">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Find Us</h3>
          <p class="text-gray-700">Get directions and view our location on Google Maps</p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getTodayGoogleHours } from '~/utils/formatters'
import { usePageContent } from '~/composables/usePageContent'

const { getField } = usePageContent('contact')

const { data: googleBusiness } = await useFetch('/api/google-business/public', {
  key: 'google-business-public',
  default: () => ({ business: null })
})

const businessName = computed(() => googleBusiness.value?.business?.title || '')
const businessAddress = computed(() => {
  const a = googleBusiness.value?.business?.storefrontAddress
  return a ? `${a.addressLines?.[0] || ''}, ${a.locality || ''}, ${a.administrativeArea || ''} ${a.postalCode || ''}` : ''
})
const businessPhone = computed(() => googleBusiness.value?.business?.phoneNumbers?.[0]?.phoneNumber || '')
const businessHours = computed(() => getTodayGoogleHours(googleBusiness.value?.business?.regularHours))

// Default moved to computed to avoid inline quote escaping issues
const introBody = computed(() => getField('intro.body',
  '<p class="mb-4 leading-relaxed">For an unparalleled Japanese culinary experience in Krabi, Kikuzuki beckons you to transcend the virtual and savor the exquisite reality. Our website offers a glimpse of the gastronomic symphony that awaits—robust robatayaki grills and artful sushi creations.</p>' +
  '<p class="mb-4 leading-relaxed">Contact us to transform your online curiosity into a reservation, immersing yourself in the warm ambiance, skilled craftsmanship, and tantalizing flavors that define Kikuzuki.</p>' +
  '<p class="font-semibold leading-relaxed">Elevate your senses; contact Kikuzuki for an unforgettable Japanese dining adventure.</p>'
))

useSeoMeta({
  title: 'Contact | Take Me Away by KIKUZUKI | Krabi Thailand',
  description: 'Contact Take Me Away by KIKUZUKI in Krabi, Thailand. Get our phone number, address, and send us a message.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/contact'
})
</script>
