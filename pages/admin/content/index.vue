<template>
  <UDashboardPanel id="admin-content">
    <template #header>
      <UDashboardNavbar title="Content">
        <template #leading>
          <DashboardNavbarLeading to="/admin" label="Admin" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-3">
        <UCard>
          <template #header><p class="font-medium text-default">Social sharing image</p></template>
          <div class="space-y-3">
            <p class="text-sm text-muted">Used when a platform page has no owner-specific generated card.</p>
            <PlatformMediaPicker v-model="socialShareAssetId" />
            <div class="flex gap-2">
              <UButton :loading="savingSocialShare" @click="saveSocialShare">Save image</UButton>
              <UButton color="neutral" variant="outline" :loading="regenerating" @click="regenerateCards">Regenerate cards</UButton>
            </div>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import { isSocialCardRegenerationResponse, socialCardRefreshNotice, type SocialCardRegenerationResponse } from '~/utils/social-card-refresh'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Content | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()
const socialShareAssetId = ref<string | null>(null)
const savingSocialShare = ref(false)
const regenerating = ref(false)
const isAssetResponse = (value: unknown): value is { asset_id: string | null } =>
  isRecord(value) && (value.asset_id === null || typeof value.asset_id === 'string')
const isMutationResponse = (value: unknown): value is Record<string, unknown> => isRecord(value)

onMounted(async () => {
  const response = await applicationFetch<{ asset_id: string | null }>('/api/admin/platform/social-share', {
    validate: isAssetResponse,
  })
  socialShareAssetId.value = response.asset_id
})

async function saveSocialShare() {
  savingSocialShare.value = true
  try {
    await applicationFetch('/api/admin/platform/social-share', { method: 'PUT', body: { asset_id: socialShareAssetId.value }, validate: isMutationResponse })
    toast.add({ title: 'Sharing image saved', color: 'success' })
  } finally {
    savingSocialShare.value = false
  }
}

async function regenerateCards() {
  regenerating.value = true
  try {
    const summary = { generated: 0, reused: 0, skipped: 0, failed: 0, total: 0 }
    let after: string | null = null
    do {
      const response: SocialCardRegenerationResponse = await applicationFetch<SocialCardRegenerationResponse>('/api/admin/platform/social-cards/regenerate', {
        method: 'POST', body: { after }, validate: isSocialCardRegenerationResponse,
      })
      for (const key of ['generated', 'reused', 'skipped', 'failed', 'total'] as const) summary[key] += response.summary[key]
      after = response.next_cursor
    } while (after)
    const notice = socialCardRefreshNotice(summary)
    toast.add({ title: notice.message, color: notice.color })
  } finally {
    regenerating.value = false
  }
}
</script>
