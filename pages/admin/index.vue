<template>
  <div>
    <!-- Not authenticated -->
    <div v-if="!session?.authenticated" class="max-w-md mx-auto text-center py-20 bg-white rounded-3xl shadow-sm border border-stone-200 px-8">
        <div class="text-5xl mb-6">🏮</div>
        <h2 class="text-2xl font-bold text-gray-900 mb-4">Management Portal</h2>
        <p class="text-stone-500 mb-10">Sign in with your authorized Google account to manage restaurant data.</p>
        <a
          href="/api/auth/google"
          class="inline-flex items-center justify-center w-full px-6 py-4 text-lg font-bold text-white bg-black rounded-2xl hover:bg-stone-800 transition-all"
        >
          Sign in with Google
        </a>
      </div>

      <!-- Authenticated dashboard -->
      <div v-else class="space-y-8">
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
            <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Reviews</h3>
            <p class="text-4xl font-bold text-gray-900">{{ publicData?.reviews?.length ?? '—' }}</p>
          </div>
          <div class="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
            <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Rating</h3>
            <div class="flex items-baseline gap-2">
              <p class="text-4xl font-bold text-gray-900">{{ averageRating ?? '—' }}</p>
              <span v-if="averageRating" class="text-yellow-400 text-2xl">★</span>
            </div>
          </div>
          <div class="bg-white p-8 rounded-3xl shadow-sm border border-stone-200">
            <h3 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Posts</h3>
            <p class="text-4xl font-bold text-gray-900">{{ publicData?.posts?.length ?? '—' }}</p>
          </div>
        </div>

        <!-- Last synced -->
        <div class="bg-white rounded-3xl border border-stone-200 p-8">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 class="text-lg font-bold text-gray-900">Google Business Data</h2>
              <p class="text-sm text-stone-400 mt-1">
                {{ publicData?.syncedAt ? `Last synced ${formatDate(publicData.syncedAt)}` : 'Never synced' }}
              </p>
              <p v-if="syncErrors.length" class="text-sm text-red-500 mt-1">
                {{ syncErrors.length }} sync error{{ syncErrors.length > 1 ? 's' : '' }} — check Connection tab
              </p>
            </div>
            <NuxtLink
              to="/admin/connection"
              class="text-sm font-semibold bg-black text-white px-6 py-3 rounded-xl hover:bg-stone-800 transition-colors"
            >
              Manage Connection →
            </NuxtLink>
          </div>
        </div>

        <!-- Nav cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <NuxtLink to="/admin/reviews" class="bg-white p-10 rounded-3xl shadow-sm border border-stone-200 hover:border-black transition-all group">
            <div class="text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">💬</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Manage Reviews</h3>
            <p class="text-stone-500">Approve or reject customer reviews from this site.</p>
          </NuxtLink>
          <NuxtLink to="/admin/connection" class="bg-white p-10 rounded-3xl shadow-sm border border-stone-200 hover:border-black transition-all group">
            <div class="text-4xl mb-4 group-hover:scale-110 transition-transform inline-block">🔄</div>
            <h3 class="text-2xl font-bold text-gray-900 mb-2">Google Connection</h3>
            <p class="text-stone-500">Manage Google Business link and view API status.</p>
          </NuxtLink>
        </div>
      </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const { data: session } = await useFetch('/api/auth/session', { key: 'admin-session' })
const { data: publicData } = await useFetch('/api/google-business/public', { key: 'google-business-public' })

const syncErrors = computed(() => publicData.value?.errors?.filter(e => e.source !== 'db') ?? [])

const averageRating = computed(() => {
  const reviews = publicData.value?.reviews ?? []
  if (!reviews.length) return null
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
  const ratings = reviews.map(r => map[r.starRating] ?? 0).filter(Boolean)
  if (!ratings.length) return null
  return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
})

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
})

useSeoMeta({ title: 'Dashboard | KIKUZUKI Admin', robots: 'noindex, nofollow' })
</script>