<template>
  <div class="min-h-screen bg-white">
    <AppHero
      :title="getField('hero.title', 'Reserve a Table at KIKUZUKI')"
      :subtitle="getField('hero.subtitle', 'Book Your Authentic Japanese Robatayaki Experience')"
      size="page"
    />
    <div class="max-w-6xl mx-auto px-4 py-12">
      <div class="grid md:grid-cols-2 gap-12">
        <!-- Reservation Form -->
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Make a Reservation</h2>
          <div class="bg-gray-50 rounded-lg p-6">
            <form class="space-y-4" @submit.prevent>
              <div>
                <label for="res-name" class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input type="text" id="res-name" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
              </div>
              <div>
                <label for="res-email" class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" id="res-email" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
              </div>
              <div>
                <label for="res-phone" class="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input type="tel" id="res-phone" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
              </div>
              <div class="grid md:grid-cols-2 gap-4">
                <div>
                  <label for="res-date" class="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" id="res-date" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
                </div>
                <div>
                  <label for="res-time" class="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                  <select id="res-time" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
                    <option value="">Select time</option>
                    <option v-for="h in timeSlots" :key="h" :value="h">{{ h }}</option>
                  </select>
                </div>
              </div>
              <div>
                <label for="res-guests" class="block text-sm font-medium text-gray-700 mb-1">Guests *</label>
                <select id="res-guests" required class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black">
                  <option value="">Select guests</option>
                  <option v-for="n in guestOptions" :key="n.value" :value="n.value">{{ n.label }}</option>
                </select>
              </div>
              <div>
                <label for="res-requests" class="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                <textarea id="res-requests" rows="3" class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black" placeholder="Dietary restrictions, seating preferences…" />
              </div>
              <button type="submit" class="w-full bg-black text-white py-3 px-4 rounded-md font-semibold hover:bg-gray-800 transition-colors">
                Make Reservation
              </button>
            </form>
          </div>
        </div>

        <!-- Sidebar Info -->
        <div>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-6">Reservation Details</h2>

          <div class="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div class="space-y-2">
              <p class="text-gray-700"><strong>Phone:</strong> {{ contactPhone }}</p>
              <p class="text-gray-700"><strong>Email:</strong> {{ contactEmail }}</p>
            </div>
          </div>

          <div class="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">Reservation Policies</h3>
            <div v-html="policiesBody" />
          </div>

          <div class="space-y-4">
            <a
              :href="`tel:${contactPhone.replace(/\s/g, '')}`"
              class="block bg-black text-white text-center py-3 px-4 rounded-md font-semibold hover:bg-gray-800 transition-colors"
            >
              Call: {{ contactPhone }}
            </a>
            <NuxtLink to="/contact" class="block bg-gray-100 text-center py-3 px-4 rounded-md font-semibold hover:bg-gray-200 transition-colors">
              Send Message
            </NuxtLink>
            <NuxtLink to="/menu" class="block bg-gray-100 text-center py-3 px-4 rounded-md font-semibold hover:bg-gray-200 transition-colors">
              View Menu
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { usePageContent } from '~/composables/usePageContent'

const { getField } = usePageContent('reservations')

const timeSlots = ['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
const guestOptions = [
  { value: '1', label: '1 Guest' },
  { value: '2', label: '2 Guests' },
  { value: '3', label: '3 Guests' },
  { value: '4', label: '4 Guests' },
  { value: '5', label: '5 Guests' },
  { value: '6', label: '6 Guests' },
  { value: '7', label: '7 Guests' },
  { value: '8+', label: '8+ Guests' },
]

// Defaults in computed to avoid parse errors from embedded HTML in template expressions
const contactPhone = computed(() => getField('contact.phone', '+66 81 154 3606'))
const contactEmail = computed(() => getField('contact.email', 'info@kikuzuki-thailand.com'))
const policiesBody = computed(() => getField('policies.body',
  '<ul class="space-y-2 text-gray-700">' +
  '<li>• Reservations are held for 15 minutes</li>' +
  '<li>• Cancellations required 2 hours in advance</li>' +
  '<li>• Large parties (6+ guests) may require deposit</li>' +
  '<li>• Special dietary requests accommodated with advance notice</li>' +
  '</ul>'
))

useSeoMeta({
  title: 'Reserve a Table | Take Me Away by KIKUZUKI | Krabi Thailand',
  description: 'Reserve a table at KIKUZUKI, our authentic Japanese robatayaki restaurant in Krabi, Thailand.',
  ogImage: '/og-image.jpg',
  ogUrl: 'https://www.kikuzuki-thailand.com/reservations'
})
</script>
