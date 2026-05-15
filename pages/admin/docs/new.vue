<template>
  <div class="p-4 lg:p-6">
    <div class="mb-6 flex items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-default">New Documentation</h1>
        <p class="mt-1 text-sm text-muted">Create a new documentation page.</p>
      </div>
      <UButton to="/admin" color="neutral" variant="soft" icon="i-heroicons-arrow-left">Admin</UButton>
    </div>

    <UCard>
      <div class="space-y-4">
        <UFormField label="Title">
          <UInput v-model="form.title" placeholder="Getting Started with KrabiClaw" size="lg" />
        </UFormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Category">
            <USelect
              v-model="form.category"
              :items="categoryItems"
              value-key="value"
              label-key="label"
              placeholder="Select a category"
            />
          </UFormField>
          <UFormField label="Difficulty Level">
            <USelect
              v-model="form.difficulty_level"
              :items="difficultyItems"
              value-key="value"
              label-key="label"
              placeholder="Select difficulty"
            />
          </UFormField>
        </div>

        <UFormField label="Excerpt">
          <UTextarea v-model="form.excerpt" :rows="3" placeholder="One or two sentences that summarize this documentation." />
        </UFormField>

        <UFormField label="SEO Description">
          <UTextarea v-model="form.seo_description" :rows="2" placeholder="Meta description for search engines (150-160 characters recommended)" />
        </UFormField>

        <UFormField label="SEO Keywords">
          <UInput v-model="form.seo_keywords" placeholder="restaurant, website builder, menu management" />
        </UFormField>

        <UFormField label="Body (Markdown)">
          <UTextarea
            v-model="form.body"
            :rows="18"
            placeholder="Write your documentation in Markdown..."
            class="font-mono text-sm"
          />
        </UFormField>

        <UFormField label="Featured Image">
          <PlatformMediaPicker v-model="form.featured_image_asset_id" @change="handleImageChange" />
        </UFormField>

        <div v-if="errorMessage || successMessage" class="space-y-2">
          <UAlert v-if="errorMessage" color="error" variant="soft" icon="i-heroicons-exclamation-triangle" :description="errorMessage" />
          <UAlert v-if="successMessage" color="success" variant="soft" icon="i-heroicons-check-circle" :description="successMessage" />
        </div>

        <div class="flex flex-wrap items-center gap-2 border-t border-default pt-4">
          <UButton color="neutral" variant="soft" :loading="saving" :disabled="!canSave" @click="save(false)">
            Save draft
          </UButton>
          <UButton :loading="saving" :disabled="!canPublish" @click="save(true)">
            Publish
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
interface CreateDocResponse {
  id: string | number
  [key: string]: ApiValue
}

definePageMeta({ layout: 'dashboard' })

const categories = ['Getting Started', 'Menu Management', 'Theme Customization', 'SEO & Marketing', 'Integrations', 'Advanced']
const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced']

const categoryItems = computed(() => categories.map((item) => ({ label: item, value: item })))
const difficultyItems = computed(() => difficultyLevels.map((item) => ({ label: item, value: item })))

const form = reactive({
  title: '',
  excerpt: '',
  category: '',
  difficulty_level: '',
  seo_description: '',
  seo_keywords: '',
  body: '',
  featured_image_asset_id: ''
})
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

function getErrorMessage(error: unknown, message: string): string {
  if (error && typeof error === 'object') {
    const data = (error as Record<string, unknown>).data
    if (data && typeof data === 'object') {
      const dataError = (data as Record<string, unknown>).error
      if (typeof dataError === 'string' && dataError) return dataError
    }
    const errorMessage = (error as Record<string, unknown>).message
    if (typeof errorMessage === 'string' && errorMessage) return errorMessage
  }
  return message
}

function handleImageChange(asset: { id: string; publicUrl: string; thumbnailUrl: string } | null) {
  // Image change is handled by v-model, this is for any additional logic if needed
}

async function save(publish: boolean) {
  if (!form.title.trim() || !form.body.trim()) {
    errorMessage.value = 'Title and body are required.'
    return
  }
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    const res = await $fetch<CreateDocResponse>('/api/admin/docs', {
      method: 'POST',
      body: { ...form, publish }
    })
    await navigateTo(`/admin/docs/${res.id}`)
  } catch (err) {
    errorMessage.value = getErrorMessage(err, 'Failed to save doc.')
  } finally {
    saving.value = false
  }
}

const canSave = computed(() => Boolean(form.title.trim() || form.body.trim()))
const canPublish = computed(() => Boolean(form.title.trim() && form.body.trim()))

useSeoMeta({ title: 'New Documentation | Admin' })
</script>
