<template>
  <UDashboardPanel id="admin-users">
    <template #header>
      <UDashboardNavbar title="Users">
        <template #leading><DashboardNavbarLeading to="/admin" label="Admin" /></template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <EditorPaneShell :has-detail="Boolean(selectedUser)" :detail-title="selectedUser?.name || 'Unnamed user'" dismiss-to="/admin/users">
        <template #index>
          <div class="space-y-5">
            <div class="flex gap-2">
              <UInput v-model="search" placeholder="Search users" icon="i-lucide-search" class="flex-1" @keyup.enter="loadUsers" />
              <UButton variant="soft" color="neutral" :loading="loading" @click="loadUsers">Search</UButton>
            </div>
            <UCard v-if="loading" variant="subtle"><div class="space-y-3"><USkeleton v-for="index in 5" :key="index" class="h-16 rounded-lg" /></div></UCard>
            <UAlert v-else-if="loadError" color="error" variant="soft" :description="loadError" />
            <UCard v-else-if="users.length === 0" variant="subtle"><p class="text-sm text-muted">No users match your search.</p></UCard>
            <EditorNavigationList v-else :groups="navigationGroups" :active-item="selectedUser?.id" variant="rows" />
          </div>
        </template>

        <template #detail>
          <div v-if="selectedUser" class="space-y-6">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge :color="selectedUser.role === 'admin' ? 'primary' : 'neutral'" variant="soft" :label="selectedUser.role || 'Role unavailable'" />
              <UBadge v-if="selectedUser.banned" color="error" variant="soft" label="Banned" />
            </div>
            <dl class="divide-y divide-default overflow-hidden rounded-xl border border-default text-sm">
              <div class="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt class="text-muted">Email</dt><dd class="break-all text-default">{{ selectedUser.email }}</dd></div>
              <div class="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt class="text-muted">Name</dt><dd class="text-default">{{ selectedUser.name || 'Not provided' }}</dd></div>
              <div class="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_1fr]"><dt class="text-muted">Joined</dt><dd class="text-default">{{ formatDate(selectedUser.createdAt) }}</dd></div>
            </dl>
            <UButton
              label="Impersonate user"
              icon="i-lucide-log-in"
              :disabled="!selectedUser.role || selectedUser.role === 'admin'"
              :loading="impersonatingUserId === selectedUser.id"
              @click="impersonateUser(selectedUser.id)"
            />
            <p v-if="selectedUser.role === 'admin'" class="text-xs text-muted">Platform administrators cannot be impersonated.</p>
            <p v-else-if="!selectedUser.role" class="text-xs text-muted">Impersonation is unavailable because this account has no role.</p>
          </div>
        </template>
      </EditorPaneShell>
    </template>
  </UDashboardPanel>
</template>

<script setup lang="ts">
import EditorNavigationList from '~/components/dashboard/EditorNavigationList.vue'
import type { EditorNavigationGroup } from '~/components/dashboard/EditorNavigationList.vue'
import EditorPaneShell from '~/components/dashboard/EditorPaneShell.vue'
import { formatDate } from '~/utils/formatters'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Users | KrabiClaw Admin', robots: 'noindex, nofollow' })

interface AdminUser { id: string; email: string; name: string | null; role: string | null; banned: boolean; createdAt: string }

const isUsersResponse = (value: unknown): value is { users: AdminUser[] } =>
  isRecord(value) && Array.isArray(value.users) && value.users.every(user =>
    isRecord(user) && typeof user.id === 'string' && typeof user.email === 'string'
    && (user.name === null || typeof user.name === 'string')
    && (user.role === null || typeof user.role === 'string')
    && typeof user.banned === 'boolean' && typeof user.createdAt === 'string',
  )

const route = useRoute()
if (Array.isArray(route.params.userId) && route.params.userId.length > 1) {
  throw createError({ statusCode: 404, statusMessage: 'User route not found' })
}
const toast = useToast()
const { refreshSession } = useAuth()
const users = ref<AdminUser[]>([])
const search = ref('')
const loading = ref(true)
const loadError = ref('')
const impersonatingUserId = ref<string | null>(null)

const selectedUserId = computed(() => {
  const value = route.params.userId
  return Array.isArray(value) ? value[0] ?? null : typeof value === 'string' ? value : null
})
const selectedUser = computed(() => users.value.find(user => user.id === selectedUserId.value) ?? null)
const navigationGroups = computed<EditorNavigationGroup[]>(() => [{
  id: 'users',
  items: users.value.map(user => ({
    id: user.id,
    label: user.name || 'Unnamed user',
    summary: `${user.email}${user.banned ? ' · Banned' : ''}`,
    to: `/admin/users/${encodeURIComponent(user.id)}`,
  })),
}])

async function loadUsers() {
  loading.value = true
  loadError.value = ''
  try {
    const query = search.value.trim() ? `?q=${encodeURIComponent(search.value.trim())}` : ''
    const [response, detailResponse] = await Promise.all([
      applicationFetch<{ users: AdminUser[] }>(`/api/admin/users${query}`, { validate: isUsersResponse }),
      selectedUserId.value
        ? applicationFetch<{ users: AdminUser[] }>(`/api/admin/users?id=${encodeURIComponent(selectedUserId.value)}`, { validate: isUsersResponse })
        : Promise.resolve({ users: [] }),
    ])
    users.value = [...new Map([...response.users, ...detailResponse.users].map(user => [user.id, user])).values()]
    if (selectedUserId.value && !selectedUser.value) throw createError({ statusCode: 404, statusMessage: 'User not found' })
  } catch (error) {
    if (isNuxtError(error)) throw error
    loadError.value = 'Failed to load users.'
  } finally {
    loading.value = false
  }
}

async function impersonateUser(userId: string) {
  impersonatingUserId.value = userId
  try {
    const { authClient } = await import('~/lib/auth-client')
    const result = await authClient.admin.impersonateUser({ userId })
    if (result.error) throw new Error(result.error.message)
    await refreshSession()
    await navigateTo('/dashboard')
  } catch {
    toast.add({ title: 'Failed to impersonate user', color: 'error' })
  } finally {
    impersonatingUserId.value = null
  }
}

onMounted(loadUsers)
</script>
