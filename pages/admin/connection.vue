<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold text-gray-900">Google Connection</h1>
      <p class="text-stone-400 mt-2">Manage your Google Business Profile connection.</p>
    </div>

    <!-- Unlinked state -->
    <div v-if="!isLinked" class="bg-white rounded-3xl border border-stone-200 p-8 text-center">
      <div class="text-4xl mb-4">🌐</div>
      <h2 class="text-xl font-bold text-gray-900 mb-2">Connect Google Business Profile</h2>
      <p class="text-stone-500 mb-8 max-w-md mx-auto">
        Link your Google Business Profile to automatically sync your restaurant info, reviews, photos, and posts to your website.
      </p>
      <a
        href="/api/auth/google"
        class="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-black rounded-xl hover:bg-stone-800 transition-colors"
      >
        Connect with Google →
      </a>
      <p v-if="syncMessage" class="mt-4 text-sm text-red-500">{{ syncMessage }}</p>
    </div>

    <!-- Linked state -->
    <div v-else class="space-y-8">
      <div class="bg-white rounded-3xl border border-stone-200 p-8">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h2 class="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span class="text-green-500">✓</span> Connected as {{ publicData?.business?.title || 'Google Business Account' }}
            </h2>
            <p class="text-sm text-stone-400 mt-1">
              Last updated: {{ publicData?.syncedAt ? formatDate(publicData.syncedAt) : 'Syncing now...' }}
            </p>
          </div>
          <button
            @click="confirmUnlink"
            class="flex-shrink-0 text-sm font-semibold text-red-600 bg-red-50 px-6 py-3 rounded-xl hover:bg-red-100 transition-colors"
          >
            Unlink Account
          </button>
        </div>
      </div>

      <!-- Developer Details (collapsed) -->
      <details class="bg-white rounded-3xl border border-stone-200 [&_summary::-webkit-details-marker]:hidden">
        <summary class="p-8 font-bold text-gray-900 cursor-pointer flex justify-between items-center outline-none">
          Developer Details
          <span class="text-stone-400 transition-transform duration-200 select-none">▼</span>
        </summary>
        <div class="px-8 pb-8 pt-0 border-t border-stone-100 mt-4 pt-4">
          
          <div class="flex items-center gap-4 mb-6">
             <button
              @click="triggerSync"
              :disabled="syncing"
              class="text-sm font-medium bg-stone-100 text-stone-700 px-4 py-2 rounded-lg hover:bg-stone-200 disabled:opacity-50 transition-colors"
            >
              {{ syncing ? 'Syncing...' : 'Force Manual Sync' }}
            </button>
            <span v-if="syncMessage && isLinked" :class="['text-sm font-medium', syncError ? 'text-red-600' : 'text-green-700']">
              {{ syncMessage }}
            </span>
          </div>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8 text-sm">
            <div class="flex flex-col gap-1">
              <dt class="text-stone-400">Reviews fetched</dt>
              <dd class="font-medium text-gray-900">{{ publicData?.reviews?.length ?? 0 }}</dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-stone-400">Media items</dt>
              <dd class="font-medium text-gray-900">{{ publicData?.media?.length ?? 0 }}</dd>
            </div>
            <div class="flex flex-col gap-1">
              <dt class="text-stone-400">Posts</dt>
              <dd class="font-medium text-gray-900">{{ publicData?.posts?.length ?? 0 }}</dd>
            </div>
          </dl>

          <div v-if="syncErrors.length" class="mt-6 p-4 bg-red-50 rounded-xl border border-red-100">
            <h3 class="text-sm font-bold text-red-700 mb-3">Recent API Errors</h3>
            <div class="space-y-2">
              <div v-for="err in syncErrors" :key="err.source" class="text-xs">
                <span class="font-semibold text-red-600 uppercase tracking-wider">{{ err.source }}</span>
                <p class="text-stone-600 mt-0.5 font-mono break-all">{{ err.message }}</p>
              </div>
            </div>
          </div>

        </div>
      </details>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const { data: publicData, refresh } = await useFetch('/api/google-business/public', {
  key: 'google-business-public'
})

const syncing = ref(false)
const syncMessage = ref('')
const syncError = ref(false)

const syncErrors = computed(() => publicData.value?.errors?.filter(e => e.source !== 'db') ?? [])

// Determine if we are linked based on syncedAt or error messages
const isLinked = computed(() => {
  if (publicData.value?.syncedAt) return true
  if (syncMessage.value.toLowerCase().includes('refresh token')) return false
  if (syncMessage.value.toLowerCase().includes('sign in')) return false
  // If syncing hasn't failed with an auth error, we're likely unlinked if syncedAt is null and syncError is true (we attempted and failed).
  // But wait, the API might return "Missing Google OAuth client configuration." or similar.
  if (syncError.value && !publicData.value?.syncedAt) return false
  return publicData.value?.syncedAt !== null || syncing.value
})

const triggerSync = async () => {
  syncing.value = true
  syncMessage.value = ''
  syncError.value = false
  try {
    const result = await $fetch('/api/admin/google-business/sync', {
      method: 'POST',
      query: { setupNotifications: 'true' }
    })
    const errorCount = result.sync?.errors?.filter(e => e.source !== 'db').length ?? 0
    syncMessage.value = errorCount > 0
      ? `Synced with ${errorCount} API warning${errorCount > 1 ? 's' : ''}` 
      : 'Sync complete'
    syncError.value = false
    await refresh()
  } catch (e) {
    syncMessage.value = e?.data?.error ?? e.message ?? 'Sync failed — check API credentials'
    syncError.value = true
  } finally {
    syncing.value = false
  }
}

const confirmUnlink = async () => {
  if (confirm('Are you sure you want to unlink your Google Business Profile? Your website will stop receiving updates until you reconnect.')) {
    try {
      await $fetch('/api/admin/google-business/unlink', { method: 'POST' })
      syncMessage.value = 'Account unlinked.'
      syncError.value = true // Force unlinked state to show
      await refresh()
    } catch (e) {
      alert('Failed to unlink account.')
    }
  }
}

onMounted(() => {
  if (!publicData.value?.syncedAt) {
    triggerSync()
  }
})

const formatDate = (iso) => {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - date) / 1000) // in seconds
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'Yesterday'
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })
}

useSeoMeta({ title: 'Google Connection | KIKUZUKI Admin', robots: 'noindex, nofollow' })
</script>

<style scoped>
details[open] summary span {
  transform: rotate(180deg);
}
</style>
