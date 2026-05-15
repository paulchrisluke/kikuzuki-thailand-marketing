<template>
  <UPage>
    <!-- Header -->
    <UPageHeader
      title="Let's set up your site"
      description="Chat with ChowBot to add your location, menu, and hours."
    >
      <template #right>
        <div class="flex items-center gap-2">
          <UBadge
            v-if="progress"
            :color="progress.can_publish ? 'success' : 'warning'"
            variant="soft"
            size="lg"
          >
            {{ progress.required_complete }}/{{ progress.required_total }} required steps done
          </UBadge>
          <UButton
            v-if="progress?.can_publish"
            color="success"
            icon="i-heroicons-rocket-launch"
            :to="`/dashboard/sites/${siteId}`"
          >
            Go Live
          </UButton>
          <UButton
            v-else
            color="neutral"
            variant="soft"
            :to="`/dashboard/sites/${siteId}`"
            icon="i-heroicons-arrow-right"
            trailing
          >
            Skip for now
          </UButton>
        </div>
      </template>
    </UPageHeader>

    <UPageBody>
      <!-- Live site preview -->
      <div class="relative overflow-hidden rounded-2xl border border-default bg-elevated" style="height: 70vh">
        <!-- Browser chrome -->
        <div class="flex items-center gap-2 border-b border-default bg-default px-4 py-2.5">
          <div class="flex gap-1.5">
            <div class="size-3 rounded-full bg-red-400/60" />
            <div class="size-3 rounded-full bg-yellow-400/60" />
            <div class="size-3 rounded-full bg-green-400/60" />
          </div>
          <div class="flex-1 rounded-md bg-elevated px-3 py-1 text-center font-mono text-xs text-muted">
            {{ previewUrl }}
          </div>
          <UButton
            icon="i-heroicons-arrow-path"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="iframeLoading"
            @click="reloadIframe"
          />
        </div>

        <!-- iframe -->
        <div class="relative h-full">
          <iframe
            v-if="previewUrl"
            ref="iframeEl"
            :src="previewUrl"
            class="h-full w-full border-0"
            :class="iframeLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'"
            sandbox="allow-scripts allow-same-origin allow-forms"
            @load="iframeLoading = false"
          />

          <!-- Loading overlay -->
          <div
            v-if="iframeLoading || !previewUrl"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-elevated"
          >
            <UIcon name="i-heroicons-globe-alt" class="size-12 text-muted opacity-30" />
            <p class="text-sm text-muted">
              {{ previewUrl ? 'Loading preview…' : 'Setting up your site…' }}
            </p>
          </div>
        </div>
      </div>

      <!-- ChowBot prompt hint -->
      <div class="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-bot" class="size-4 text-primary" />
        <span>ChowBot is open on the right — start by telling it about your restaurant.</span>
      </div>
    </UPageBody>
  </UPage>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const siteId = computed(() => route.params.siteId as string)
const config = useRuntimeConfig()

// ─── Force ChowBot open in onboarding mode ────────────────────────────────
const chowBot = useChowBot()

onMounted(async () => {
  // Set onboarding mode so the agent uses the structured setup prompt
  chowBot.currentPageOverride.value = 'onboarding'
  chowBot.open()

  // Kick off with a greeting if no messages yet
  if (!chowBot.messages.value.length) {
    await nextTick()
    setTimeout(() => {
      chowBot.sendMessage('Hi! I just created my restaurant site and I need help setting it up.')
    }, 300)
  }

  // Load setup progress
  await refreshProgress()
})

onUnmounted(() => {
  // Clear override when leaving the setup page
  chowBot.currentPageOverride.value = null
})

// ─── Preview URL ──────────────────────────────────────────────────────────
const previewUrl = ref<string | null>(null)
const iframeEl = ref<HTMLIFrameElement | null>(null)
const iframeLoading = ref(true)

async function buildPreviewUrl() {
  if (!siteId.value) return
  try {
    const res = await $fetch<{ success: boolean; progress: { public_url: string | null } }>(
      `/api/sites/${siteId.value}/setup-progress`
    )
    if (res.success && res.progress.public_url) {
      previewUrl.value = res.progress.public_url
    }
  } catch { /* non-blocking */ }
}

function reloadIframe() {
  iframeLoading.value = true
  if (iframeEl.value) {
    iframeEl.value.src = iframeEl.value.src
  }
}

// ─── Setup progress ───────────────────────────────────────────────────────
interface SetupProgress {
  required_complete: number
  required_total: number
  can_publish: boolean
  public_url: string | null
}

const progress = ref<SetupProgress | null>(null)

async function refreshProgress() {
  if (!siteId.value) return
  try {
    const res = await $fetch<{ success: boolean; progress: SetupProgress }>(
      `/api/sites/${siteId.value}/setup-progress`
    )
    if (res.success) {
      progress.value = res.progress
      if (res.progress.public_url && !previewUrl.value) {
        previewUrl.value = res.progress.public_url
        iframeLoading.value = true
      }
    }
  } catch { /* non-blocking */ }
}

// Refresh preview after each ChowBot tool call completes
const refreshCount = useState<number>('site:refresh', () => 0)
const menuRefreshCount = useState<number>('menu:refresh', () => 0)

watch([refreshCount, menuRefreshCount], async () => {
  await refreshProgress()
  // Give the site a moment to rebuild before reloading the preview
  setTimeout(() => reloadIframe(), 1500)
})

onMounted(() => buildPreviewUrl())

useSeoMeta({ title: 'Set Up Your Site | KrabiClaw', robots: 'noindex, nofollow' })
</script>
