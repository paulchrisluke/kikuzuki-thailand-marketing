<template>
  <UDashboardPanel id="admin-docs">
    <template #header>
      <UDashboardNavbar title="Docs">
      </UDashboardNavbar>
    </template>

    <template #body>
      <DashboardListEditor
        :items="listItems"
        v-model:editing="editing"
        title="Documentation"
        description="Manage the platform help library and its navigation metadata."
        empty-title="No docs yet"
        empty-icon="i-lucide-book-open"
        add-label="Add documentation"
        :pending="docsLoading"
        :error="docsError"
        :removing-id="deletingDocId"
        @add="addDoc"
        @open="openDoc"
        @remove="openDeleteConfirm"
      >
        <template #item="{ item }">
          <NuxtLink :to="`/admin/docs/${encodeURIComponent(item.id)}`" class="block w-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
            <p v-if="item.summary" class="mt-1 line-clamp-2 text-sm text-muted">{{ item.summary }}</p>
          </NuxtLink>
        </template>
      </DashboardListEditor>
    </template>
  </UDashboardPanel>
  <UModal v-model:open="deleteConfirmOpen" title="Delete doc?" :dismissible="deletingDocId === null" :ui="{ content: 'max-w-md' }">
    <template #body>
      <p class="text-sm text-muted">This action cannot be undone.</p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" :disabled="deletingDocId !== null" @click="deleteConfirmOpen = false">Cancel</UButton>
        <UButton color="error" :loading="deletingDocId !== null" @click="confirmDeleteDoc">Delete</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Docs | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()

interface Doc { id: string; title: string; slug: string | null; category: string | null }

const isDocsResponse = (value: unknown): value is { docs: Doc[] } =>
  isRecord(value)
  && Array.isArray(value.docs)
  && value.docs.every(doc =>
    isRecord(doc)
    && typeof doc.id === 'string'
    && typeof doc.title === 'string',
  )

const docs = ref<Doc[]>([])
const editing = ref(false)
const docsLoading = ref(true)
const docsError = ref('')
const deleteConfirmOpen = ref(false)
const pendingDeleteDocId = ref<string | null>(null)
const deletingDocId = ref<string | null>(null)
const listItems = computed(() => docs.value.map(doc => ({
    ...doc,
    summary: [doc.category, doc.slug].filter(Boolean).join(' · '),
  })))

function addDoc() { navigateTo('/admin/docs/new') }
function openDoc(doc: Doc) { navigateTo(`/admin/docs/${encodeURIComponent(doc.id)}`) }

async function loadDocs() {
  docsLoading.value = true
  try {
    const res = await applicationFetch<{ docs: Doc[] }>('/api/admin/docs', { validate: isDocsResponse })
    docs.value = res.docs
    docsError.value = ''
  } catch {
    docsError.value = 'Failed to load docs.'
  } finally {
    docsLoading.value = false
  }
}

function openDeleteConfirm(doc: Doc) {
  if (deletingDocId.value !== null) return
  pendingDeleteDocId.value = doc.id
  deleteConfirmOpen.value = true
}

async function confirmDeleteDoc() {
  if (!pendingDeleteDocId.value) return
  deletingDocId.value = pendingDeleteDocId.value
  try {
    await applicationFetch(`/api/admin/docs/${pendingDeleteDocId.value}`, {
      method: 'DELETE',
      validate: (value): value is { success: true } => isRecord(value) && value.success === true,
    })
    toast.add({ title: 'Doc deleted', color: 'success' })
    await loadDocs()
  } catch {
    toast.add({ title: 'Failed to delete doc', color: 'error' })
  } finally {
    deletingDocId.value = null
    deleteConfirmOpen.value = false
    pendingDeleteDocId.value = null
  }
}

onMounted(loadDocs)
</script>
