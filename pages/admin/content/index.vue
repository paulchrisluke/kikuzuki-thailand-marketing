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
            <p class="text-sm text-muted">Source image for the platform homepage social sharing card.</p>
            <PlatformMediaPicker v-model="socialShareAssetId" />
            <UButton :loading="savingSocialShare" @click="saveSocialShare">Save image</UButton>
          </div>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Content | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()
const socialShareAssetId = ref<string | null>(null)
const savingSocialShare = ref(false)
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

</script>
