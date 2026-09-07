<template>
  <UDashboardPanel id="admin-members">
    <template #header>
      <UDashboardNavbar title="Members">
        <template #leading>
          <DashboardNavbarLeading to="/admin" label="Admin" />
        </template>
        <template #trailing>
          <UButton size="sm" icon="i-lucide-user-plus" label="Add team member" @click="inviteOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">

        <!-- KrabiClaw Team -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold text-highlighted">KrabiClaw Team</h2>
                <p class="mt-0.5 text-sm text-muted">Platform admins with full access.</p>
              </div>
              <UBadge :label="`${team.length}`" color="neutral" variant="soft" />
            </div>
          </template>

          <div v-if="membersLoading" class="space-y-3">
            <USkeleton v-for="i in 2" :key="i" class="h-14 rounded-lg" />
          </div>
          <div v-else-if="team.length" class="divide-y divide-default">
            <div v-for="member in team" :key="member.id" class="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
              <div class="flex items-center gap-3 min-w-0">
                <UAvatar :src="member.image || undefined" :alt="member.name || member.email" icon="i-lucide-user" />
                <div class="min-w-0">
                  <p class="truncate font-medium text-highlighted">{{ member.name || member.email }}</p>
                  <p class="truncate text-sm text-muted">{{ member.email }}</p>
                </div>
              </div>
              <UBadge label="admin" color="primary" variant="soft" />
            </div>
          </div>

        </UCard>

      </div>
    </template>
  </UDashboardPanel>

  <UModal v-model:open="inviteOpen" title="Add team member" description="Give a colleague platform administrator access." :dismissible="!invitingTeam" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Email" required><UInput v-model="teamInviteEmail" type="email" placeholder="name@email.com" class="w-full" @keyup.enter="inviteTeamMember" /></UFormField>
        <UFormField label="Name"><UInput v-model="teamInviteName" placeholder="Optional" class="w-full" @keyup.enter="inviteTeamMember" /></UFormField>
        <UAlert v-if="teamInviteResult" :color="teamInviteResult.error ? 'error' : 'success'" variant="soft" :description="teamInviteResult.message" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="invitingTeam" @click="closeInvite" />
        <UButton label="Add to team" :loading="invitingTeam" :disabled="!teamInviteEmail.trim()" @click="inviteTeamMember" />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { getErrorMessage } from '~/utils/errors'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'Members | KrabiClaw Admin', robots: 'noindex, nofollow' })

const toast = useToast()

interface TeamMember { id: string; name: string | null; email: string; image: string | null; role: string; createdAt: string }

const team = ref<TeamMember[]>([])
const inviteOpen = ref(false)
const membersLoading = ref(false)
const teamInviteEmail = ref('')
const teamInviteName = ref('')
const invitingTeam = ref(false)
const teamInviteResult = ref<{ error?: boolean; message: string } | null>(null)

const isMembersResponse = (value: unknown): value is { team: TeamMember[] } =>
  isRecord(value)
  && Array.isArray(value.team)
  && value.team.every(member =>
    isRecord(member) && typeof member.id === 'string' && typeof member.email === 'string',
  )
const isTeamInviteResponse = (value: unknown): value is { action: string; email: string } =>
  isRecord(value) && typeof value.action === 'string' && typeof value.email === 'string'

async function loadMembers() {
  membersLoading.value = true
  try {
    const res = await applicationFetch<{ team: TeamMember[] }>('/api/admin/members', { validate: isMembersResponse })
    team.value = res.team
  } catch {
    toast.add({ title: 'Failed to load members', color: 'error' })
  } finally {
    membersLoading.value = false
  }
}

async function inviteTeamMember() {
  const email = teamInviteEmail.value.trim()
  if (!email) return
  invitingTeam.value = true
  teamInviteResult.value = null
  try {
    const res = await applicationFetch<{ action: string; email: string }>('/api/admin/invite/team', {
      method: 'POST',
      body: { email, name: teamInviteName.value.trim() || undefined },
      validate: isTeamInviteResponse,
    })
    const verb = res.action === 'promoted' ? 'promoted to admin' : 'created as admin'
    teamInviteResult.value = { message: `${res.email} ${verb}` }
    teamInviteEmail.value = ''
    teamInviteName.value = ''
    await loadMembers()
    inviteOpen.value = false
    toast.add({ title: 'Team member added', color: 'success' })
  } catch (err: unknown) {
    teamInviteResult.value = { error: true, message: getErrorMessage(err, 'Failed to add team member') }
  } finally {
    invitingTeam.value = false
  }
}

function closeInvite() {
  inviteOpen.value = false
  teamInviteResult.value = null
}

onMounted(loadMembers)
</script>
