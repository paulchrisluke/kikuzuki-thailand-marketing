<template>
  <div class="min-h-screen bg-white">
    <AppHero :title="getField('hero.title', 'Location & Hours')" :subtitle="getField('hero.subtitle', 'Visit Us in Krabi, Thailand')" size="page" :establishment-year="googleBusiness.value?.business?.establishmentYear" />
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="mb-12">
        <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Find Us</h2>
        <div class="aspect-video bg-gray-200 rounded-lg overflow-hidden">
          <iframe src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3950.432413181305!2d98.7493211!3d8.0572977!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x305195cf958f130b%3A0xd8ce9d779ecb9325!2sTake%20Me%20Away%20by%20KIKUZUKI!5e0!3m2!1sen!2sth!4v1777770384431!5m2!1sen!2sth" width="100%" height="100%" style="border:0;" allowfullscreen="" loading="lazy" referrerpolicy="no-referrer-when-downgrade" />
        </div>
        <div class="mt-4 text-center">
          <a href="https://maps.app.goo.gl/2KJfCAfH1idnRBqz6" target="_blank" rel="noopener noreferrer" class="inline-block bg-black text-white px-6 py-3 rounded-full font-semibold hover:bg-gray-800 transition-colors">Get Directions →</a>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-12 mb-12">
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Contact Information</h2>
          <div class="space-y-6">
            <div>
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Restaurant</h3>
              <p class="text-gray-700 text-lg">{{ businessName || 'Take Me Away by KIKUZUKI' }}</p>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Address</h3>
              <p class="text-gray-700 text-lg">
                {{ businessAddress || 'Krabi, Thailand' }}
                <span v-if="!businessAddress" class="text-sm text-gray-400 block">Address will appear once Google Business is linked</span>
              </p>
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 mb-1 uppercase tracking-wider text-xs">Phone</h3>
              <p class="text-gray-700 text-lg">
                {{ businessPhone || '+66 XX XXX XXXX' }}
                <span v-if="!businessPhone" class="text-sm text-gray-400 block">Phone number will appear once Google Business is linked</span>
              </p>
            </div>
          </div>
          <div v-if="parkingInfo" class="mt-8">
            <h3 class="font-semibold text-gray-900 mb-2 uppercase tracking-wider text-xs">Parking</h3>
            <div v-html="parkingInfo" class="text-gray-600 text-sm" />
          </div>
          <div v-if="extraNotes" class="mt-4">
            <h3 class="font-semibold text-gray-900 mb-2 uppercase tracking-wider text-xs">Additional Notes</h3>
            <div v-html="extraNotes" class="text-gray-600 text-sm" />
          </div>
        </div>
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Opening Hours</h2>
          <div class="bg-stone-50 rounded-2xl p-8 border border-stone-200">
            <table class="w-full">
              <tbody>
                <tr v-for="hour in (businessHoursFormatted.length > 0 ? businessHoursFormatted : defaultHours)" :key="hour.day" class="border-b border-stone-100 last:border-0">
                  <td class="py-3 text-gray-600 font-medium">{{ hour.day }}</td>
                  <td class="py-3 text-right text-gray-900">
                    {{ hour.hours }}
                    <span v-if="businessHoursFormatted.length === 0" class="text-sm text-gray-400 block">Hours will appear once Google Business is linked</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { formatGoogleHours } from '~/utils/formatters'
import { usePageContent } from '~/composables/usePageContent'
const { getField } = usePageContent('location')
const { data: googleBusiness } = await useFetch('/api/google-business/public', { key: 'google-business-public', default: () => ({ business: null }) })
const businessName = computed(() => googleBusiness.value?.business?.title || '')
const businessAddress = computed(() => { const a = googleBusiness.value?.business?.storefrontAddress; return a ? `${a.addressLines?.[0] || ''}, ${a.locality || ''}, ${a.administrativeArea || ''} ${a.postalCode || ''}` : '' })
const businessPhone = computed(() => googleBusiness.value?.business?.phoneNumbers?.[0]?.phoneNumber || '')
const businessHoursFormatted = computed(() => formatGoogleHours(googleBusiness.value?.business?.regularHours))

// Default hours for when Google Business data is not available
const defaultHours = [
  { day: 'Monday', hours: '5:00 PM - 10:00 PM' },
  { day: 'Tuesday', hours: '5:00 PM - 10:00 PM' },
  { day: 'Wednesday', hours: '5:00 PM - 10:00 PM' },
  { day: 'Thursday', hours: '5:00 PM - 10:00 PM' },
  { day: 'Friday', hours: '5:00 PM - 11:00 PM' },
  { day: 'Saturday', hours: '5:00 PM - 11:00 PM' },
  { day: 'Sunday', hours: '5:00 PM - 10:00 PM' }
]

const parkingInfo = computed(() => getField('parking.info', ''))
const extraNotes = computed(() => getField('extra.notes', ''))
useSeoMeta({ title: 'Location & Hours | Take Me Away by KIKUZUKI | Krabi, Thailand', description: 'Find Take Me Away by KIKUZUKI in Krabi, Thailand. Get directions and check our opening hours.', ogImage: '/og-image.jpg', ogUrl: 'https://www.kikuzuki-thailand.com/location' })
</script>
