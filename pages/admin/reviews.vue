<template>
  <div>
    <div class="flex flex-col gap-6 border-b border-gray-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-sm font-medium text-gray-500">Admin</p>
          <h1 class="mt-2 text-3xl font-semibold text-gray-900">Review Moderation</h1>
          <p class="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
            Approve guest reviews before they appear on menu detail pages and in review schema.
          </p>
        </div>
        <NuxtLink
          to="/menu"
          class="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-900 hover:text-gray-900"
        >
          View menu
        </NuxtLink>
      </div>

      <section class="mt-8 grid gap-6 lg:grid-cols-12">
        <div class="lg:col-span-4">
          <h2 class="text-sm font-medium text-gray-900">Access</h2>
          <div class="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p class="text-sm font-medium text-gray-900">
              {{ session.authenticated ? session.email : 'Not signed in' }}
            </p>
            <p class="mt-1 text-sm leading-6 text-gray-500">
              {{ session.authenticated ? 'Signed in with Google.' : 'Sign in with the approved Google admin account.' }}
            </p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                v-if="!session.authenticated"
                type="button"
                class="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                @click="signIn"
              >
                Sign in with Google
              </button>
              <button
                v-else
                type="button"
                class="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
                @click="logout"
              >
                Sign out
              </button>
            </div>
          </div>
          <p class="mt-2 text-sm leading-6 text-gray-500">
            Access is restricted to authorized admin accounts.
          </p>
        </div>

        <div class="lg:col-span-8">
          <div class="grid gap-3 sm:grid-cols-3">
            <button
              v-for="option in statusOptions"
              :key="option.value"
              type="button"
              :class="[
                'rounded-md border px-4 py-3 text-left transition-colors',
                selectedStatus === option.value
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              ]"
              @click="selectedStatus = option.value"
            >
              <span class="block text-sm font-medium">{{ option.label }}</span>
              <span :class="['mt-1 block text-xs', selectedStatus === option.value ? 'text-gray-300' : 'text-gray-500']">
                {{ option.description }}
              </span>
            </button>
          </div>
        </div>
      </section>

      <section v-if="session.authenticated" class="mt-8 rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-lg font-medium text-gray-900">Google Business Sync</h2>
            <p class="mt-1 text-sm leading-6 text-gray-500">
              Pull the latest restaurant profile, Google reviews, media, and posts into the public site cache.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :disabled="googleSyncing"
              class="rounded-md bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              @click="syncGoogleBusiness(false)"
            >
              {{ googleSyncing ? 'Syncing...' : 'Sync now' }}
            </button>
            <button
              type="button"
              :disabled="googleSyncing"
              class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400"
              @click="syncGoogleBusiness(true)"
            >
              Setup notifications
            </button>
          </div>
        </div>
        <p v-if="googleMessage" :class="['mt-4 text-sm', googleError ? 'text-red-600' : 'text-green-700']">
          {{ googleMessage }}
        </p>
      </section>

      <section class="mt-8" aria-live="polite">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 class="text-lg font-medium text-gray-900">{{ currentStatusLabel }}</h2>
            <p class="mt-1 text-sm text-gray-500">
              {{ reviews.length }} {{ reviews.length === 1 ? 'review' : 'reviews' }}
            </p>
          </div>
          <button
            type="button"
            :disabled="loading || !session.authenticated"
            class="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            @click="loadReviews"
          >
            {{ loading ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <p v-if="message" :class="['mt-4 text-sm', error ? 'text-red-600' : 'text-green-700']">
          {{ message }}
        </p>

        <div v-if="!session.authenticated" class="mt-8 rounded-lg border border-dashed border-gray-300 p-8 text-center">
          <p class="text-sm font-medium text-gray-900">Sign in to load reviews.</p>
          <p class="mt-2 text-sm text-gray-500">The moderation API stays locked until Google verifies the admin account.</p>
        </div>

        <div v-else-if="loading" class="mt-8 rounded-lg border border-gray-200 p-8 text-center">
          <p class="text-sm text-gray-500">Loading reviews...</p>
        </div>

        <div v-else-if="reviews.length === 0" class="mt-8 rounded-lg border border-gray-200 p-8 text-center">
          <p class="text-sm font-medium text-gray-900">No {{ selectedStatus }} reviews.</p>
          <p class="mt-2 text-sm text-gray-500">New guest submissions appear here as pending.</p>
        </div>

        <div v-else class="mt-8 divide-y divide-gray-200 border-y border-gray-200">
          <article v-for="review in reviews" :key="review.id" class="py-6 lg:grid lg:grid-cols-12 lg:gap-x-8">
            <div class="lg:col-span-3">
              <p class="text-sm font-medium text-gray-900">{{ review.author }}</p>
              <p class="mt-1 text-sm text-gray-500">{{ menuItemName(review.menuItemSlug) }}</p>
              <time v-if="review.createdAt" :datetime="review.createdAt" class="mt-1 block text-sm text-gray-500">
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
                class="rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                @click="updateReview(review.id, 'approved')"
              >
                Approve
              </button>
              <button
                v-if="review.status !== 'rejected'"
                type="button"
                :disabled="updatingId === review.id"
                class="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-gray-400"
                @click="updateReview(review.id, 'rejected')"
              >
                Reject
              </button>
              <button
                v-if="review.status !== 'pending'"
                type="button"
                :disabled="updatingId === review.id"
                class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900 disabled:cursor-not-allowed disabled:text-gray-400"
                @click="updateReview(review.id, 'pending')"
              >
                Pending
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </template>

<script setup>
definePageMeta({ layout: 'admin' })
import { menuData } from '~/data/menu'

const tokenStorageKey = 'kikuzuki-reviews-admin-token'
const session = reactive({
  authenticated: false,
  email: ''
})
const selectedStatus = ref('pending')
const reviews = ref([])
const loading = ref(false)
const updatingId = ref('')
const message = ref('')
const error = ref(false)
const googleSyncing = ref(false)
const googleMessage = ref('')
const googleError = ref(false)

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

const setMessage = (text, isError = false) => {
  message.value = text
  error.value = isError
}

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
  if (!session.authenticated || loading.value) return

  loading.value = true
  setMessage('')

  try {
    const response = await $fetch('/api/admin/reviews', {
      query: { status: selectedStatus.value }
    })
    reviews.value = response.reviews ?? []
  } catch (fetchError) {
    reviews.value = []
    setMessage(fetchError?.data?.error ?? 'Could not load reviews.', true)
  } finally {
    loading.value = false
  }
}

const updateReview = async (id, status) => {
  if (!session.authenticated || updatingId.value) return

  updatingId.value = id
  setMessage('')

  try {
    await $fetch('/api/admin/reviews', {
      method: 'PATCH',
      body: { id, status }
    })
    reviews.value = reviews.value.filter(review => review.id !== id)
    setMessage(`Review moved to ${status}.`)
  } catch (fetchError) {
    setMessage(fetchError?.data?.error ?? 'Could not update review.', true)
  } finally {
    updatingId.value = ''
  }
}

const syncGoogleBusiness = async (setupNotifications = false) => {
  if (googleSyncing.value) return

  googleSyncing.value = true
  googleMessage.value = ''
  googleError.value = false

  try {
    const response = await $fetch('/api/admin/google-business/sync', {
      method: 'POST',
      query: { setupNotifications: setupNotifications ? 'true' : 'false' }
    })
    const errorCount = response.sync?.errors?.length ?? 0
    googleMessage.value = errorCount > 0
      ? `Synced with ${errorCount} Google API warnings.`
      : 'Google Business data synced.'
  } catch (fetchError) {
    googleError.value = true
    googleMessage.value = fetchError?.data?.error ?? 'Could not sync Google Business data.'
  } finally {
    googleSyncing.value = false
  }
}

const logout = async () => {
  await $fetch('/api/auth/logout', { method: 'POST' })
  session.authenticated = false
  session.email = ''
  reviews.value = []
}

const signIn = () => {
  window.location.href = '/api/auth/google'
}

onMounted(async () => {
  localStorage.removeItem(tokenStorageKey)
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
