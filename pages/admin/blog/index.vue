<template>
  <UDashboardPanel id="admin-blog">
    <template #header>
      <UDashboardNavbar title="Blog">
        <template #leading>
          <DashboardNavbarLeading to="/admin" label="Admin" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <DashboardListEditor
        :items="listItems"
        v-model:editing="editing"
        title="Posts"
        description="Publish updates and stories for the platform site."
        empty-title="No posts yet"
        empty-icon="i-lucide-newspaper"
        add-label="Add a post"
        :pending="blogLoading"
        :error="blogError"
        :removing-id="deletingPostId"
        @add="addPost"
        @open="openPost"
        @remove="openDeleteConfirm"
      >
        <template #item="{ item }">
          <button type="button" class="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default" :disabled="editing" @click="openPost(item)">
            <p class="truncate text-sm font-medium text-highlighted">{{ item.title }}</p>
            <p v-if="item.summary" class="mt-1 line-clamp-2 text-sm text-muted">{{ item.summary }}</p>
          </button>
        </template>
      </DashboardListEditor>
    </template>
  </UDashboardPanel>

  <!-- Delete post confirm modal -->
  <UModal v-model:open="deleteConfirmOpen" title="Delete post?" :dismissible="deletingPostId === null" :ui="{ content: 'max-w-md' }">
    <template #body>
      <p class="text-sm text-muted">This action cannot be undone.</p>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" :disabled="deletingPostId !== null" @click="deleteConfirmOpen = false">Cancel</UButton>
        <UButton color="error" :loading="deletingPostId !== null" @click="confirmDeletePost">Delete</UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import DashboardListEditor from '~/components/dashboard/DashboardListEditor.vue'
import { formatDate } from '~/utils/formatters'
definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Blog | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()

interface BlogPost { id: string; title: string; status: 'published' | 'scheduled'; published_at: string | null; scheduled_for: string | null }

const blogPosts = ref<BlogPost[]>([])
const editing = ref(false)
const blogLoading = ref(true)
const blogError = ref('')
const deleteConfirmOpen = ref(false)
const pendingDeletePostId = ref<string | null>(null)
const deletingPostId = ref<string | null>(null)
const listItems = computed(() => blogPosts.value.map(post => ({
    ...post,
    summary: post.status === 'scheduled' ? `Scheduled ${formatDate(post.scheduled_for)}` : `Published ${formatDate(post.published_at)}`,
  })))

function addPost() { navigateTo('/admin/blog/new') }
function openPost(post: BlogPost) { navigateTo(`/admin/blog/${encodeURIComponent(post.id)}`) }

async function loadBlogPosts() {
  blogLoading.value = true
  try {
    const res = await applicationFetch<{ posts: BlogPost[] }>('/api/admin/blog/posts', {
      validate: validateApiShape({ posts: 'array' }),
    })
    blogPosts.value = res.posts ?? []
    blogError.value = ''
  } catch {
    blogError.value = 'Failed to load posts.'
  } finally {
    blogLoading.value = false
  }
}

function openDeleteConfirm(post: BlogPost) {
  if (deletingPostId.value !== null) return
  pendingDeletePostId.value = post.id
  deleteConfirmOpen.value = true
}

async function confirmDeletePost() {
  if (!pendingDeletePostId.value) return
  deletingPostId.value = pendingDeletePostId.value
  try {
    await applicationFetch(`/api/admin/blog/posts/${pendingDeletePostId.value}`, {
      method: 'DELETE',
      validate: (value): value is { success: true } => isRecord(value) && value.success === true,
    })
    toast.add({ title: 'Post deleted', color: 'success' })
    await loadBlogPosts()
  } catch {
    toast.add({ title: 'Failed to delete post', color: 'error' })
  } finally {
    deletingPostId.value = null
    deleteConfirmOpen.value = false
    pendingDeletePostId.value = null
  }
}

onMounted(loadBlogPosts)
</script>
