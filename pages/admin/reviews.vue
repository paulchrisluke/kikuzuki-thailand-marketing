<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Review Moderation</h1>
      <p class="text-stone-400 mt-2">Approve guest reviews before they appear on menu detail pages and in review schema.</p>
    </div>

      <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <h2 class="font-bold text-gray-900 mb-4">Filter by Status</h2>
      <div class="grid gap-3 sm:grid-cols-3">
        <button
          v-for="option in statusOptions"
          :key="option.value"
          type="button"
          :class="[
            'rounded-xl border px-4 py-3 text-left transition-colors',
            selectedStatus === option.value
              ? 'border-black bg-black text-white'
              : 'border-stone-200 bg-white text-gray-700 hover:border-stone-400'
          ]"
          @click="selectedStatus = option.value"
        >
          <span class="block text-sm font-medium">{{ option.label }}</span>
          <span :class="['mt-1 block text-xs', selectedStatus === option.value ? 'text-stone-300' : 'text-stone-500']">
            {{ option.description }}
          </span>
        </button>
      </div>
    </div>

      <div class="bg-white rounded-3xl border border-stone-200 p-8">
      <div>
        <h2 class="font-bold text-gray-900">{{ currentStatusLabel }}</h2>
        <p class="text-sm text-stone-400 mt-1">
          {{ reviews.length }} {{ reviews.length === 1 ? 'review' : 'reviews' }}
        </p>
      </div>

      
      <div v-if="!session.authenticated" class="mt-8 rounded-2xl border border-dashed border-stone-300 p-8 text-center">
        <p class="text-sm font-medium text-gray-900">Sign in to load reviews.</p>
        <p class="mt-2 text-sm text-stone-500">The moderation API stays locked until Google verifies the admin account.</p>
      </div>

      
      <div v-else-if="reviews.length === 0" class="mt-8 rounded-2xl border border-stone-200 p-8 text-center">
        <p class="text-sm font-medium text-gray-900">No {{ selectedStatus }} reviews.</p>
        <p class="mt-2 text-sm text-stone-500">New guest submissions appear here as pending.</p>
      </div>

        <div v-else class="mt-8 divide-y divide-stone-200 border-y border-stone-200">
          <article v-for="review in reviews" :key="review.id" class="py-6 lg:grid lg:grid-cols-12 lg:gap-x-8">
            <div class="lg:col-span-3">
              <p class="text-sm font-medium text-gray-900">{{ review.author }}</p>
              <p class="mt-1 text-sm text-stone-500">{{ menuItemName(review.menuItemSlug) }}</p>
              <time v-if="review.createdAt" :datetime="review.createdAt" class="mt-1 block text-sm text-stone-500">
                {{ formatDate(review.createdAt) }}
              </time>
            </div>

            <div class="mt-4 lg:col-span-6 lg:mt-0">
              <div class="flex flex-wrap items-center gap-2">
                <p class="text-sm font-medium text-gray-900">{{ review.title }}</p>
                <span class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {{ review.rating }} / 5
                </span>
              </div>
              <p class="mt-3 text-sm leading-6 text-gray-600">{{ review.content }}</p>
            </div>

            <div class="mt-5 flex flex-wrap gap-2 lg:col-span-3 lg:mt-0 lg:justify-end">
              <button
                v-if="review.status !== 'approved'"
                type="button"
                :disabled="updatingId === review.id"
                class="text-sm font-semibold text-white px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                @click="updateReview(review.id, 'approved')"
              >
                Approve
              </button>
              <button
                v-if="review.status !== 'rejected'"
                type="button"
                :disabled="updatingId === review.id"
                class="text-sm font-semibold text-white px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                @click="updateReview(review.id, 'rejected')"
              >
                Reject
              </button>
              <button
                v-if="review.status !== 'pending'"
                type="button"
                :disabled="updatingId === review.id"
                class="text-sm font-medium text-stone-600 px-3 py-2 rounded-lg border border-stone-300 hover:border-stone-400 hover:text-stone-700 disabled:opacity-50 transition-colors"
                @click="updateReview(review.id, 'pending')"
              >
                Pending
              </button>
            </div>
          </article>
        </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })
import { menuData } from '~/data/menu'

const session = reactive({
  authenticated: false,
  email: ''
})
const selectedStatus = ref('pending')
const reviews = ref([])
const updatingId = ref('')

const statusOptions = [
  { value: 'pending', label: 'Pending', description: 'Needs a decision' },
  { value: 'approved', label: 'Approved', description: 'Visible publicly' },
  { value: 'rejected', label: 'Rejected', description: 'Hidden from menu' }
]

const currentStatusLabel = computed(() =>
  statusOptions.find(option => option.value === selectedStatus.value)?.label ?? 'Reviews'
)

const menuItemsBySlug = computed(() => {
  const entries = menuData.categories.flatMap(category =>
    category.items.map(item => [item.slug, `${item.name} (${category.name})`])
  )
  return Object.fromEntries(entries)
})

const menuItemName = slug => menuItemsBySlug.value[slug] ?? slug

const formatDate = value =>
  new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

const loadSession = async () => {
  try {
    const response = await $fetch('/api/auth/session')
    session.authenticated = Boolean(response.authenticated)
    session.email = response.email ?? ''
  } catch {
    session.authenticated = false
    session.email = ''
  }
}

const loadReviews = async () => {
  if (!session.authenticated) return

  try {
    const response = await $fetch('/api/admin/reviews', {
      query: { status: selectedStatus.value }
    })
    reviews.value = response.reviews ?? []
  } catch (fetchError) {
    reviews.value = []
  }
}

const updateReview = async (id, status) => {
  if (!session.authenticated || updatingId.value) return

  updatingId.value = id

  try {
    await $fetch('/api/admin/reviews', {
      method: 'PATCH',
      body: { id, status }
    })
    reviews.value = reviews.value.filter(review => review.id !== id)
  } catch (fetchError) {
    // Error handling could be added here if needed
  } finally {
    updatingId.value = ''
  }
}


onMounted(async () => {
  await loadSession()
  if (session.authenticated) {
    loadReviews()
  }
})

watch(selectedStatus, () => {
  if (session.authenticated) {
    loadReviews()
  }
})

useSeoMeta({
  title: 'Review Moderation | KIKUZUKI Admin',
  description: 'Moderate guest reviews for KIKUZUKI menu items.',
  robots: 'noindex, nofollow'
})
</script>
